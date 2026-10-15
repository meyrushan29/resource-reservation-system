import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { HTTP_STATUS, toAppError } from "@/lib/errors";
import { checkAvailability, listResourceDaySchedule } from "@/lib/services/reservations";
import { toLocalDate } from "@/lib/utils/time";
import { availabilityQuerySchema } from "@/lib/validations/reservation";

export const dynamic = "force-dynamic";

/**
 * GET /api/availability?resourceId=&start=&end=[&excludeId=]
 * Informational availability for the reservation form. Submissions are always re-validated
 * on the server, where the database constraint is the final authority.
 */
export async function GET(request: NextRequest) {
  const parsed = availabilityQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid availability query.",
          fieldErrors: z.flattenError(parsed.error).fieldErrors,
        },
      },
      { status: 400 },
    );
  }
  try {
    const startsAt = new Date(parsed.data.start);
    const endsAt = new Date(parsed.data.end);
    const [result, schedule] = await Promise.all([
      checkAvailability({ resourceId: parsed.data.resourceId, startsAt, endsAt, excludeId: parsed.data.excludeId }),
      listResourceDaySchedule(parsed.data.resourceId, toLocalDate(startsAt)),
    ]);
    return NextResponse.json({
      ...result,
      schedule: schedule
        .filter((r) => r.id !== parsed.data.excludeId)
        .map((r) => ({ id: r.id, number: r.number, purpose: r.purpose, startsAt: r.startsAt, endsAt: r.endsAt })),
    });
  } catch (error) {
    const appError = toAppError(error);
    return NextResponse.json({ error: appError }, { status: HTTP_STATUS[appError.code] });
  }
}
