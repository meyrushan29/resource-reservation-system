"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cancelReservationAction } from "@/lib/actions/reservations";

export function CancelReservationButton({
  reservationId,
  summary,
  size = "default",
  variant = "outline",
  label = "Cancel reservation",
}: {
  reservationId: string;
  summary: string;
  size?: "default" | "sm";
  variant?: "outline" | "ghost" | "destructive";
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await cancelReservationAction(reservationId);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Reservation cancelled. The time slot is now available.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size} className="text-destructive hover:text-destructive">
          <Ban aria-hidden="true" />
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this reservation?</AlertDialogTitle>
          <AlertDialogDescription>
            {summary}. The reservation stays in the history as cancelled and the time slot becomes available to
            others. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Keep reservation</AlertDialogCancel>
          <Button variant="destructive" onClick={confirm} disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Cancel reservation
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
