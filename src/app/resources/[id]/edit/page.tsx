import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { ResourceForm } from "@/components/resources/resource-form";
import { Card, CardContent } from "@/components/ui/card";
import { getResource } from "@/lib/services/resources";

export const metadata: Metadata = { title: "Edit resource" };
export const dynamic = "force-dynamic";

export default async function EditResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resource = await getResource(id);
  if (!resource) notFound();

  return (
    <>
      <PageHeader
        title={`Edit ${resource.name}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Resources", href: "/resources" },
          { label: resource.name, href: `/resources/${resource.id}` },
          { label: "Edit" },
        ]}
      />
      <Card className="max-w-2xl">
        <CardContent>
          <ResourceForm
            resourceId={resource.id}
            defaults={{
              name: resource.name,
              description: resource.description ?? "",
              type: resource.type,
              location: resource.location ?? "",
              capacity: resource.capacity?.toString() ?? "",
              isActive: resource.isActive,
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
