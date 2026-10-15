import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, isOverlapViolation } from "@/lib/errors";
import { localDayRange, formatTime, todayLocal } from "@/lib/utils/time";
import {
  reservationIdSchema,
  reservationInputSchema,
  reservationListQuerySchema,
  toInterval,
  type ReservationListQuery,
} from "@/lib/validations/reservation";

export const RESERVATION_PAGE_SIZE = 15;

type Tx = Prisma.TransactionClient;

const reservationInclude = {
  resource: { select: { id: true, name: true, type: true, location: true, isActive: true } },
} satisfies Prisma.ReservationInclude;

export type ReservationWithResource = Prisma.ReservationGetPayload<{ include: typeof reservationInclude }>;

export interface ConflictSummary {
  id: string;
  number: number;
  purpose: string;
  startsAt: Date;
  endsAt: Date;
}

export interface AvailabilityResult {
  available: boolean;
  reason?: "RESOURCE_INACTIVE" | "RESOURCE_NOT_FOUND" | "CONFLICT";
  conflicts: ConflictSummary[];
}

function parseInput(raw: unknown) {
  const parsed = reservationInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Please correct the highlighted fields.",
      z.flattenError(parsed.error).fieldErrors,
    );
  }
  return parsed.data;
}

function parseId(id: string): string {
  const parsed = reservationIdSchema.safeParse(id);
  if (!parsed.success) throw new AppError("NOT_FOUND", "Reservation not found.");
  return parsed.data;
}

function conflictError(conflicts: ConflictSummary[]): AppError {
  const first = conflicts[0];
  const detail = first
    ? ` It overlaps an existing booking from ${formatTime(first.startsAt)} to ${formatTime(first.endsAt)}.`
    : "";
  return new AppError(
    "CONFLICT",
    `This resource is already booked for part of the selected time.${detail} Choose another time or resource.`,
    { startTime: ["Overlaps an existing reservation"] },
  );
}

/**
 * Confirmed reservations of a resource that overlap [startsAt, endsAt).
 * Overlap rule (half-open): existing.startsAt < endsAt AND existing.endsAt > startsAt.
 */
export function findConflicts(
  params: { resourceId: string; startsAt: Date; endsAt: Date; excludeId?: string },
  client: Tx | typeof db = db,
): Promise<ConflictSummary[]> {
  return client.reservation.findMany({
    where: {
      resourceId: params.resourceId,
      status: "CONFIRMED",
      startsAt: { lt: params.endsAt },
      endsAt: { gt: params.startsAt },
      ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
    },
    orderBy: { startsAt: "asc" },
    select: { id: true, number: true, purpose: true, startsAt: true, endsAt: true },
  });
}

/** Informational availability check used by the form and API. Submissions re-check on the server. */
export async function checkAvailability(params: {
  resourceId: string;
  startsAt: Date;
  endsAt: Date;
  excludeId?: string;
}): Promise<AvailabilityResult> {
  const resource = await db.resource.findUnique({
    where: { id: params.resourceId },
    select: { isActive: true },
  });
  if (!resource) return { available: false, reason: "RESOURCE_NOT_FOUND", conflicts: [] };
  if (!resource.isActive) return { available: false, reason: "RESOURCE_INACTIVE", conflicts: [] };
  const conflicts = await findConflicts(params);
  return conflicts.length
    ? { available: false, reason: "CONFLICT", conflicts }
    : { available: true, conflicts: [] };
}

/**
 * Locks the resource row (FOR SHARE) for the rest of the transaction and verifies it is bookable.
 * A concurrent deactivation (UPDATE) must wait for this transaction, and vice versa.
 */
async function lockBookableResource(tx: Tx, resourceId: string) {
  const rows = await tx.$queryRaw<{ id: string; is_active: boolean }[]>`
    SELECT id, is_active FROM resources WHERE id = ${resourceId}::uuid FOR SHARE`;
  const resource = rows[0];
  if (!resource) {
    throw new AppError("NOT_FOUND", "The selected resource does not exist.", {
      resourceId: ["Resource not found"],
    });
  }
  if (!resource.is_active) {
    throw new AppError(
      "RESOURCE_INACTIVE",
      "This resource is inactive and cannot accept new reservations. Choose an active resource.",
      { resourceId: ["Resource is inactive"] },
    );
  }
}

function assertNotInPast(startsAt: Date, now: Date) {
  // Allow the current minute so a booking "starting now" is accepted.
  if (startsAt.getTime() < now.getTime() - 60_000) {
    throw new AppError("VALIDATION_ERROR", "Reservations cannot start in the past.", {
      startTime: ["Start time is in the past"],
    });
  }
}

/** Translates the database exclusion violation into a friendly conflict error. */
async function withConflictTranslation<T>(
  operation: () => Promise<T>,
  params: { resourceId: string; startsAt: Date; endsAt: Date; excludeId?: string },
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isOverlapViolation(error)) {
      throw conflictError(await findConflicts(params).catch(() => []));
    }
    throw error;
  }
}

export async function createReservation(raw: unknown, now = new Date()) {
  const input = parseInput(raw);
  const { startsAt, endsAt } = toInterval(input);
  assertNotInPast(startsAt, now);
  const params = { resourceId: input.resourceId, startsAt, endsAt };

  return withConflictTranslation(
    () =>
      db.$transaction(async (tx) => {
        await lockBookableResource(tx, input.resourceId);
        // Friendly pre-check; the exclusion constraint is the authoritative guard against races.
        const conflicts = await findConflicts(params, tx);
        if (conflicts.length) throw conflictError(conflicts);
        return tx.reservation.create({
          data: {
            resourceId: input.resourceId,
            requesterName: input.requesterName,
            requesterEmail: input.requesterEmail,
            purpose: input.purpose,
            startsAt,
            endsAt,
          },
          include: reservationInclude,
        });
      }),
    params,
  );
}

