import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, CalendarPlus, CircleSlash, ClipboardList, Pencil } from "lucide-react";
import { ResourceStatusToggle } from "@/components/resources/resource-status-toggle";
import { ReservationTable } from "@/components/reservations/reservation-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ResourceStatusBadge } from "@/components/shared/status-badges";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { countUpcomingReservations, getResource } from "@/lib/services/resources";
import { listReservations } from "@/lib/services/reservations";
import { formatDateTime } from "@/lib/utils/time";
import { RESOURCE_TYPE_LABELS } from "@/lib/validations/resource";

export const metadata: Metadata = { title: "Resource details" };
export const dynamic = "force-dynamic";

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default async function ResourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resource = await getResource(id);
  if (!resource) notFound();

  const [upcoming, upcomingCount] = await Promise.all([
    listReservations({ resourceId: resource.id, view: "upcoming" }),
    countUpcomingReservations(resource.id),
  ]);

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {resource.name} <ResourceStatusBadge isActive={resource.isActive} />
          </span>
        }
        description={RESOURCE_TYPE_LABELS[resource.type]}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Resources", href: "/resources" },
          { label: resource.name },
        ]}
        actions={
          <>
            {resource.isActive && (
              <Button asChild>
                <Link href={`/reservations/new?resourceId=${resource.id}`}>
                  <CalendarPlus aria-hidden="true" /> Book
                </Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href={`/resources/${resource.id}/edit`}>
                <Pencil aria-hidden="true" /> Edit
              </Link>
            </Button>
            <ResourceStatusToggle
              resourceId={resource.id}
              resourceName={resource.name}
              isActive={resource.isActive}
              upcomingCount={upcomingCount}
            />
          </>
        }
      />

      {!resource.isActive && (
        <Alert className="mb-6">
          <CircleSlash aria-hidden="true" />
          <AlertTitle>This resource is inactive</AlertTitle>
          <AlertDescription>
            It cannot receive new reservations. Existing reservations and history are kept. Activate it to allow
            bookings again.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4">
              <Detail label="Type">{RESOURCE_TYPE_LABELS[resource.type]}</Detail>
              <Detail label="Location">{resource.location ?? "Not specified"}</Detail>
              <Detail label="Capacity">{resource.capacity ? `${resource.capacity} people` : "Not applicable"}</Detail>
              <Detail label="Description">
                <span className="whitespace-pre-line">{resource.description ?? "No description"}</span>
              </Detail>
              <Detail label="Created">{formatDateTime(resource.createdAt)}</Detail>
              <Detail label="Last updated">{formatDateTime(resource.updatedAt)}</Detail>
            </dl>
          </CardContent>
        </Card>

        <section aria-labelledby="upcoming-heading" className="space-y-3 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="upcoming-heading" className="text-base font-semibold">
              Upcoming reservations
            </h2>
            <div className="flex gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href={`/calendar?resourceId=${resource.id}`}>
                  <CalendarDays aria-hidden="true" /> Calendar
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/reservations?view=all&resourceId=${resource.id}`}>
                  <ClipboardList aria-hidden="true" /> Full history
                </Link>
              </Button>
            </div>
          </div>
          {upcoming.items.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No upcoming reservations"
              description={resource.isActive ? "This resource is free for all future dates." : undefined}
            />
          ) : (
            <ReservationTable items={upcoming.items} showResource={false} compact />
          )}
          {upcoming.total > upcoming.items.length && (
            <p className="text-sm text-muted-foreground">
              Showing the next {upcoming.items.length} of {upcoming.total}.{" "}
              <Link className="underline" href={`/reservations?resourceId=${resource.id}`}>
                View all
              </Link>
            </p>
          )}
        </section>
      </div>
    </>
  );
}
