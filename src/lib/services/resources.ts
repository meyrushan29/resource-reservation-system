import "server-only";
import { Prisma, type Resource } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  resourceIdSchema,
  resourceInputSchema,
  resourceListQuerySchema,
  type ResourceListQuery,
} from "@/lib/validations/resource";

export const RESOURCE_PAGE_SIZE = 10;

function parseId(id: string): string {
  const parsed = resourceIdSchema.safeParse(id);
  if (!parsed.success) throw new AppError("NOT_FOUND", "Resource not found.");
  return parsed.data;
}

function parseInput(raw: unknown) {
  const parsed = resourceInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Please correct the highlighted fields.",
      z.flattenError(parsed.error).fieldErrors,
    );
  }
  return parsed.data;
}

function rethrowDuplicateName(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new AppError("DUPLICATE", "A resource with this name already exists.", {
      name: ["A resource with this name already exists"],
    });
  }
  throw error;
}

export async function listResources(rawQuery: Partial<Record<keyof ResourceListQuery, unknown>> = {}) {
  const query = resourceListQuerySchema.parse(rawQuery);
  const where: Prisma.ResourceWhereInput = {
    ...(query.q ? { name: { contains: query.q, mode: "insensitive" } } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.status ? { isActive: query.status === "active" } : {}),
  };
  const orderBy: Prisma.ResourceOrderByWithRelationInput[] = (() => {
    switch (query.sort) {
      case "-name":
        return [{ name: "desc" }];
      case "type":
        return [{ type: "asc" }, { name: "asc" }];
      case "createdAt":
        return [{ createdAt: "asc" }];
      case "-createdAt":
        return [{ createdAt: "desc" }];
      default:
        return [{ name: "asc" }];
    }
  })();

  const total = await db.resource.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / RESOURCE_PAGE_SIZE));
  const page = Math.min(query.page, pageCount);
  const items = await db.resource.findMany({
    where,
    orderBy,
    skip: (page - 1) * RESOURCE_PAGE_SIZE,
    take: RESOURCE_PAGE_SIZE,
  });
  return { items, total, page, pageCount, query };
}

/** Active resources for reservation selectors. */
export function listActiveResources() {
  return db.resource.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, type: true, location: true, capacity: true },
  });
}

/** All resources (active and inactive), e.g. for list filters. */
export function listAllResourceOptions() {
  return db.resource.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, isActive: true },
  });
}

export async function getResource(id: string): Promise<Resource | null> {
  const parsed = resourceIdSchema.safeParse(id);
  if (!parsed.success) return null;
  return db.resource.findUnique({ where: { id: parsed.data } });
}

export async function createResource(raw: unknown): Promise<Resource> {
  const data = parseInput(raw);
  return db.resource.create({ data }).catch(rethrowDuplicateName);
}

export async function updateResource(id: string, raw: unknown): Promise<Resource> {
  const resourceId = parseId(id);
  const data = parseInput(raw);
  const existing = await db.resource.findUnique({ where: { id: resourceId }, select: { id: true } });
  if (!existing) throw new AppError("NOT_FOUND", "Resource not found.");
  return db.resource.update({ where: { id: resourceId }, data }).catch(rethrowDuplicateName);
}

/**
 * Activates or deactivates a resource. Deactivation keeps all reservation history;
 * resources are never hard-deleted. The UPDATE takes a row lock that conflicts with the
 * FOR SHARE lock taken while creating a reservation, so a booking cannot slip in
 * concurrently with deactivation.
 */
export async function setResourceActive(id: string, isActive: boolean): Promise<Resource> {
  const resourceId = parseId(id);
  if (typeof isActive !== "boolean") throw new AppError("VALIDATION_ERROR", "Invalid status.");
  try {
    return await db.resource.update({ where: { id: resourceId }, data: { isActive } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new AppError("NOT_FOUND", "Resource not found.");
    }
    throw error;
  }
}

/** Number of confirmed future reservations for a resource (shown when deactivating). */
export function countUpcomingReservations(resourceId: string, now = new Date()) {
  return db.reservation.count({
    where: { resourceId, status: "CONFIRMED", endsAt: { gt: now } },
  });
}
