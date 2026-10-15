import { describe, expect, it } from "vitest";
import {
  findBlockingReservations,
  intervalsOverlap,
  isValidInterval,
  type BookedInterval,
} from "@/lib/utils/intervals";

const at = (hhmm: string) => new Date(`2030-01-15T${hhmm}:00+05:30`);
const slot = (start: string, end: string) => ({ startsAt: at(start), endsAt: at(end) });

const ROOM_A = "room-a";
const ROOM_B = "room-b";
const existing: BookedInterval = { id: "r1", resourceId: ROOM_A, status: "CONFIRMED", ...slot("10:00", "11:00") };

describe("isValidInterval", () => {
  it("accepts an end later than the start", () => {
    expect(isValidInterval(slot("10:00", "11:00"))).toBe(true);
  });

  it("rejects equal start and end", () => {
    expect(isValidInterval(slot("10:00", "10:00"))).toBe(false);
  });

  it("rejects an end before the start", () => {
    expect(isValidInterval(slot("11:00", "10:00"))).toBe(false);
  });

  it("rejects invalid dates", () => {
    expect(isValidInterval({ startsAt: new Date("nope"), endsAt: at("10:00") })).toBe(false);
  });
});

describe("overlap rules against an existing 10:00–11:00 booking", () => {
  const cases: [string, string, string, boolean][] = [
    ["ends exactly when existing starts (09:00–10:00)", "09:00", "10:00", false],
    ["identical slot (10:00–11:00)", "10:00", "11:00", true],
    ["overlaps the end (10:30–11:30)", "10:30", "11:30", true],
    ["fully inside (10:45–10:55)", "10:45", "10:55", true],
    ["starts exactly when existing ends (11:00–12:00)", "11:00", "12:00", false],
    ["fully contains existing (09:00–12:00)", "09:00", "12:00", true],
    ["overlaps the start (09:30–10:15)", "09:30", "10:15", true],
  ];

  it.each(cases)("%s", (_label, start, end, expected) => {
    expect(intervalsOverlap(existing, slot(start, end))).toBe(expected);
    const blocking = findBlockingReservations([existing], { resourceId: ROOM_A, ...slot(start, end) });
    expect(blocking.length > 0).toBe(expected);
  });
});

describe("findBlockingReservations", () => {
  it("allows the same time on a different resource", () => {
    expect(findBlockingReservations([existing], { resourceId: ROOM_B, ...slot("10:00", "11:00") })).toEqual([]);
  });

  it("ignores cancelled reservations", () => {
    const cancelled: BookedInterval = { ...existing, status: "CANCELLED" };
    expect(findBlockingReservations([cancelled], { resourceId: ROOM_A, ...slot("10:00", "11:00") })).toEqual([]);
  });

  it("excludes the reservation being edited from its own conflict check", () => {
    const request = { resourceId: ROOM_A, excludeId: "r1", ...slot("10:15", "11:15") };
    expect(findBlockingReservations([existing], request)).toEqual([]);
  });

  it("still detects other reservations while editing", () => {
    const other: BookedInterval = { id: "r2", resourceId: ROOM_A, status: "CONFIRMED", ...slot("11:00", "12:00") };
    const request = { resourceId: ROOM_A, excludeId: "r1", ...slot("10:30", "11:30") };
    expect(findBlockingReservations([existing, other], request).map((r) => r.id)).toEqual(["r2"]);
  });
});
