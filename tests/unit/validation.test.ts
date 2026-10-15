import { describe, expect, it } from "vitest";
import { resourceInputSchema } from "@/lib/validations/resource";
import { reservationInputSchema, toInterval } from "@/lib/validations/reservation";

const validResource = {
  name: "Meeting Room A",
  description: "",
  type: "MEETING_ROOM",
  location: "Level 2",
  capacity: "8",
  isActive: true,
};

const validReservation = {
  resourceId: "6f1f8a8e-2c7b-4c1e-9a55-2f1d3b8e9c10",
  requesterName: "Nadeesha Perera",
  requesterEmail: "",
  purpose: "Sprint planning",
  date: "2030-01-15",
  startTime: "10:00",
  endTime: "11:00",
};

function fieldErrors(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return result.error?.issues.map((i) => i.path.join(".")) ?? [];
}

describe("resourceInputSchema", () => {
  it("accepts valid data and normalises optional fields", () => {
    const result = resourceInputSchema.parse(validResource);
    expect(result).toMatchObject({ name: "Meeting Room A", description: null, capacity: 8 });
  });

  it("treats an empty capacity as no capacity", () => {
    expect(resourceInputSchema.parse({ ...validResource, capacity: "" }).capacity).toBeNull();
  });

  it.each([
    ["missing name", { name: "  " }, "name"],
    ["name too long", { name: "x".repeat(101) }, "name"],
    ["unknown type", { type: "SPACESHIP" }, "type"],
    ["zero capacity", { capacity: "0" }, "capacity"],
    ["negative capacity", { capacity: -3 }, "capacity"],
    ["fractional capacity", { capacity: "2.5" }, "capacity"],
    ["non-numeric capacity", { capacity: "ten" }, "capacity"],
    ["non-boolean status", { isActive: "yes" }, "isActive"],
    ["description too long", { description: "x".repeat(501) }, "description"],
  ])("rejects %s", (_label, override, field) => {
    const result = resourceInputSchema.safeParse({ ...validResource, ...override });
    expect(result.success).toBe(false);
    expect(fieldErrors(result)).toContain(field);
  });
});

describe("reservationInputSchema", () => {
  it("accepts a valid reservation", () => {
    expect(reservationInputSchema.safeParse(validReservation).success).toBe(true);
  });

  it.each([
    ["end before start", { startTime: "11:00", endTime: "10:00" }, "endTime"],
    ["end equal to start", { startTime: "10:00", endTime: "10:00" }, "endTime"],
    ["invalid calendar date", { date: "2030-02-30" }, "date"],
    ["malformed date", { date: "15/01/2030" }, "date"],
    ["malformed time", { startTime: "25:00" }, "startTime"],
    ["missing purpose", { purpose: "" }, "purpose"],
    ["missing requester", { requesterName: " " }, "requesterName"],
    ["invalid email", { requesterEmail: "not-an-email" }, "requesterEmail"],
    ["invalid resource id", { resourceId: "abc" }, "resourceId"],
  ])("rejects %s", (_label, override, field) => {
    const result = reservationInputSchema.safeParse({ ...validReservation, ...override });
    expect(result.success).toBe(false);
    expect(fieldErrors(result)).toContain(field);
  });
});

describe("toInterval", () => {
  it("interprets form times in Asia/Colombo (UTC+05:30) and stores UTC instants", () => {
    const { startsAt, endsAt } = toInterval(validReservation);
    expect(startsAt.toISOString()).toBe("2030-01-15T04:30:00.000Z");
    expect(endsAt.toISOString()).toBe("2030-01-15T05:30:00.000Z");
  });
});
