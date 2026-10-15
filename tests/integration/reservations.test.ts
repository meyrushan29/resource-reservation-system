import { beforeEach, describe, expect, it } from "vitest";
import type { Resource } from "@prisma/client";
import { db } from "@/lib/db";
import { createResource, setResourceActive } from "@/lib/services/resources";
import {
  cancelReservation,
  checkAvailability,
  createReservation,
  getReservation,
  listReservations,
  updateReservation,
} from "@/lib/services/reservations";
import { zonedToUtc } from "@/lib/utils/time";
import { futureDate, reservationInput, resourceInput } from "../support/factories";

let roomA: Resource;
let roomB: Resource;

beforeEach(async () => {
  roomA = await createResource(resourceInput({ name: "Room A" }));
  roomB = await createResource(resourceInput({ name: "Room B" }));
});

const book = (resource: Resource, startTime: string, endTime: string, extra: Record<string, unknown> = {}) =>
  createReservation(reservationInput(resource.id, { startTime, endTime, ...extra }));

describe("reservation creation", () => {
  it("creates a confirmed reservation stored as UTC", async () => {
    const r = await book(roomA, "10:00", "11:00");
    expect(r.status).toBe("CONFIRMED");
    expect(r.number).toBeGreaterThan(0);
    expect(r.startsAt.toISOString()).toBe(zonedToUtc(futureDate(), "10:00").toISOString());
  });

  it.each([
    ["09:00", "10:00", true],
    ["10:00", "11:00", false],
    ["10:30", "11:30", false],
    ["10:45", "10:55", false],
    ["11:00", "12:00", true],
  ])("against 10:00–11:00, %s–%s allowed=%s", async (start, end, allowed) => {
    await book(roomA, "10:00", "11:00");
    const attempt = book(roomA, start, end);
    if (allowed) await expect(attempt).resolves.toMatchObject({ status: "CONFIRMED" });
    else await expect(attempt).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("allows the same time on a different resource", async () => {
    await book(roomA, "10:00", "11:00");
    await expect(book(roomB, "10:00", "11:00")).resolves.toBeTruthy();
  });

  it("rejects reservations for inactive resources", async () => {
    await setResourceActive(roomA.id, false);
    await expect(book(roomA, "10:00", "11:00")).rejects.toMatchObject({ code: "RESOURCE_INACTIVE" });
  });

  it("rejects an unknown resource", async () => {
    await expect(
      createReservation(reservationInput("00000000-0000-4000-8000-000000000000")),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects reservations that start in the past", async () => {
    await expect(book(roomA, "10:00", "11:00", { date: "2020-01-01" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects an end time before the start time", async () => {
    await expect(book(roomA, "11:00", "10:00")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("database-level protection", () => {
  it("the exclusion constraint rejects overlaps even when the service is bypassed", async () => {
    const startsAt = zonedToUtc(futureDate(), "10:00");
    const endsAt = zonedToUtc(futureDate(), "11:00");
    const base = { resourceId: roomA.id, requesterName: "Direct", purpose: "Direct insert", startsAt, endsAt };
    await db.reservation.create({ data: base });
    await expect(
      db.reservation.create({ data: { ...base, startsAt: zonedToUtc(futureDate(), "10:30") } }),
    ).rejects.toThrow(/reservations_no_overlap|23P01|exclusion/i);
  });

  it("the CHECK constraint rejects an inverted range", async () => {
    await expect(
      db.reservation.create({
        data: {
          resourceId: roomA.id,
          requesterName: "Direct",
          purpose: "Inverted",
          startsAt: zonedToUtc(futureDate(), "11:00"),
          endsAt: zonedToUtc(futureDate(), "10:00"),
        },
      }),
    ).rejects.toThrow();
  });

  it("the foreign key prevents deleting a resource with reservations", async () => {
    await book(roomA, "10:00", "11:00");
    await expect(db.resource.delete({ where: { id: roomA.id } })).rejects.toThrow();
  });

  it("allows exactly one of many concurrent overlapping bookings", async () => {
    const attempts = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        book(roomA, "14:00", "15:00", { requesterName: `Concurrent ${i}` }),
      ),
    );
    const fulfilled = attempts.filter((a) => a.status === "fulfilled");
    const rejected = attempts.filter((a): a is PromiseRejectedResult => a.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(9);
    for (const r of rejected) expect(r.reason).toMatchObject({ code: "CONFLICT" });
    expect(await db.reservation.count({ where: { resourceId: roomA.id, status: "CONFIRMED" } })).toBe(1);
  });

  it("serialises deactivation against concurrent bookings", async () => {
    const results = await Promise.allSettled([
      book(roomA, "16:00", "17:00"),
      setResourceActive(roomA.id, false),
    ]);
    // Either the booking committed before deactivation, or it was rejected as inactive — never a booking
    // created after the resource became inactive.
    const booking = results[0];
    if (booking.status === "rejected") expect(booking.reason).toMatchObject({ code: "RESOURCE_INACTIVE" });
    const resource = await db.resource.findUniqueOrThrow({ where: { id: roomA.id } });
    expect(resource.isActive).toBe(false);
  });
});

describe("cancellation", () => {
  it("keeps the record, marks it cancelled and releases the slot", async () => {
    const r = await book(roomA, "10:00", "11:00");
    const cancelled = await cancelReservation(r.id);
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledAt).toBeInstanceOf(Date);
    expect(await getReservation(r.id)).not.toBeNull();
    await expect(book(roomA, "10:00", "11:00")).resolves.toMatchObject({ status: "CONFIRMED" });
  });

  it("rejects cancelling twice", async () => {
    const r = await book(roomA, "10:00", "11:00");
    await cancelReservation(r.id);
    await expect(cancelReservation(r.id)).rejects.toMatchObject({ code: "INVALID_STATE" });
  });
});

describe("updates", () => {
  it("does not conflict with itself when shifting within its own slot", async () => {
    const r = await book(roomA, "10:00", "11:00");
    const updated = await updateReservation(r.id, reservationInput(roomA.id, { startTime: "10:30", endTime: "11:30" }));
    expect(updated.startsAt.toISOString()).toBe(zonedToUtc(futureDate(), "10:30").toISOString());
  });

  it("rejects moving onto another booking", async () => {
    await book(roomA, "12:00", "13:00");
    const r = await book(roomA, "10:00", "11:00");
    await expect(
      updateReservation(r.id, reservationInput(roomA.id, { startTime: "11:30", endTime: "12:30" })),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects moving to an inactive resource", async () => {
    const r = await book(roomA, "10:00", "11:00");
    await setResourceActive(roomB.id, false);
    await expect(updateReservation(r.id, reservationInput(roomB.id))).rejects.toMatchObject({
      code: "RESOURCE_INACTIVE",
    });
  });

  it("rejects editing a cancelled reservation", async () => {
    const r = await book(roomA, "10:00", "11:00");
    await cancelReservation(r.id);
    await expect(updateReservation(r.id, reservationInput(roomA.id))).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
  });
});

describe("availability and listing", () => {
  it("reports conflicts, excluding the reservation being edited", async () => {
    const r = await book(roomA, "10:00", "11:00");
    const startsAt = zonedToUtc(futureDate(), "10:30");
    const endsAt = zonedToUtc(futureDate(), "11:30");
    expect(await checkAvailability({ resourceId: roomA.id, startsAt, endsAt })).toMatchObject({
      available: false,
      reason: "CONFLICT",
    });
    expect(await checkAvailability({ resourceId: roomA.id, startsAt, endsAt, excludeId: r.id })).toMatchObject({
      available: true,
    });
  });

  it("filters by view and search", async () => {
    const kept = await book(roomA, "10:00", "11:00", { purpose: "Quarterly review" });
    const dropped = await book(roomB, "10:00", "11:00", { purpose: "Standup" });
    await cancelReservation(dropped.id);

    const upcoming = await listReservations({ view: "upcoming" });
    expect(upcoming.items.map((r) => r.id)).toEqual([kept.id]);

    const cancelled = await listReservations({ view: "cancelled" });
    expect(cancelled.items.map((r) => r.id)).toEqual([dropped.id]);

    const search = await listReservations({ view: "all", q: "quarterly" });
    expect(search.items.map((r) => r.id)).toEqual([kept.id]);

    const byDate = await listReservations({ view: "all", date: futureDate() });
    expect(byDate.total).toBe(2);
  });
});
