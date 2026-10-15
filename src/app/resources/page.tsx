import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, MapPin, Plus, Users } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterForm } from "@/components/shared/filter-form";
import { PageHeader } from "@/components/shared/page-header";
import { PaginationNav } from "@/components/shared/pagination-nav";
import { ResourceStatusBadge } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listResources, RESOURCE_PAGE_SIZE } from "@/lib/services/resources";
import { firstValues, type RawSearchParams } from "@/lib/utils/search-params";
import { formatShortDate } from "@/lib/utils/time";
import { RESOURCE_TYPES, RESOURCE_TYPE_LABELS } from "@/lib/validations/resource";

export const metadata: Metadata = { title: "Resources" };
export const dynamic = "force-dynamic";

const SORT_OPTIONS = [
  { value: "name", label: "Name (A–Z)" },
  { value: "-name", label: "Name (Z–A)" },
  { value: "type", label: "Type" },
  { value: "-createdAt", label: "Newest first" },
  { value: "createdAt", label: "Oldest first" },
];

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const params = firstValues(await searchParams);
  const { items, total, page, pageCount, query } = await listResources(params);
  const hasFilters = Boolean(query.q || query.type || query.status);

  return (
    <>
      <PageHeader
        title="Resources"
        description="Rooms, equipment and spaces that can be reserved."
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Resources" }]}
        actions={
          <Button asChild>
            <Link href="/resources/new">
              <Plus aria-hidden="true" /> Add resource
            </Link>
          </Button>
        }
      />

      <FilterForm key={JSON.stringify(params)} hasFilters={hasFilters} label="Filter resources">
        <div className="grid gap-1.5 sm:w-64">
          <Label htmlFor="q">Search</Label>
          <Input id="q" name="q" type="search" placeholder="Search by name" defaultValue={query.q ?? ""} />
        </div>
        <div className="grid gap-1.5 sm:w-44">
          <Label htmlFor="type">Type</Label>
          <NativeSelect id="type" name="type" defaultValue={query.type ?? ""}>
            <option value="">All types</option>
            {RESOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {RESOURCE_TYPE_LABELS[t]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5 sm:w-36">
          <Label htmlFor="status">Status</Label>
          <NativeSelect id="status" name="status" defaultValue={query.status ?? ""}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </NativeSelect>
        </div>
        <div className="grid gap-1.5 sm:w-40">
          <Label htmlFor="sort">Sort by</Label>
          <NativeSelect id="sort" name="sort" defaultValue={query.sort}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </FilterForm>

      <section aria-label="Resource list" className="mt-4">
        {items.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title={hasFilters ? "No resources match these filters" : "No resources yet"}
            description={
              hasFilters ? "Try a different search or clear the filters." : "Add the rooms and equipment people can book."
            }
            action={
              !hasFilters && (
                <Button asChild>
                  <Link href="/resources/new">
                    <Plus aria-hidden="true" /> Add resource
                  </Link>
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Capacity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="pr-4 text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="pl-4 font-medium">
                        <Link href={`/resources/${r.id}`} className="hover:underline">
                          {r.name}
                        </Link>
                      </TableCell>
                      <TableCell>{RESOURCE_TYPE_LABELS[r.type]}</TableCell>
                      <TableCell className="text-muted-foreground">{r.location ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.capacity ?? "—"}</TableCell>
                      <TableCell>
                        <ResourceStatusBadge isActive={r.isActive} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatShortDate(r.createdAt)}</TableCell>
                      <TableCell className="pr-4 text-right">
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/resources/${r.id}`} aria-label={`View ${r.name}`}>
                              View
                            </Link>
                          </Button>
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/resources/${r.id}/edit`} aria-label={`Edit ${r.name}`}>
                              Edit
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="grid gap-3 md:hidden">
              {items.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/resources/${r.id}`}
                    className="block rounded-xl border bg-card p-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.name}</p>
                        <p className="text-sm text-muted-foreground">{RESOURCE_TYPE_LABELS[r.type]}</p>
                      </div>
                      <ResourceStatusBadge isActive={r.isActive} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {r.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3.5" aria-hidden="true" /> {r.location}
                        </span>
                      )}
                      {r.capacity && (
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3.5" aria-hidden="true" /> {r.capacity} people
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            <PaginationNav
              basePath="/resources"
              searchParams={params}
              page={page}
              pageCount={pageCount}
              total={total}
              pageSize={RESOURCE_PAGE_SIZE}
            />
          </>
        )}
      </section>
    </>
  );
}
