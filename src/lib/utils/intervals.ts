/**
 * Pure interval logic shared by the service layer, the availability UI and unit tests.
 * Reservations use half-open intervals [startsAt, endsAt): a booking ending at 11:00
 * does not overlap one starting at 11:00.
 */
export interface Interval {
  startsAt: Date;
  endsAt: Date;
}

export interface BookedInterval extends Interval {
  id: string;
  resourceId: string;
  status: "CONFIRMED" | "CANCELLED";
}

export function isValidInterval({ startsAt, endsAt }: Interval): boolean {
  return (
    !Number.isNaN(startsAt.getTime()) &&
    !Number.isNaN(endsAt.getTime()) &&
    endsAt.getTime() > startsAt.getTime()
  );
}

/** existing.startsAt < requested.endsAt && existing.endsAt > requested.startsAt */
export function intervalsOverlap(a: Interval, b: Interval): boolean {
  return a.startsAt.getTime() < b.endsAt.getTime() && a.endsAt.getTime() > b.startsAt.getTime();
}

/**
 * Returns the existing reservations that would block the requested booking:
 * same resource, CONFIRMED status, overlapping time, and not the reservation being edited.
 * Mirrors the database exclusion constraint, which remains the authoritative check.
 */
export function findBlockingReservations<T extends BookedInterval>(
  existing: T[],
  request: Interval & { resourceId: string; excludeId?: string },
): T[] {
  return existing.filter(
    (r) =>
      r.resourceId === request.resourceId &&
      r.status === "CONFIRMED" &&
      r.id !== request.excludeId &&
      intervalsOverlap(r, request),
  );
}
