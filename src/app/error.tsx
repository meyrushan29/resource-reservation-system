"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Segment error boundary. Server errors reach the client without their message in production,
 * so we show a generic explanation (most often the database being unreachable) and a retry.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-center justify-center rounded-xl border bg-card px-6 py-14 text-center">
      <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" aria-hidden="true" />
      </span>
      <h1 className="font-semibold">We couldn&apos;t load this page</h1>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        The data service may be temporarily unavailable. Check that the database is running, then try again.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>}
      <Button className="mt-4" onClick={reset}>
        <RotateCcw aria-hidden="true" /> Try again
      </Button>
    </div>
  );
}
