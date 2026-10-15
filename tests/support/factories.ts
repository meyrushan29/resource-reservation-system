import { addLocalDays, todayLocal } from "@/lib/utils/time";

let counter = 0;

/** A local date safely in the future so "no past bookings" never interferes. */
export const futureDate = (daysAhead = 30) => addLocalDays(todayLocal(), daysAhead);

export function resourceInput(overrides: Record<string, unknown> = {}) {
  counter += 1;
  return {
    name: `Test Room ${counter}`,
    description: "Integration test resource",
    type: "MEETING_ROOM",
    location: "Level 1",
    capacity: 8,
    isActive: true,
    ...overrides,
  };
}

export function reservationInput(resourceId: string, overrides: Record<string, unknown> = {}) {
  return {
    resourceId,
    requesterName: "Test Requester",
    requesterEmail: "",
    purpose: "Integration test booking",
    date: futureDate(),
    startTime: "10:00",
    endTime: "11:00",
    ...overrides,
  };
}
