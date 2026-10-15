import { Prisma } from "@prisma/client";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RESOURCE_INACTIVE"
  | "INVALID_STATE"
  | "DUPLICATE"
  | "DATABASE_UNAVAILABLE"
  | "INTERNAL_ERROR";

export type FieldErrors = Record<string, string[] | undefined>;

export interface AppErrorShape {
  code: ErrorCode;
  message: string;
  fieldErrors?: FieldErrors;
}

/** Consistent result type returned by every Server Action. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: AppErrorShape };

/** Expected, user-facing business errors. Messages are safe to show in the UI. */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RESOURCE_INACTIVE: 409,
  INVALID_STATE: 409,
  DUPLICATE: 409,
  DATABASE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

const OVERLAP_CONSTRAINT = "reservations_no_overlap";

/** True when an error is PostgreSQL's exclusion violation from the overlap constraint. */
export function isOverlapViolation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const text = `${error.message} ${JSON.stringify((error as { meta?: unknown }).meta ?? "")}`;
  return text.includes("23P01") || text.includes(OVERLAP_CONSTRAINT);
}

/**
 * Converts any thrown value into a safe, structured error. Raw database messages and
 * stack traces are logged on the server but never returned to the browser.
 */
export function toAppError(error: unknown): AppErrorShape {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message, fieldErrors: error.fieldErrors };
  }
  if (isOverlapViolation(error)) {
    return {
      code: "CONFLICT",
      message: "This resource is already booked for part of the selected time. Choose another time or resource.",
    };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        return { code: "DUPLICATE", message: "A record with the same unique value already exists." };
      case "P2003":
        return { code: "NOT_FOUND", message: "The referenced resource does not exist." };
      case "P2025":
        return { code: "NOT_FOUND", message: "The requested record was not found." };
    }
  }
  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError && ["P1001", "P1002", "P1017"].includes(error.code))
  ) {
    console.error("[database unavailable]", error);
    return { code: "DATABASE_UNAVAILABLE", message: "The database is currently unavailable. Please try again shortly." };
  }
  console.error("[unexpected error]", error);
  return { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." };
}

/** Runs a server operation and wraps the outcome in an ActionResult. */
export async function runAction<T>(operation: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    return { ok: false, error: toAppError(error) };
  }
}
