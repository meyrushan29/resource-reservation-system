import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import {
  createResource,
  getResource,
  listResources,
  setResourceActive,
  updateResource,
} from "@/lib/services/resources";
import { resourceInput } from "../support/factories";

describe("resource service (PostgreSQL)", () => {
  it("creates and reads a resource", async () => {
    const created = await createResource(resourceInput({ name: "Meeting Room A", capacity: "12" }));
    const loaded = await getResource(created.id);
    expect(loaded).toMatchObject({ name: "Meeting Room A", capacity: 12, isActive: true });
    expect(loaded?.createdAt).toBeInstanceOf(Date);
  });

  it("rejects invalid input with field errors", async () => {
    await expect(createResource(resourceInput({ name: "", capacity: 0 }))).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      fieldErrors: { name: expect.any(Array), capacity: expect.any(Array) },
    });
  });

  it("rejects duplicate names", async () => {
    await createResource(resourceInput({ name: "Projector 01" }));
    await expect(createResource(resourceInput({ name: "Projector 01" }))).rejects.toMatchObject({
      code: "DUPLICATE",
    });
  });

  it("updates a resource", async () => {
    const created = await createResource(resourceInput());
    const updated = await updateResource(created.id, resourceInput({ name: "Renamed Room", capacity: "" }));
    expect(updated).toMatchObject({ name: "Renamed Room", capacity: null });
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
  });

  it("returns NOT_FOUND when updating a missing resource", async () => {
    const missing = "00000000-0000-4000-8000-000000000000";
    await expect(updateResource(missing, resourceInput())).rejects.toBeInstanceOf(AppError);
    await expect(updateResource(missing, resourceInput())).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("deactivates and reactivates without deleting", async () => {
    const created = await createResource(resourceInput());
    expect((await setResourceActive(created.id, false)).isActive).toBe(false);
    expect((await setResourceActive(created.id, true)).isActive).toBe(true);
  });

  it("enforces the positive-capacity CHECK constraint in the database", async () => {
    const { db } = await import("@/lib/db");
    await expect(
      db.resource.create({ data: { name: "Bad capacity", type: "OTHER", capacity: -1 } }),
    ).rejects.toThrow();
  });

  it("searches, filters and paginates", async () => {
    for (let i = 1; i <= 12; i++) {
      await createResource(resourceInput({ name: `Laptop ${String(i).padStart(2, "0")}`, type: "EQUIPMENT" }));
    }
    const inactive = await createResource(resourceInput({ name: "Old Laptop", type: "EQUIPMENT", isActive: false }));

    const page1 = await listResources({ q: "laptop", type: "EQUIPMENT" });
    expect(page1.total).toBe(13);
    expect(page1.items).toHaveLength(10);
    expect(page1.pageCount).toBe(2);

    const inactiveOnly = await listResources({ status: "inactive" });
    expect(inactiveOnly.items.map((r) => r.id)).toEqual([inactive.id]);
  });
});
