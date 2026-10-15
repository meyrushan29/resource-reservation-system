import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, CalendarX2, ChevronLeft, ChevronRight } from "lucide-react";
import { DayView } from "@/components/calendar/day-view";
import { WeekView } from "@/components/calendar/week-view";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterForm } from "@/components/shared/filter-form";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { listAllResourceOptions } from "@/lib/services/resources";
import { listReservationsInRange } from "@/lib/services/reservations";
import { cn } from "@/lib/utils";
import { firstValues, type RawSearchParams } from "@/lib/utils/search-params";
import {
  addLocalDays,
  formatLocalDateLabel,
  isValidDateString,
  localDayRange,
  startOfLocalWeek,
  todayLocal,
} from "@/lib/utils/time";

export const metadata: Metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = firstValues(await searchParams);
  const now = new Date();
  const today = todayLocal(now);
  const view = params.view === "week" ? "week" : "day";
  const date = params.date && isValidDateString(params.date) ? params.date : today;
  const showCancelled = params.cancelled === "1";

  const allResources = await listAllResourceOptions();
  const resourceId = allResources.some((r) => r.id === params.resourceId) ? params.resourceId : undefined;

  const rangeStartDate = view === "week" ? startOfLocalWeek(date) : date;
  const rangeEndDate = addLocalDays(rangeStartDate, view === "week" ? 7 : 1);
  const reservations = await listReservationsInRange({
    start: localDayRange(rangeStartDate).start,
    end: localDayRange(rangeEndDate).start,
    resourceId,
    includeCancelled: showCancelled,
  });

  // Day view columns: the selected resource, or active resources plus any inactive one with bookings that day.
  const bookedIds = new Set(reservations.map((r) => r.resource.id));
  const columns = allResources.filter((r) => (resourceId ? r.id === resourceId : r.isActive || bookedIds.has(r.id)));

  const step = view === "week" ? 7 : 1;
  const hrefFor = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { view, date, resourceId, cancelled: showCancelled ? "1" : undefined, ...overrides };
    for (const [key, value] of Object.entries(merged)) if (value) next.set(key, value);
    return `/calendar?${next.toString()}`;
  };

  const title =
    view === "week"
      ? `${formatLocalDateLabel(rangeStartDate, "d MMM")} – ${formatLocalDateLabel(addLocalDays(rangeStartDate, 6), "d MMM yyyy")}`
      : formatLocalDateLabel(date, "EEEE, d MMMM yyyy");

  return (
    <>
      <PageHeader
        title="Calendar"
        description="See bookings by day or week. Select an empty slot to book it."
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Calendar" }]}
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button asChild variant="outline" size="icon">
              <Link href={hrefFor({ date: addLocalDays(date, -step) })} aria-label={`Previous ${view}`}>
                <ChevronLeft />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={hrefFor({ date: today })}>Today</Link>
            </Button>
            <Button asChild variant="outline" size="icon">
              <Link href={hrefFor({ date: addLocalDays(date, step) })} aria-label={`Next ${view}`}>
                <ChevronRight />
              </Link>
            </Button>
          </div>
          <h2 className="text-lg font-semibold" aria-live="polite">
            {title}
          </h2>
        </div>
        <nav aria-label="Calendar view" className="inline-flex w-fit gap-1 rounded-lg bg-muted p-1">
          {(["day", "week"] as const).map((v) => (
            <Link
              key={v}
              href={hrefFor({ view: v })}
              aria-current={view === v ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium capitalize outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                view === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mb-4">
        <FilterForm
          key={JSON.stringify(params)}
          hasFilters={Boolean(resourceId || showCancelled)}
          preserve={{ view }}
          showApply={false}
          label="Calendar options"
        >
          <div className="grid gap-1.5 sm:w-44">
            <Label htmlFor="date">Go to date</Label>
            <Input id="date" name="date" type="date" defaultValue={date} />
          </div>
          <div className="grid gap-1.5 sm:w-56">
            <Label htmlFor="resourceId">Resource</Label>
            <NativeSelect id="resourceId" name="resourceId" defaultValue={resourceId ?? ""}>
              <option value="">All resources</option>
              {allResources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.isActive ? "" : " (inactive)"}
                </option>
              ))}
            </NativeSelect>
          </div>
          <label className="flex h-9 items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="cancelled"
              value="1"
              defaultChecked={showCancelled}
              className="size-4 accent-[var(--primary)]"
            />
            Show cancelled
          </label>
        </FilterForm>
      </div>

      {allResources.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No resources yet"
          description="Add resources to start scheduling."
          action={
            <Button asChild>
              <Link href="/resources/new">Add resource</Link>
            </Button>
          }
        />
      ) : view === "week" ? (
        <>
          {reservations.length === 0 && (
            <p className="mb-3 text-sm text-muted-foreground">No reservations this week.</p>
          )}
          <WeekView weekStart={rangeStartDate} today={today} reservations={reservations} resourceId={resourceId} />
        </>
      ) : columns.length === 0 ? (
        <EmptyState icon={CalendarX2} title="No active resources" description="Activate a resource to schedule it." />
      ) : (
        <>
          {reservations.length === 0 && (
            <p className="mb-3 text-sm text-muted-foreground" role="status">
              No reservations on this day — every resource below is free. Select a slot to book it.
            </p>
          )}
          <DayView date={date} resources={columns} reservations={reservations} now={now} />
        </>
      )}
    </>
  );
}
