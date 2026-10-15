import { describe, expect, it } from "vitest";
import { assignLanes } from "@/lib/utils/calendar-layout";

const block = (id: string, start: string, end: string) => ({
  id,
  startsAt: new Date(`2030-01-15T${start}:00Z`),
  endsAt: new Date(`2030-01-15T${end}:00Z`),
});

const lanesById = (items: ReturnType<typeof block>[]) =>
  Object.fromEntries(assignLanes(items).map((l) => [l.item.id, [l.lane, l.lanes]]));

describe("assignLanes", () => {
  it("keeps back-to-back blocks in a single lane", () => {
    expect(lanesById([block("a", "09:00", "10:00"), block("b", "10:00", "11:00")])).toEqual({
      a: [0, 1],
      b: [0, 1],
    });
  });

  it("puts overlapping blocks side by side", () => {
    expect(lanesById([block("a", "09:00", "11:00"), block("b", "10:00", "12:00")])).toEqual({
      a: [0, 2],
      b: [1, 2],
    });
  });

  it("resets lanes after an overlapping cluster ends", () => {
    const result = lanesById([
      block("a", "09:00", "11:00"),
      block("b", "10:00", "11:00"),
      block("c", "13:00", "14:00"),
    ]);
    expect(result.c).toEqual([0, 1]);
  });
});
