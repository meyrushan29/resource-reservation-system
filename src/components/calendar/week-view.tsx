import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { addLocalDays, formatLocalDateLabel, formatTime, localDayRange } from "@/lib/utils/time";
import type { CalendarReservation } from "./day-view";

export function WeekView({
  weekStart,
  today,
  reservations,
  resourceId,
}: {
  weekStart: string;
  today: string;
  reservations: CalendarReservation[];
  resourceId?: string;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addLocalDays(weekStart, i));
  return (
    <div className="grid gap-3 md:grid-cols-7" role="region" aria-label="Week schedule">
      {days.map((day) => {
        const { start, end } = localDayRange(day);
        const items = reservations.filter((r) => r.startsAt < end && r.endsAt > start);
        const isToday = day === today;
        const isPast = day < today;
        const newHref = `/reservations/new?date=${day}${resourceId ? `&resourceId=${resourceId}` : ""}`;
        return (
          <section
            key={day}
            aria-label={formatLocalDateLabel(day, "EEEE d MMMM")}
            className={cn("flex min-h-40 flex-col rounded-xl border bg-card", isToday && "ring-2 ring-primary/40")}
          >
            <header className="flex items-center justify-between border-b px-3 py-2">
              <Link href={`/calendar?view=day&date=${day}${resourceId ? `&resourceId=${resourceId}` : ""}`} className="hover:underline">
                <span className="block text-xs text-muted-foreground uppercase">{formatLocalDateLabel(day, "EEE")}</span>
                <span className={cn("text-sm font-semibold", isToday && "text-primary")}>
                  {formatLocalDateLabel(day, "d MMM")}
                  {isToday && <span className="sr-only"> (today)</span>}
                </span>
              </Link>
              {!isPast && (
                <Link
                  href={newHref}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                  aria-label={`New reservation on ${formatLocalDateLabel(day)}`}
                >
                  <Plus className="size-4" aria-hidden="true" />
                </Link>
              )}
            </header>
            <ul className="grid flex-1 content-start gap-1.5 p-2">
              {items.length === 0 && <li className="px-1 py-2 text-xs text-muted-foreground">No reservations</li>}
              {items.map((r) => {
                const cancelled = r.status === "CANCELLED";
                return (
                  <li key={r.id}>
                    <Link
                      href={`/reservations/${r.id}`}
                      data-testid="calendar-block"
                      className={cn(
                        "block rounded-md border px-2 py-1.5 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        cancelled
                          ? "border-dashed border-zinc-300 bg-zinc-50 text-zinc-500"
                          : "border-emerald-200 bg-emerald-50 text-emerald-950 hover:bg-emerald-100",
                      )}
                    >
                      <span className="block font-medium tabular-nums">
                        {formatTime(r.startsAt)} – {formatTime(r.endsAt)}
                      </span>
                      <span className={cn("block truncate", cancelled && "line-through")}>{r.purpose}</span>
                      <span className="block truncate opacity-80">{r.resource.name}</span>
                      {cancelled && <span className="block font-medium">Cancelled</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
