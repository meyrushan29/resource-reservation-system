import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function ReservationNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Reservation not found"
      description="Check the link or search the reservation list."
      action={
        <Button asChild variant="outline">
          <Link href="/reservations">Back to reservations</Link>
        </Button>
      }
    />
  );
}
