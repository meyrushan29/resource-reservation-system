import Link from "next/link";
import { cn } from "@/lib/utils";
import { assignLanes } from "@/lib/utils/calendar-layout";
import { formatReference } from "@/lib/utils/format";
import { formatTime, minutesIntoLocalDay, toLocalDate, zonedToUtc } from "@/lib/utils/time";

export interface CalendarReservation {
  id: string;
  number: number;
  purpose: string;
  requesterName: string;
  startsAt: Date;
  endsAt: Date;
  status: "CONFIRMED" | "CANCELLED";
  resource: { id: string; name: string };
}

export interface CalendarResource {
  id: string;
  name: string;
  isActive: boolean;
}

const HOUR_HEIGHT = 56; // px per hour
const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 21;

const pad = (n: number) => String(n).padStart(2, "0");

export function DayView({
  date,
  resources,
  reservations,
  now,
}: {
  date: string;
  resources: CalendarResource[];
  reservations: CalendarReservation[];
  now: Date;
}) {
  // Expand the visible window to include any reservation outside the default hours.
  let startHour = DEFAULT_START_HOUR;
  let endHour = DEFAULT_END_HOUR;
  for (const r of reservations) {
    startHour = Math.min(startHour, Math.floor(minutesIntoLocalDay(r.startsAt) / 60));
    const endMinutes = minutesIntoLocalDay(r.endsAt) || 24 * 60;
    endHour = Math.max(endHour, Math.ceil(endMinutes / 60));
  }
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const gridHeight = hours.length * HOUR_HEIGHT;
  const toTop = (minutes: number) => ((minutes - startHour * 60) / 60) * HOUR_HEIGHT;

  const nowMinutes = minutesIntoLocalDay(now);
  const isToday = toLocalDate(now) === date;

  return (
    <div className="overflow-x-auto rounded-xl border bg-card" role="region" aria-label="Day schedule" tabIndex={0}>
      <div className="grid min-w-max" style={{ gridTemplateColumns: `4rem repeat(${resources.length}, minmax(10rem, 1fr))` }}>
        {/* Header row */}
        <div className="sticky left-0 z-20 border-b bg-card" />
        {resources.map((resource) => (
          <div key={resource.id} className="border-b border-l px-3 py-2.5">
            <Link href={`/resources/${resource.id}`} className="block truncate text-sm font-medium hover:underline">
              {resource.name}
            </Link>
            {!resource.isActive && <span className="text-xs text-muted-foreground">Inactive</span>}
          </div>
        ))}

        {/* Time gutter */}
        <div className="sticky left-0 z-10 bg-card" style={{ height: gridHeight }} aria-hidden="true">
          {hours.map((h) => (
            <div key={h} className="relative border-b border-dashed text-right" style={{ height: HOUR_HEIGHT }}>
              <span className="absolute -top-2 right-2 text-xs text-muted-foreground tabular-nums">
                {h === startHour ? "" : `${pad(h)}:00`}
              </span>
            </div>
          ))}
        </div>

        {/* Resource columns */}
        {resources.map((resource) => {
          const items = reservations.filter((r) => r.resource.id === resource.id);
          return (
            <div key={resource.id} className="relative border-l" style={{ height: gridHeight }}>
              {hours.map((h) => {
                const slotStart = zonedToUtc(date, `${pad(h)}:00`);
                const bookable = resource.isActive && slotStart.getTime() + 60 * 60_000 > now.getTime();
                return bookable ? (
                  <Link
                    key={h}
                    href={`/reservations/new?resourceId=${resource.id}&date=${date}&start=${pad(h)}:00`}
                    className="block border-b border-dashed outline-none hover:bg-accent/60 focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
                    style={{ height: HOUR_HEIGHT }}
                    aria-label={`Book ${resource.name} at ${pad(h)}:00`}
                  />
                ) : (
                  <div key={h} className="border-b border-dashed bg-muted/30" style={{ height: HOUR_HEIGHT }} />
                );
              })}

              {assignLanes(items).map(({ item: r, lane, lanes }) => {
                const top = toTop(minutesIntoLocalDay(r.startsAt));
                const endMinutes = minutesIntoLocalDay(r.endsAt) || 24 * 60;
                const height = Math.max(toTop(endMinutes) - top, 22);
                const cancelled = r.status === "CANCELLED";
                return (
                  <Link
                    key={r.id}
                    href={`/reservations/${r.id}`}
                    data-testid="calendar-block"
                    className={cn(
                      "absolute z-10 overflow-hidden rounded-md border px-2 py-1 text-xs shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      cancelled
                        ? "border-dashed border-zinc-300 bg-zinc-50 text-zinc-500"
                        : "border-emerald-300 bg-emerald-50 text-emerald-950 hover:bg-emerald-100",
                    )}
                    style={{
                      top: top + 1,
                      height: height - 2,
                      left: `calc(${(lane / lanes) * 100}% + 3px)`,
                      width: `calc(${100 / lanes}% - 6px)`,
                    }}
                    aria-label={`${r.purpose}, ${r.resource.name}, ${formatTime(r.startsAt)} to ${formatTime(r.endsAt)}, ${cancelled ? "cancelled" : "confirmed"}`}
                  >
                    <p className={cn("truncate font-medium", cancelled && "line-through")}>{r.purpose}</p>
                    <p className="truncate tabular-nums">
                      {formatTime(r.startsAt)} – {formatTime(r.endsAt)}
                    </p>
                    {height > 56 && (
                      <p className="truncate text-[11px] opacity-80">
                        {r.requesterName} · {formatReference(r.number)}
                      </p>
                    )}
                    {cancelled && <p className="truncate font-medium">Cancelled</p>}
                  </Link>
                );
              })}

              {isToday && nowMinutes >= startHour * 60 && nowMinutes <= endHour * 60 && (
                <div
                  className="pointer-events-none absolute right-0 left-0 z-20 border-t-2 border-rose-500"
                  style={{ top: toTop(nowMinutes) }}
                  aria-hidden="true"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
