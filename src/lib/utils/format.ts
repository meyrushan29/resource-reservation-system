/** Display reference for a reservation's sequential number, e.g. RSV-000042. */
export function formatReference(number: number): string {
  return `RSV-${String(number).padStart(6, "0")}`;
}

/** Duration in minutes formatted as "1 h 30 min". */
export function formatDuration(startsAt: Date, endsAt: Date): string {
  const minutes = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ") || "0 min";
}
