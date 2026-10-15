import "server-only";
import { db } from "@/lib/db";
import { localDayRange, todayLocal } from "@/lib/utils/time";

export async function getDashboardStats(now = new Date()) {
  const { start, end } = localDayRange(todayLocal(now));
  const [totalResources, activeResources, todaysReservations, upcomingReservations, cancelledReservations] =
    await Promise.all([
      db.resource.count(),
      db.resource.count({ where: { isActive: true } }),
      db.reservation.count({ where: { status: "CONFIRMED", startsAt: { lt: end }, endsAt: { gt: start } } }),
      db.reservation.count({ where: { status: "CONFIRMED", startsAt: { gt: now } } }),
      db.reservation.count({ where: { status: "CANCELLED" } }),
    ]);
  return { totalResources, activeResources, todaysReservations, upcomingReservations, cancelledReservations };
}

export function getUpcomingReservations(limit = 6, now = new Date()) {
  return db.reservation.findMany({
    where: { status: "CONFIRMED", endsAt: { gt: now } },
    orderBy: { startsAt: "asc" },
    take: limit,
    include: { resource: { select: { id: true, name: true } } },
  });
}

/** Latest created/updated/cancelled reservations, derived from stored timestamps (not an audit log). */
export function getRecentReservationChanges(limit = 6) {
  return db.reservation.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: { resource: { select: { id: true, name: true } } },
  });
}

export type ResourceAvailabilityState =
  | { kind: "inactive" }
  | { kind: "in-use"; until: Date; nextFreeAt: Date }
  | { kind: "available"; nextStartsAt: Date | null };

/**
 * Current availability of every resource, based on confirmed reservations.
 * "Available" means free right now; the next booking today (if any) is reported so the UI
 * never implies the resource is free for the whole day.
 */
export async function getResourceAvailability(now = new Date()) {
  const { end: endOfToday } = localDayRange(todayLocal(now));
  const resources = await db.resource.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      reservations: {
        where: { status: "CONFIRMED", endsAt: { gt: now }, startsAt: { lt: endOfToday } },
        orderBy: { startsAt: "asc" },
        select: { startsAt: true, endsAt: true },
      },
    },
  });

  return resources.map(({ reservations, ...resource }) => {
    let state: ResourceAvailabilityState;
    if (!resource.isActive) {
      state = { kind: "inactive" };
    } else {
      const current = reservations.find((r) => r.startsAt <= now && r.endsAt > now);
      if (current) {
        // Walk back-to-back bookings to find when the resource actually becomes free.
        let nextFreeAt = current.endsAt;
        for (const r of reservations) {
          if (r.startsAt.getTime() === nextFreeAt.getTime()) nextFreeAt = r.endsAt;
        }
        state = { kind: "in-use", until: current.endsAt, nextFreeAt };
      } else {
        state = { kind: "available", nextStartsAt: reservations[0]?.startsAt ?? null };
      }
    }
    return { resource, state, bookingsLeftToday: reservations.length };
  });
}
