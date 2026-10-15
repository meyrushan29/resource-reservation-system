import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listAllResourceOptions } from "@/lib/services/resources";
import { getReservation } from "@/lib/services/reservations";
import { formatReference } from "@/lib/utils/format";
import { toLocalDate, toLocalTime } from "@/lib/utils/time";

export const metadata: Metadata = { title: "Edit reservation" };
export const dynamic = "force-dynamic";

export default async function EditReservationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reservation = await getReservation(id);
  if (!reservation) notFound();

  const reference = formatReference(reservation.number);
  const breadcrumbs = [
    { label: "Dashboard", href: "/" },
    { label: "Reservations", href: "/reservations" },
    { label: reference, href: `/reservations/${reservation.id}` },
    { label: "Edit" },
  ];
  const locked =
    reservation.status === "CANCELLED"
      ? "Cancelled reservations cannot be edited."
      : reservation.endsAt <= new Date()
        ? "Past reservations cannot be edited."
        : null;

  if (locked) {
    return (
      <>
        <PageHeader title={`Edit ${reference}`} breadcrumbs={breadcrumbs} />
        <EmptyState
          icon={Lock}
          title="This reservation can't be edited"
          description={locked}
          action={
            <Button asChild variant="outline">
              <Link href={`/reservations/${reservation.id}`}>Back to reservation</Link>
            </Button>
          }
        />
      </>
    );
  }

  const resources = await listAllResourceOptions();

  return (
    <>
      <PageHeader
        title={`Edit ${reference}`}
        description="Changes are re-checked against other bookings. This reservation does not conflict with itself."
        breadcrumbs={breadcrumbs}
      />
      <Card>
        <CardContent>
          <ReservationForm
            reservationId={reservation.id}
            resources={resources}
            defaults={{
              resourceId: reservation.resourceId,
              requesterName: reservation.requesterName,
              requesterEmail: reservation.requesterEmail ?? "",
              purpose: reservation.purpose,
              date: toLocalDate(reservation.startsAt),
              startTime: toLocalTime(reservation.startsAt),
              endTime: toLocalTime(reservation.endsAt),
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
