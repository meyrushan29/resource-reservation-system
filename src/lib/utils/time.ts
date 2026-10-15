/**
 * Timezone helpers. All timestamps are stored in UTC (timestamptz); every date/time a
 * user enters or sees is interpreted in the organization timezone (default Asia/Colombo).
 * Never compare local date/time strings across days — convert to Date instants first.
 */
import { TZDate } from "@date-fns/tz";
import { addDays, format, isValid, parse } from "date-fns";

export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Colombo";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidDateString(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const parsed = parse(value, "yyyy-MM-dd", new Date());
  return isValid(parsed) && format(parsed, "yyyy-MM-dd") === value;
}

export function isValidTimeString(value: string): boolean {
  return TIME_RE.test(value);
}

/** Converts a local date ("2026-10-15") and time ("09:30") in the app timezone to a UTC instant. */
export function zonedToUtc(date: string, time: string, timeZone = APP_TIMEZONE): Date {
  if (!isValidDateString(date)) throw new Error(`Invalid date: ${date}`);
  if (!isValidTimeString(time)) throw new Error(`Invalid time: ${time}`);
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(new TZDate(y, m - 1, d, hh, mm, 0, 0, timeZone).getTime());
}

/** Formats a UTC instant in the app timezone using a date-fns pattern. */
export function formatInZone(instant: Date, pattern: string, timeZone = APP_TIMEZONE): string {
  return format(new TZDate(instant.getTime(), timeZone), pattern);
}

export const toLocalDate = (instant: Date) => formatInZone(instant, "yyyy-MM-dd");
export const toLocalTime = (instant: Date) => formatInZone(instant, "HH:mm");
export const formatDate = (instant: Date) => formatInZone(instant, "EEE, d MMM yyyy");
export const formatShortDate = (instant: Date) => formatInZone(instant, "d MMM yyyy");
export const formatTime = (instant: Date) => formatInZone(instant, "h:mm a");
export const formatDateTime = (instant: Date) => formatInZone(instant, "d MMM yyyy, h:mm a");

/** Today's date (yyyy-MM-dd) in the app timezone. */
export function todayLocal(now = new Date()): string {
  return toLocalDate(now);
}

/** Adds whole days to a local date string. */
export function addLocalDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return format(addDays(new Date(y, m - 1, d), days), "yyyy-MM-dd");
}

/** The UTC half-open range [start, end) covering a local calendar day. */
export function localDayRange(date: string): { start: Date; end: Date } {
  return { start: zonedToUtc(date, "00:00"), end: zonedToUtc(addLocalDays(date, 1), "00:00") };
}

/** Monday of the week containing the given local date. */
export function startOfLocalWeek(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = new Date(y, m - 1, d).getDay(); // 0 = Sunday
  return addLocalDays(date, weekday === 0 ? -6 : 1 - weekday);
}

/** Display label for a local date string, e.g. "Thu, 15 Oct 2026". */
export function formatLocalDateLabel(date: string, pattern = "EEE, d MMM yyyy"): string {
  const [y, m, d] = date.split("-").map(Number);
  return format(new Date(y, m - 1, d), pattern);
}

/** Minutes since local midnight for an instant. */
export function minutesIntoLocalDay(instant: Date): number {
  const tz = new TZDate(instant.getTime(), APP_TIMEZONE);
  return tz.getHours() * 60 + tz.getMinutes();
}
