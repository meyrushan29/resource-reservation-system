import { CheckCircle2, CircleSlash, Clock3, History, PauseCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Every badge pairs color with an icon and text so status never relies on color alone.
const tone = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  gray: "border-zinc-200 bg-zinc-100 text-zinc-700",
  red: "border-rose-200 bg-rose-50 text-rose-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  blue: "border-sky-200 bg-sky-50 text-sky-800",
} as const;

function StatusPill({
  className,
  icon: Icon,
  children,
}: {
  className: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center gap-1 rounded-full border px-2 text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {children}
    </span>
  );
}

export function ResourceStatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <StatusPill className={tone.green} icon={CheckCircle2}>
      Active
    </StatusPill>
  ) : (
    <StatusPill className={tone.gray} icon={PauseCircle}>
      Inactive
    </StatusPill>
  );
}

/** Reservation status, with "Completed" derived for confirmed bookings that have ended. */
export function ReservationStatusBadge({
  status,
  endsAt,
  startsAt,
  now = new Date(),
}: {
  status: "CONFIRMED" | "CANCELLED";
  startsAt?: Date;
  endsAt?: Date;
  now?: Date;
}) {
  if (status === "CANCELLED") {
    return (
      <StatusPill className={tone.red} icon={XCircle}>
        Cancelled
      </StatusPill>
    );
  }
  if (endsAt && endsAt <= now) {
    return (
      <StatusPill className={tone.gray} icon={History}>
        Completed
      </StatusPill>
    );
  }
  if (startsAt && endsAt && startsAt <= now && endsAt > now) {
    return (
      <StatusPill className={tone.blue} icon={Clock3}>
        In progress
      </StatusPill>
    );
  }
  return (
    <StatusPill className={tone.green} icon={CheckCircle2}>
      Confirmed
    </StatusPill>
  );
}

export function AvailabilityPill({
  kind,
  children,
}: {
  kind: "available" | "in-use" | "inactive";
  children: React.ReactNode;
}) {
  const map = {
    available: { className: tone.green, icon: CheckCircle2 },
    "in-use": { className: tone.amber, icon: Clock3 },
    inactive: { className: tone.gray, icon: CircleSlash },
  }[kind];
  return (
    <StatusPill className={map.className} icon={map.icon}>
      {children}
    </StatusPill>
  );
}