export async function updateReservation(id: string, raw: unknown, now = new Date()) {
  const reservationId = parseId(id);
  const input = parseInput(raw);
  const { startsAt, endsAt } = toInterval(input);
  const params = { resourceId: input.resourceId, startsAt, endsAt, excludeId: reservationId };

  return withConflictTranslation(
    () =>
      db.$transaction(async (tx) => {
        const existing = await tx.reservation.findUnique({ where: { id: reservationId } });
        if (!existing) throw new AppError("NOT_FOUND", "Reservation not found.");
        if (existing.status === "CANCELLED") {
          throw new AppError("INVALID_STATE", "Cancelled reservations cannot be edited.");
        }
        if (existing.endsAt <= now) {
          throw new AppError("INVALID_STATE", "Past reservations cannot be edited.");
        }
        const timeChanged =
          existing.startsAt.getTime() !== startsAt.getTime() || existing.endsAt.getTime() !== endsAt.getTime();
        if (timeChanged) assertNotInPast(startsAt, now);

        await lockBookableResource(tx, input.resourceId);
        const conflicts = await findConflicts(params, tx);
        if (conflicts.length) throw conflictError(conflicts);

        return tx.reservation.update({
          where: { id: reservationId },
          data: {
            resourceId: input.resourceId,
            requesterName: input.requesterName,
            requesterEmail: input.requesterEmail,
            purpose: input.purpose,
            startsAt,
            endsAt,
          },
          include: reservationInclude,
        });
      }),
    params,
  );
}

/** Cancels by changing status (never deletes), which releases the slot for new bookings. */
export async function cancelReservation(id: string, now = new Date()) {
  const reservationId = parseId(id);
  // Conditional update: only a CONFIRMED reservation transitions, so double submissions are harmless.
  const result = await db.reservation.updateMany({
    where: { id: reservationId, status: "CONFIRMED" },
    data: { status: "CANCELLED", cancelledAt: now },
  });
  if (result.count === 0) {
    const existing = await db.reservation.findUnique({ where: { id: reservationId }, select: { status: true } });
    if (!existing) throw new AppError("NOT_FOUND", "Reservation not found.");
    throw new AppError("INVALID_STATE", "This reservation has already been cancelled.");
  }
  return db.reservation.findUniqueOrThrow({ where: { id: reservationId }, include: reservationInclude });
}

export async function getReservation(id: string): Promise<ReservationWithResource | null> {
  const parsed = reservationIdSchema.safeParse(id);
  if (!parsed.success) return null;
  return db.reservation.findUnique({ where: { id: parsed.data }, include: reservationInclude });
}

export async function listReservations(
  rawQuery: Partial<Record<keyof ReservationListQuery, unknown>> = {},
  now = new Date(),
) {
  const query = reservationListQuerySchema.parse(rawQuery);
  const and: Prisma.ReservationWhereInput[] = [];

  if (query.q) {
    const contains = { contains: query.q, mode: "insensitive" as const };
    const numeric = query.q.replace(/^rsv-?/i, "");
    and.push({
      OR: [
        { purpose: contains },
        { requesterName: contains },
        { resource: { name: contains } },
        ...(/^\d+$/.test(numeric) ? [{ number: Number(numeric) }] : []),
      ],
    });
  }
  if (query.resourceId) and.push({ resourceId: query.resourceId });
  if (query.date) {
    const { start, end } = localDayRange(query.date);
    and.push({ startsAt: { lt: end }, endsAt: { gt: start } });
  }
  if (query.status) and.push({ status: query.status });

  switch (query.view) {
    case "upcoming":
      and.push({ status: "CONFIRMED", endsAt: { gt: now } });
      break;
    case "past":
      and.push({ status: "CONFIRMED", endsAt: { lte: now } });
      break;
    case "cancelled":
      and.push({ status: "CANCELLED" });
      break;
  }

  const where: Prisma.ReservationWhereInput = { AND: and };
  const orderBy: Prisma.ReservationOrderByWithRelationInput =
    query.view === "upcoming" ? { startsAt: "asc" } : { startsAt: "desc" };

  const total = await db.reservation.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / RESERVATION_PAGE_SIZE));
  const page = Math.min(query.page, pageCount);
  const items = await db.reservation.findMany({
    where,
    orderBy,
    include: reservationInclude,
    skip: (page - 1) * RESERVATION_PAGE_SIZE,
    take: RESERVATION_PAGE_SIZE,
  });
  return { items, total, page, pageCount, query };
}

/** Reservations intersecting [start, end), for calendar views. */
export function listReservationsInRange(params: {
  start: Date;
  end: Date;
  resourceId?: string;
  includeCancelled?: boolean;
}) {
  return db.reservation.findMany({
    where: {
      startsAt: { lt: params.end },
      endsAt: { gt: params.start },
      ...(params.resourceId ? { resourceId: params.resourceId } : {}),
      ...(params.includeCancelled ? {} : { status: "CONFIRMED" }),
    },
    orderBy: [{ startsAt: "asc" }],
    include: reservationInclude,
  });
}

/** Confirmed bookings for a resource on a local date (shown under the reservation form). */
export function listResourceDaySchedule(resourceId: string, date: string = todayLocal()) {
  const { start, end } = localDayRange(date);
  return listReservationsInRange({ start, end, resourceId });
}
