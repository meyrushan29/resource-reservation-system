import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { ReservationTable } from "@/components/reservations/reservation-table";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterForm } from "@/components/shared/filter-form";
import { PageHeader } from "@/components/shared/page-header";
import { PaginationNav } from "@/components/shared/pagination-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { listAllResourceOptions } from "@/lib/services/resources";
import { listReservations, RESERVATION_PAGE_SIZE } from "@/lib/services/reservations";
import { cn } from "@/lib/utils";
import { firstValues, type RawSearchParams } from "@/lib/utils/search-params";
import { RESERVATION_STATUS_LABELS, RESERVATION_STATUSES, type ReservationView } from "@/lib/validations/reservation";

export const metadata: Metadata = { title: "Reservations" };
export const dynamic = "force-dynamic";

const VIEWS: { value: ReservationView; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

const EMPTY_COPY: Record<ReservationView, string> = {
  upcoming: "No upcoming reservations",
  past: "No past reservations",
  cancelled: "No cancelled reservations",
  all: "No reservations yet",
};

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = firstValues(await searchParams);
  const [{ items, total, page, pageCount, query }, resources] = await Promise.all([
    listReservations(params),
    listAllResourceOptions(),
  ]);
  const hasFilters = Boolean(query.q || query.resourceId || query.date || query.status);

  const viewHref = (view: ReservationView) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value && key !== "page" && key !== "view") next.set(key, value);
    if (view !== "upcoming") next.set("view", view);
    const qs = next.toString();
    return qs ? `/reservations?${qs}` : "/reservations";
  };

  return (
    <>
      <PageHeader
        title="Reservations"
        description="Search, review and manage bookings across all resources."
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Reservations" }]}
        actions={
          <Button asChild>
            <Link href="/reservations/new">
              <Plus aria-hidden="true" /> New reservation
            </Link>
          </Button>
        }
      />

      <nav aria-label="Reservation views" className="mb-4 overflow-x-auto">
        <ul className="inline-flex gap-1 rounded-lg bg-muted p-1">
          {VIEWS.map((v) => {
            const active = query.view === v.value;
            return (
              <li key={v.value}>
                <Link
                  href={viewHref(v.value)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                    active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {v.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <FilterForm
        key={JSON.stringify(params)}
        hasFilters={hasFilters}
        preserve={{ view: query.view === "upcoming" ? undefined : query.view }}
        label="Filter reservations"
      >
        <div className="grid gap-1.5 sm:w-64">
          <Label htmlFor="q">Search</Label>
          <Input
            id="q"
            name="q"
            type="search"
            placeholder="Purpose, requester, resource or RSV-…"
            defaultValue={query.q ?? ""}
          />
        </div>
        <div className="grid gap-1.5 sm:w-52">
          <Label htmlFor="resourceId">Resource</Label>
          <NativeSelect id="resourceId" name="resourceId" defaultValue={query.resourceId ?? ""}>
            <option value="">All resources</option>
            {resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.isActive ? "" : " (inactive)"}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5 sm:w-44">
          <Label htmlFor="date">Date</Label>
          <Input id="date" name="date" type="date" defaultValue={query.date ?? ""} />
        </div>
        {query.view === "all" && (
          <div className="grid gap-1.5 sm:w-36">
            <Label htmlFor="status">Status</Label>
            <NativeSelect id="status" name="status" defaultValue={query.status ?? ""}>
              <option value="">Any status</option>
              {RESERVATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {RESERVATION_STATUS_LABELS[s]}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
      </FilterForm>

      <section aria-label="Reservation list" className="mt-4">
        {items.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={hasFilters ? "No reservations match these filters" : EMPTY_COPY[query.view]}
            description={hasFilters ? "Try a different search, date or resource." : undefined}
            action={
              !hasFilters && (
                <Button asChild>
                  <Link href="/reservations/new">
                    <Plus aria-hidden="true" /> New reservation
                  </Link>
                </Button>
              )
            }
          />
        ) : (
          <>
            <ReservationTable items={items} showCreated />
            <PaginationNav
              basePath="/reservations"
              searchParams={params}
              page={page}
              pageCount={pageCount}
              total={total}
              pageSize={RESERVATION_PAGE_SIZE}
            />
          </>
        )}
      </section>
    </>
  );
}
