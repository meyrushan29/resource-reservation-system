import Link from "next/link";
import { CalendarClock, Pencil } from "lucide-react";
import { CancelReservationButton } from "@/components/reservations/cancel-reservation-button";
import { ReservationStatusBadge } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatReference } from "@/lib/utils/format";
import { formatDate, formatShortDate, formatTime } from "@/lib/utils/time";

export interface ReservationRow {
  id: string;
  number: number;
  requesterName: string;
  purpose: string;
  startsAt: Date;
  endsAt: Date;
  status: "CONFIRMED" | "CANCELLED";
  createdAt: Date;
  resource: { id: string; name: string };
}

function canModify(r: ReservationRow, now: Date) {
  return r.status === "CONFIRMED" && r.endsAt > now;
}

export function ReservationTable({
  items,
  showResource = true,
  showCreated = false,
  compact = false,
}: {
  items: ReservationRow[];
  showResource?: boolean;
  showCreated?: boolean;
  compact?: boolean;
}) {
  const now = new Date();
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {!compact && <TableHead className="pl-4">Reference</TableHead>}
              {showResource && <TableHead className={compact ? "pl-4" : undefined}>Resource</TableHead>}
              <TableHead>Requester</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>When</TableHead>
              <TableHead>Status</TableHead>
              {showCreated && <TableHead className="hidden 2xl:table-cell">Created</TableHead>}
              <TableHead className="pr-4 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => (
              <TableRow key={r.id} data-testid="reservation-row">
                {!compact && (
                  <TableCell className="pl-4 font-mono text-xs">
                    <Link href={`/reservations/${r.id}`} className="hover:underline">
                      {formatReference(r.number)}
                    </Link>
                  </TableCell>
                )}
                {showResource && (
                  <TableCell className={compact ? "pl-4 font-medium" : "font-medium"}>
                    <Link href={`/resources/${r.resource.id}`} className="hover:underline">
                      {r.resource.name}
                    </Link>
                  </TableCell>
                )}
                <TableCell>{r.requesterName}</TableCell>
                <TableCell className="max-w-48 truncate" title={r.purpose}>
                  {r.purpose}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className="block">{formatDate(r.startsAt)}</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {formatTime(r.startsAt)} – {formatTime(r.endsAt)}
                  </span>
                </TableCell>
                <TableCell>
                  <ReservationStatusBadge status={r.status} startsAt={r.startsAt} endsAt={r.endsAt} now={now} />
                </TableCell>
                {showCreated && (
                  <TableCell className="hidden whitespace-nowrap text-muted-foreground 2xl:table-cell">
                    {formatShortDate(r.createdAt)}
                  </TableCell>
                )}
                <TableCell className="pr-4 text-right">
                  <div className="flex justify-end gap-1">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/reservations/${r.id}`} aria-label={`View ${formatReference(r.number)}`}>
                        View
                      </Link>
                    </Button>
                    {canModify(r, now) && (
                      <>
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/reservations/${r.id}/edit`} aria-label={`Edit ${formatReference(r.number)}`}>
                            Edit
                          </Link>
                        </Button>
                        <CancelReservationButton
                          reservationId={r.id}
                          size="sm"
                          variant="ghost"
                          label="Cancel"
                          summary={`${r.resource.name}, ${formatDate(r.startsAt)} ${formatTime(r.startsAt)}–${formatTime(r.endsAt)}`}
                        />
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="grid gap-3 md:hidden">
        {items.map((r) => (
          <li key={r.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/reservations/${r.id}`} className="block truncate font-medium hover:underline">
                  {r.purpose}
                </Link>
                <p className="truncate text-sm text-muted-foreground">
                  {showResource ? `${r.resource.name} · ` : ""}
                  {r.requesterName}
                </p>
              </div>
              <ReservationStatusBadge status={r.status} startsAt={r.startsAt} endsAt={r.endsAt} now={now} />
            </div>
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm">
              <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
              {formatDate(r.startsAt)}, {formatTime(r.startsAt)} – {formatTime(r.endsAt)}
            </p>
            {canModify(r, now) && (
              <div className="mt-3 flex gap-2 border-t pt-3">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/reservations/${r.id}/edit`}>
                    <Pencil aria-hidden="true" /> Edit
                  </Link>
                </Button>
                <CancelReservationButton
                  reservationId={r.id}
                  size="sm"
                  label="Cancel"
                  summary={`${r.resource.name}, ${formatDate(r.startsAt)} ${formatTime(r.startsAt)}–${formatTime(r.endsAt)}`}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
