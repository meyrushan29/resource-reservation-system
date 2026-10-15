import { describe, expect, it } from "vitest";
import {
  addLocalDays,
  isValidDateString,
  localDayRange,
  startOfLocalWeek,
  toLocalDate,
  toLocalTime,
  zonedToUtc,
} from "@/lib/utils/time";

describe("time utilities (Asia/Colombo)", () => {
  it("round-trips a local date and time", () => {
    const instant = zonedToUtc("2030-06-01", "23:30");
    expect(instant.toISOString()).toBe("2030-06-01T18:00:00.000Z");
    expect(toLocalDate(instant)).toBe("2030-06-01");
    expect(toLocalTime(instant)).toBe("23:30");
  });

  it("maps an early-morning UTC instant to the correct local day", () => {
    expect(toLocalDate(new Date("2030-06-01T20:00:00Z"))).toBe("2030-06-02");
  });

  it("builds a half-open UTC range for a local day", () => {
    const { start, end } = localDayRange("2030-06-01");
    expect(start.toISOString()).toBe("2030-05-31T18:30:00.000Z");
    expect(end.toISOString()).toBe("2030-06-01T18:30:00.000Z");
  });

  it("validates real calendar dates only", () => {
    expect(isValidDateString("2028-02-29")).toBe(true);
    expect(isValidDateString("2030-02-29")).toBe(false);
  });

  it("handles month boundaries and week starts", () => {
    expect(addLocalDays("2030-01-31", 1)).toBe("2030-02-01");
    expect(startOfLocalWeek("2030-01-20")).toBe("2030-01-14"); // Sunday -> Monday
    expect(startOfLocalWeek("2030-01-14")).toBe("2030-01-14");
  });
});
