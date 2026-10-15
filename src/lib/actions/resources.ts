"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/errors";
import { createResource, setResourceActive, updateResource } from "@/lib/services/resources";

function revalidateResourceViews(id?: string) {
  revalidatePath("/");
  revalidatePath("/resources");
  revalidatePath("/reservations");
  revalidatePath("/calendar");
  if (id) revalidatePath(`/resources/${id}`);
}

export async function createResourceAction(values: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const resource = await createResource(values);
    revalidateResourceViews(resource.id);
    return { id: resource.id };
  });
}

export async function updateResourceAction(id: string, values: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const resource = await updateResource(id, values);
    revalidateResourceViews(resource.id);
    return { id: resource.id };
  });
}

export async function setResourceActiveAction(
  id: string,
  isActive: boolean,
): Promise<ActionResult<{ id: string; isActive: boolean }>> {
  return runAction(async () => {
    const resource = await setResourceActive(id, isActive);
    revalidateResourceViews(resource.id);
    return { id: resource.id, isActive: resource.isActive };
  });
}
