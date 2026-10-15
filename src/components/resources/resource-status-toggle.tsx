"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Power, PowerOff } from "lucide-react";
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
import { setResourceActiveAction } from "@/lib/actions/resources";

export function ResourceStatusToggle({
  resourceId,
  resourceName,
  isActive,
  upcomingCount,
  size = "default",
}: {
  resourceId: string;
  resourceName: string;
  isActive: boolean;
  upcomingCount: number;
  size?: "default" | "sm";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await setResourceActiveAction(resourceId, !isActive);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(result.data.isActive ? `${resourceName} activated` : `${resourceName} deactivated`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
      <AlertDialogTrigger asChild>
        <Button variant={isActive ? "outline" : "default"} size={size}>
          {isActive ? <PowerOff aria-hidden="true" /> : <Power aria-hidden="true" />}
          {isActive ? "Deactivate" : "Activate"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isActive ? `Deactivate ${resourceName}?` : `Activate ${resourceName}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isActive ? (
              <>
                New reservations will be blocked. Its reservation history stays intact.
                {upcomingCount > 0 && (
                  <>
                    {" "}
                    It has <strong>{upcomingCount}</strong> upcoming confirmed reservation
                    {upcomingCount === 1 ? "" : "s"}, which will remain in place. Cancel them separately if needed.
                  </>
                )}
              </>
            ) : (
              "The resource will become available for new reservations."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Keep as is</AlertDialogCancel>
          <Button onClick={confirm} disabled={isPending} variant={isActive ? "destructive" : "default"}>
            {isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {isActive ? "Deactivate" : "Activate"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
