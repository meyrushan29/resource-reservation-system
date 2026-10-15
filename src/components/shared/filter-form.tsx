"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * GET form that keeps filters in the URL (shareable, back-button friendly).
 * Selects, checkboxes and date inputs apply immediately; text search applies on Enter or "Apply".
 */
export function FilterForm({
  children,
  hasFilters,
  preserve = {},
  label = "Filters",
  showApply = true,
}: {
  children: React.ReactNode;
  hasFilters: boolean;
  preserve?: Record<string, string | undefined>;
  label?: string;
  showApply?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function navigate(form: HTMLFormElement) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(preserve)) if (value) params.set(key, value);
    for (const [key, value] of new FormData(form).entries()) {
      if (typeof value === "string" && value.trim() !== "") params.set(key, value.trim());
    }
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  const clearHref = (() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(preserve)) if (value) params.set(key, value);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  })();

  return (
    <form
      role="search"
      aria-label={label}
      onSubmit={(event) => {
        event.preventDefault();
        navigate(event.currentTarget);
      }}
      onChange={(event) => {
        const target = event.target as HTMLElement;
        if (
          target instanceof HTMLSelectElement ||
          (target instanceof HTMLInputElement && (target.type === "date" || target.type === "checkbox"))
        ) {
          navigate(event.currentTarget);
        }
      }}
      className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-end"
    >
      {children}
      <div className="flex items-center gap-2">
        {showApply ? (
          <Button type="submit" variant="secondary" disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Apply
          </Button>
        ) : (
          isPending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Loading" />
        )}
        {hasFilters && (
          <Button asChild variant="ghost">
            <Link href={clearHref}>
              <X aria-hidden="true" /> Clear filters
            </Link>
          </Button>
        )}
      </div>
    </form>
  );
}
