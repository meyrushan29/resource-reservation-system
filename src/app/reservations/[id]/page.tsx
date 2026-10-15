import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, CircleSlash, Pencil } from "lucide-react";
import { CancelReservationButton } from "@/components/reservations/cancel-reservation-button";
import { PageHeader } from "@/components/shared/page-header";
import { ReservationStatusBadge } from "@/components/shared/status-badges";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getReservation } from "@/lib/services/reservations";
import { formatDuration, formatReference } from "@/lib/utils/format";
import { APP_TIMEZONE, formatDate, formatDateTime, formatTime, toLocalDate } from "@/lib/utils/time";
import { RESOURCE_TYPE_LABELS } from "@/lib/validations/resource";

export const metadata: Metadata = { title: "Reservation details" };
export const dynamic = "force-dynamic";

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default async function ReservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reservation = await getReservation(id);
  if (!reservation) notFound();

  const now = new Date();
  const reference = formatReference(reservation.number);
  const editable = reservation.status === "CONFIRMED" && reservation.endsAt > now;

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {reservation.purpose}
            <ReservationStatusBadge
              status={reservation.status}
              startsAt={reservation.startsAt}
              endsAt={reservation.endsAt}
              now={now}
            />
          </span>
        }
        description={<span className="font-mono">{reference}</span>}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Reservations", href: "/reservations" },
          { label: reference },
        ]}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/calendar?date=${toLocalDate(reservation.startsAt)}`}>
                <CalendarDays aria-hidden="true" /> View in calendar
              </Link>
            </Button>
            {editable && (
              <>
                <Button asChild variant="outline">
                  <Link href={`/reservations/${reservation.id}/edit`}>
                    <Pencil aria-hidden="true" /> Edit
                  </Link>
                </Button>
                <CancelReservationButton
                  reservationId={reservation.id}
                  summary={`${reservation.resource.name}, ${formatDate(reservation.startsAt)} ${formatTime(reservation.startsAt)}–${formatTime(reservation.endsAt)}`}
                />
              </>
            )}
          </>
        }
      />

      {reservation.status === "CANCELLED" && (
        <Alert className="mb-6">
          <CircleSlash aria-hidden="true" />
          <AlertTitle>Cancelled{reservation.cancelledAt ? ` on ${formatDateTime(reservation.cancelledAt)}` : ""}</AlertTitle>
          <AlertDescription>
            This reservation no longer blocks the resource. It is kept for historical records and cannot be edited.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Booking</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail label="Date">{formatDate(reservation.startsAt)}</Detail>
              <Detail label="Time">
                <span className="tabular-nums">
                  {formatTime(reservation.startsAt)} – {formatTime(reservation.endsAt)}
                </span>{" "}
                <span className="text-muted-foreground">({formatDuration(reservation.startsAt, reservation.endsAt)})</span>
              </Detail>
              <Detail label="Requester">{reservation.requesterName}</Detail>
              <Detail label="Email">
                {reservation.requesterEmail ? (
                  <a className="underline" href={`mailto:${reservation.requesterEmail}`}>
                    {reservation.requesterEmail}
                  </a>
                ) : (
                  "Not provided"
                )}
              </Detail>
              <Detail label="Timezone">{APP_TIMEZONE}</Detail>
              <Detail label="Reference">
                <span className="font-mono">{reference}</span>
              </Detail>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resource</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail label="Name">
                <Link className="font-medium underline-offset-4 hover:underline" href={`/resources/${reservation.resource.id}`}>
                  {reservation.resource.name}
                </Link>
                {!reservation.resource.isActive && <span className="text-muted-foreground"> (inactive)</span>}
              </Detail>
              <Detail label="Type">{RESOURCE_TYPE_LABELS[reservation.resource.type]}</Detail>
              <Detail label="Location">{reservation.resource.location ?? "Not specified"}</Detail>
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Record</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Detail label="Created">{formatDateTime(reservation.createdAt)}</Detail>
              <Detail label="Last updated">{formatDateTime(reservation.updatedAt)}</Detail>
              <Detail label="Cancelled">
                {reservation.cancelledAt ? formatDateTime(reservation.cancelledAt) : "—"}
              </Detail>
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
