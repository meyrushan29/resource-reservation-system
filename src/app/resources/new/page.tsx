import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ResourceForm } from "@/components/resources/resource-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Add resource" };

export default function NewResourcePage() {
  return (
    <>
      <PageHeader
        title="Add resource"
        description="Create a room, workspace or piece of equipment that people can reserve."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Resources", href: "/resources" },
          { label: "Add resource" },
        ]}
      />
      <Card className="max-w-2xl">
        <CardContent>
          <ResourceForm />
        </CardContent>
      </Card>
    </>
  );
}
