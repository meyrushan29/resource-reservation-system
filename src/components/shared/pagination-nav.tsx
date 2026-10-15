import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Link-based pagination that preserves the current filters in the query string. */
export function PaginationNav({
  basePath,
  searchParams,
  page,
  pageCount,
  total,
  pageSize,
}: {
  basePath: string;
  searchParams: Record<string, string | undefined>;
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
}) {
  if (total === 0) return null;
  const hrefFor = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) if (value && key !== "page") params.set(key, value);
    if (target > 1) params.set("page", String(target));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-3 pt-4 sm:flex-row">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Showing <span className="font-medium text-foreground">{from}</span>–
        <span className="font-medium text-foreground">{to}</span> of{" "}
        <span className="font-medium text-foreground">{total}</span>
      </p>
      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={hrefFor(page - 1)} aria-label="Previous page">
                <ChevronLeft aria-hidden="true" /> Previous
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled aria-label="Previous page">
              <ChevronLeft aria-hidden="true" /> Previous
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <Button asChild variant="outline" size="sm">
              <Link href={hrefFor(page + 1)} aria-label="Next page">
                Next <ChevronRight aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled aria-label="Next page">
              Next <ChevronRight aria-hidden="true" />
            </Button>
          )}
        </div>
      )}
    </nav>
  );
}
