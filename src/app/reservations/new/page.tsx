import type { Metadata } from "next";
import Link from "next/link";
import { Boxes } from "lucide-react";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listActiveResources } from "@/lib/services/resources";
import { firstValues, type RawSearchParams } from "@/lib/utils/search-params";
import { isValidDateString, isValidTimeString, todayLocal } from "@/lib/utils/time";

export const metadata: Metadata = { title: "New reservation" };
export const dynamic = "force-dynamic";

function addHour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return h >= 23 ? "23:59" : `${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default async function NewReservationPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = firstValues(await searchParams);
  const resources = await listActiveResources();
  const today = todayLocal();

  const date = params.date && isValidDateString(params.date) && params.date >= today ? params.date : today;
  const startTime = params.start && isValidTimeString(params.start) ? params.start : "";
  const resourceId = resources.some((r) => r.id === params.resourceId) ? params.resourceId! : "";

  return (
    <>
      <PageHeader
        title="New reservation"
        description="Book a resource for a specific time. Overlapping bookings are rejected automatically."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Reservations", href: "/reservations" },
          { label: "New reservation" },
        ]}
      />
      {resources.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No active resources"
          description="Add a resource or activate an existing one before creating reservations."
          action={
            <Button asChild>
              <Link href="/resources/new">Add resource</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent>
            <ReservationForm
              resources={resources.map((r) => ({ ...r, isActive: true }))}
              minDate={today}
              defaults={{
                resourceId,
                requesterName: "",
                requesterEmail: "",
                purpose: "",
                date,
                startTime,
                endTime: startTime ? addHour(startTime) : "",
              }}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}
