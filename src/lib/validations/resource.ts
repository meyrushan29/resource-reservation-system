import { z } from "zod";

export const RESOURCE_TYPES = [
  "MEETING_ROOM",
  "CONFERENCE_ROOM",
  "TRAINING_ROOM",
  "WORKSPACE",
  "EQUIPMENT",
  "OTHER",
] as const;

export type ResourceTypeValue = (typeof RESOURCE_TYPES)[number];

export const RESOURCE_TYPE_LABELS: Record<ResourceTypeValue, string> = {
  MEETING_ROOM: "Meeting room",
  CONFERENCE_ROOM: "Conference room",
  TRAINING_ROOM: "Training room",
  WORKSPACE: "Workspace",
  EQUIPMENT: "Equipment",
  OTHER: "Other",
};

export const MAX_CAPACITY = 10_000;

/** Trims a string and turns empty input into null. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .nullish()
    .transform((value) => (value ? value : null));

/**
 * Shared by the client form (immediate feedback) and the server action (authoritative check).
 * Form inputs are strings, so capacity accepts "" / string / number and normalises to int | null.
 */
export const resourceInputSchema = z.object({
  name: z
    .string({ error: "Name is required" })
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or fewer"),
  description: optionalText(500, "Description"),
  type: z.enum(RESOURCE_TYPES, { error: "Select a valid resource type" }),
  location: optionalText(100, "Location"),
  capacity: z.preprocess(
    (value) => {
      if (value === "" || value === null || value === undefined) return null;
      if (typeof value === "string") return value.trim() === "" ? null : Number(value);
      return value;
    },
    z
      .number({ error: "Capacity must be a number" })
      .int("Capacity must be a whole number")
      .positive("Capacity must be greater than zero")
      .max(MAX_CAPACITY, `Capacity must be ${MAX_CAPACITY.toLocaleString()} or less`)
      .nullable(),
  ),
  isActive: z.boolean({ error: "Status must be active or inactive" }),
});

export type ResourceInput = z.output<typeof resourceInputSchema>;
export type ResourceFormValues = z.input<typeof resourceInputSchema>;

export const resourceIdSchema = z.uuid({ error: "Invalid resource ID" });

export const RESOURCE_SORTS = ["name", "-name", "type", "-createdAt", "createdAt"] as const;

export const resourceListQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  type: z.enum(RESOURCE_TYPES).optional().catch(undefined),
  status: z.enum(["active", "inactive"]).optional().catch(undefined),
  sort: z.enum(RESOURCE_SORTS).default("name").catch("name"),
  page: z.coerce.number().int().min(1).default(1).catch(1),
});

export type ResourceListQuery = z.output<typeof resourceListQuerySchema>;
