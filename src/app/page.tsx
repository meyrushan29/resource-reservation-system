import Link from "next/link";
import {
  Ban,
  Boxes,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  FilePlus2,
  PencilLine,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { ReservationTable } from "@/components/reservations/reservation-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { AvailabilityPill } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getDashboardStats,
  getRecentReservationChanges,
  getResourceAvailability,
  getUpcomingReservations,
} from "@/lib/services/dashboard";
import { formatReference } from "@/lib/utils/format";
import { formatDate, formatDateTime, formatTime, todayLocal, formatLocalDateLabel } from "@/lib/utils/time";
import { RESOURCE_TYPE_LABELS } from "@/lib/validations/resource";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
}: {
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      aria-label={`${label}: ${value}. ${hint}`}
    >
      <Card className="h-full transition-colors group-hover:ring-primary/30">
        <CardContent className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums" data-testid={`stat-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
              {value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </div>
          <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Icon className="size-4.5" aria-hidden="true" />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

function activityFor(r: { status: string; createdAt: Date; updatedAt: Date; cancelledAt: Date | null }) {
  if (r.status === "CANCELLED") return { label: "Cancelled", icon: Ban, at: r.cancelledAt ?? r.updatedAt };
  if (r.updatedAt.getTime() - r.createdAt.getTime() > 1000) return { label: "Updated", icon: PencilLine, at: r.updatedAt };
  return { label: "Created", icon: FilePlus2, at: r.createdAt };
}

export default async function DashboardPage() {
  const now = new Date();
  const [stats, upcoming, availability, recent] = await Promise.all([
    getDashboardStats(now),
    getUpcomingReservations(6, now),
    getResourceAvailability(now),
    getRecentReservationChanges(6),
  ]);
  const today = todayLocal(now);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Overview for ${formatLocalDateLabel(today, "EEEE, d MMMM yyyy")}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/resources/new">
                <Plus aria-hidden="true" /> Add resource
              </Link>
            </Button>
            <Button asChild>
              <Link href="/reservations/new">
                <CalendarPlus aria-hidden="true" /> Create reservation
              </Link>
            </Button>
          </>
        }
      />

      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total resources" value={stats.totalResources} hint="All rooms and equipment" icon={Boxes} href="/resources" />
        <StatCard
          label="Active resources"
          value={stats.activeResources}
          hint={`${stats.totalResources - stats.activeResources} inactive`}
          icon={CheckCircle2}
          href="/resources?status=active"
        />
        <StatCard
          label="Today's reservations"
          value={stats.todaysReservations}
          hint="Confirmed, any time today"
          icon={CalendarClock}
          href={`/reservations?view=all&status=CONFIRMED&date=${today}`}
        />
        <StatCard
          label="Upcoming reservations"
          value={stats.upcomingReservations}
          hint="Confirmed, not yet started"
          icon={ClipboardList}
          href="/reservations"
        />
        <StatCard
          label="Cancelled reservations"
          value={stats.cancelledReservations}
          hint="Kept for history"
          icon={Ban}
          href="/reservations?view=cancelled"
        />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section aria-labelledby="upcoming-heading" className="space-y-3 xl:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h2 id="upcoming-heading" className="text-base font-semibold">
              Upcoming reservations
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/reservations">View all</Link>
            </Button>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No upcoming reservations"
              description="New bookings will appear here."
              action={
                <Button asChild>
                  <Link href="/reservations/new">Create reservation</Link>
                </Button>
              }
            />
          ) : (
            <ReservationTable items={upcoming.map((r) => ({ ...r }))} compact />
          )}
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {[
              { href: "/reservations/new", label: "Create reservation", icon: CalendarPlus },
              { href: "/resources/new", label: "Add resource", icon: Plus },
              { href: "/calendar", label: "View calendar", icon: CalendarDays },
              { href: "/reservations?view=all", label: "View all reservations", icon: ClipboardList },
            ].map(({ href, label, icon: Icon }) => (
              <Button key={href} asChild variant="outline" className="h-10 justify-start">
                <Link href={href}>
                  <Icon aria-hidden="true" /> {label}
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Resource availability</CardTitle>
            <CardDescription>Right now ({formatTime(now)}), based on confirmed reservations</CardDescription>
          </CardHeader>
          <CardContent>
            {availability.length === 0 ? (
              <EmptyState icon={Boxes} title="No resources yet" description="Add resources to see their availability." />
            ) : (
              <ul className="divide-y" data-testid="availability-list">
                {availability.map(({ resource, state, bookingsLeftToday }) => (
                  <li key={resource.id} className="flex flex-col gap-1.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <Link href={`/resources/${resource.id}`} className="font-medium hover:underline">
                        {resource.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {RESOURCE_TYPE_LABELS[resource.type]}
                        {resource.location ? ` · ${resource.location}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-start gap-1 sm:items-end">
                      {state.kind === "inactive" && <AvailabilityPill kind="inactive">Inactive</AvailabilityPill>}
                      {state.kind === "in-use" && (
                        <AvailabilityPill kind="in-use">In use until {formatTime(state.nextFreeAt)}</AvailabilityPill>
                      )}
                      {state.kind === "available" && <AvailabilityPill kind="available">Available now</AvailabilityPill>}
                      {state.kind === "available" && (
                        <span className="text-xs text-muted-foreground">
                          {state.nextStartsAt
                            ? `Next booking today at ${formatTime(state.nextStartsAt)}`
                            : "No more bookings today"}
                        </span>
                      )}
                      {state.kind === "in-use" && bookingsLeftToday > 1 && (
                        <span className="text-xs text-muted-foreground">{bookingsLeftToday} bookings left today</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest reservation changes (from stored timestamps)</CardDescription>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reservations yet.</p>
            ) : (
              <ol className="grid gap-3">
                {recent.map((r) => {
                  const activity = activityFor(r);
                  const Icon = activity.icon;
                  return (
                    <li key={r.id} className="flex gap-3">
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Icon className="size-3.5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 text-sm">
                        <p className="truncate">
                          <span className="font-medium">{activity.label}</span>{" "}
                          <Link href={`/reservations/${r.id}`} className="font-mono text-xs hover:underline">
                            {formatReference(r.number)}
                          </Link>
                        </p>
                        <p className="truncate text-muted-foreground">
                          {r.resource.name} · {formatDate(r.startsAt)}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(activity.at)}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
