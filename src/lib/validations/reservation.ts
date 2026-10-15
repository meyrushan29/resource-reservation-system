import { z } from "zod";
import { isValidDateString, isValidTimeString, zonedToUtc } from "@/lib/utils/time";

export const RESERVATION_STATUSES = ["CONFIRMED", "CANCELLED"] as const;
export type ReservationStatusValue = (typeof RESERVATION_STATUSES)[number];

export const RESERVATION_STATUS_LABELS: Record<ReservationStatusValue, string> = {
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
};

/**
 * Reservation form input. Date and times are local to the organization timezone.
 * Both times are on the same date, so cross-midnight bookings are impossible by design;
 * the latest possible end time is 23:59.
 */
export const reservationInputSchema = z
  .object({
    resourceId: z.uuid({ error: "Select a resource" }),
    requesterName: z
      .string({ error: "Requester name is required" })
      .trim()
      .min(2, "Requester name must be at least 2 characters")
      .max(100, "Requester name must be 100 characters or fewer"),
    requesterEmail: z
      .union([z.literal(""), z.email("Enter a valid email address").max(254)])
      .nullish()
      .transform((value) => (value ? value.toLowerCase() : null)),
    purpose: z
      .string({ error: "Purpose is required" })
      .trim()
      .min(3, "Purpose must be at least 3 characters")
      .max(200, "Purpose must be 200 characters or fewer"),
    date: z
      .string({ error: "Date is required" })
      .refine(isValidDateString, "Enter a valid date"),
    startTime: z
      .string({ error: "Start time is required" })
      .refine(isValidTimeString, "Enter a valid start time"),
    endTime: z
      .string({ error: "End time is required" })
      .refine(isValidTimeString, "Enter a valid end time"),
  })
  .refine(
    (v) => !isValidTimeString(v.startTime) || !isValidTimeString(v.endTime) || v.endTime > v.startTime,
    { path: ["endTime"], message: "End time must be later than start time" },
  );

export type ReservationInput = z.output<typeof reservationInputSchema>;
export type ReservationFormValues = z.input<typeof reservationInputSchema>;

/** Converts validated local input into the UTC interval [startsAt, endsAt). */
export function toInterval(input: Pick<ReservationInput, "date" | "startTime" | "endTime">) {
  return {
    startsAt: zonedToUtc(input.date, input.startTime),
    endsAt: zonedToUtc(input.date, input.endTime),
  };
}

export const reservationIdSchema = z.uuid({ error: "Invalid reservation ID" });

export const RESERVATION_VIEWS = ["upcoming", "past", "cancelled", "all"] as const;
export type ReservationView = (typeof RESERVATION_VIEWS)[number];

export const reservationListQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  resourceId: z.uuid().optional().catch(undefined),
  date: z.string().refine(isValidDateString).optional().catch(undefined),
  status: z.enum(RESERVATION_STATUSES).optional().catch(undefined),
  view: z.enum(RESERVATION_VIEWS).default("upcoming").catch("upcoming"),
  page: z.coerce.number().int().min(1).default(1).catch(1),
});

export type ReservationListQuery = z.output<typeof reservationListQuerySchema>;

/** Query for the availability endpoint; times are ISO-8601 instants. */
export const availabilityQuerySchema = z
  .object({
    resourceId: z.uuid({ error: "Invalid resource ID" }),
    start: z.iso.datetime({ offset: true, error: "start must be an ISO-8601 timestamp" }),
    end: z.iso.datetime({ offset: true, error: "end must be an ISO-8601 timestamp" }),
    excludeId: z.uuid().optional(),
  })
  .refine((v) => new Date(v.end) > new Date(v.start), {
    path: ["end"],
    message: "end must be later than start",
  });
