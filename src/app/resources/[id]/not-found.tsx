import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function ResourceNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Resource not found"
      description="It may have been removed, or the link is incorrect."
      action={
        <Button asChild variant="outline">
          <Link href="/resources">Back to resources</Link>
        </Button>
      }
    />
  );
}
