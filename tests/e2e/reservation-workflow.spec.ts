import { expect, test, type Page } from "@playwright/test";
import { addLocalDays, todayLocal } from "../../src/lib/utils/time";

test.describe.configure({ mode: "serial" });

const runId = Date.now().toString().slice(-6);
const resourceName = `E2E Room ${runId}`;
const otherResourceName = `E2E Projector ${runId}`;
const day = addLocalDays(todayLocal(), 7);

let resourceId = "";
let firstReservationUrl = "";

async function fillReservation(page: Page, values: { purpose: string; start: string; end: string; name?: string }) {
  await page.getByLabel("Requester name").fill(values.name ?? "E2E Tester");
  await page.getByLabel("Purpose").fill(values.purpose);
  await page.getByLabel("Date").fill(day);
  await page.getByLabel("Start time").fill(values.start);
  await page.getByLabel("End time").fill(values.end);
}

async function createResource(page: Page, name: string, type: string) {
  await page.goto("/resources/new");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Type").selectOption({ label: type });
  await page.getByLabel("Capacity").fill(type === "Equipment" ? "" : "6");
  await page.getByLabel("Location").fill("E2E floor");
  await page.getByRole("button", { name: "Create resource" }).click();
  await expect(page.getByText("Resource created")).toBeVisible();
  await expect(page).toHaveURL(/\/resources\/[0-9a-f-]{36}$/);
  return page.url().split("/").pop()!;
}

test("dashboard opens with live statistics", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  await expect(page.getByTestId("stat-total-resources")).toBeVisible();
  await expect(page.getByRole("link", { name: "Create reservation" }).first()).toBeVisible();
});

test("creates a resource and finds it in the list", async ({ page }) => {
  resourceId = await createResource(page, resourceName, "Meeting room");
  await createResource(page, otherResourceName, "Equipment");

  await page.goto("/resources");
  await page.getByLabel("Search").fill(resourceName);
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/q=E2E/);
  await expect(page.getByRole("link", { name: resourceName }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: otherResourceName })).toHaveCount(0);
});

test("validates resource input on the client", async ({ page }) => {
  await page.goto("/resources/new");
  await page.getByLabel("Capacity").fill("0");
  await page.getByRole("button", { name: "Create resource" }).click();
  await expect(page.getByText("Name is required")).toBeVisible();
  await expect(page.getByText("Capacity must be greater than zero")).toBeVisible();
});

test("creates a reservation", async ({ page }) => {
  await page.goto("/reservations/new");
  await page.getByLabel("Resource").selectOption({ label: `${resourceName} — E2E floor` });
  await fillReservation(page, { purpose: "E2E planning session", start: "10:00", end: "11:00" });
  await expect(page.getByTestId("availability-status")).toContainText("is available");
  await page.getByRole("button", { name: "Confirm reservation" }).click();
  await expect(page.getByText("Reservation confirmed")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("E2E planning session");
  firstReservationUrl = page.url();
});

test("rejects an overlapping reservation for the same resource", async ({ page }) => {
  await page.goto(`/reservations/new?resourceId=${resourceId}`);
  await fillReservation(page, { purpose: "Overlapping attempt", start: "10:30", end: "11:30" });
  await expect(page.getByTestId("availability-status")).toContainText("Conflicts with an existing booking");
  await page.getByRole("button", { name: "Confirm reservation" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Time slot unavailable" })).toBeVisible();
  await expect(page).toHaveURL(/\/reservations\/new/);
  // Entered values are preserved so the user can adjust them.
  await expect(page.getByLabel("Purpose")).toHaveValue("Overlapping attempt");
});

test("allows the same time on a different resource", async ({ page }) => {
  await page.goto("/reservations/new");
  await page.getByLabel("Resource").selectOption({ label: `${otherResourceName} — E2E floor` });
  await fillReservation(page, { purpose: "Projector for planning", start: "10:00", end: "11:00" });
  await page.getByRole("button", { name: "Confirm reservation" }).click();
  await expect(page.getByText("Reservation confirmed")).toBeVisible();
});

test("allows a back-to-back reservation", async ({ page }) => {
  await page.goto(`/reservations/new?resourceId=${resourceId}`);
  await fillReservation(page, { purpose: "Back-to-back follow-up", start: "11:00", end: "12:00" });
  await expect(page.getByTestId("availability-status")).toContainText("is available");
  await page.getByRole("button", { name: "Confirm reservation" }).click();
  await expect(page.getByText("Reservation confirmed")).toBeVisible();
});

test("edits a reservation without conflicting with itself", async ({ page }) => {
  await page.goto(firstReservationUrl);
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByLabel("Start time")).toHaveValue("10:00");
  await page.getByLabel("Start time").fill("09:30");
  await page.getByLabel("End time").fill("10:30");
  await page.getByLabel("Purpose").fill("E2E planning session (moved)");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Reservation updated")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("(moved)");
  await expect(page.getByText(/9:30 AM – 10:30 AM/)).toBeVisible();
});

test("cancels a reservation and releases the slot", async ({ page }) => {
  await page.goto(firstReservationUrl);
  await page.getByRole("button", { name: "Cancel reservation" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Cancel this reservation?");
  await dialog.getByRole("button", { name: "Cancel reservation" }).click();
  await expect(page.getByText("Reservation cancelled")).toBeVisible();
  await expect(page.getByText(/^Cancelled on/)).toBeVisible();

  // The released slot can now be booked again.
  await page.goto(`/reservations/new?resourceId=${resourceId}`);
  await fillReservation(page, { purpose: "Rebooked after cancellation", start: "09:30", end: "10:30" });
  await expect(page.getByTestId("availability-status")).toContainText("is available");
  await page.getByRole("button", { name: "Confirm reservation" }).click();
  await expect(page.getByText("Reservation confirmed")).toBeVisible();
});

test("calendar and reservation list reflect the changes", async ({ page }) => {
  await page.goto(`/calendar?date=${day}&resourceId=${resourceId}`);
  const blocks = page.getByTestId("calendar-block");
  await expect(blocks.filter({ hasText: "Rebooked after cancellation" })).toBeVisible();
  await expect(blocks.filter({ hasText: "Back-to-back follow-up" })).toBeVisible();
  await expect(blocks.filter({ hasText: "(moved)" })).toHaveCount(0);

  await page.getByLabel("Show cancelled").check();
  await expect(page).toHaveURL(/cancelled=1/);
  await expect(page.getByTestId("calendar-block").filter({ hasText: "(moved)" })).toContainText("Cancelled");

  await page.goto("/reservations?view=cancelled");
  await expect(page.getByRole("link", { name: "E2E planning session (moved)" }).or(page.getByText("E2E planning session (moved)")).first()).toBeVisible();
});

test("dashboard shows the new upcoming reservations", async ({ page }) => {
  await page.goto("/");
  const upcoming = page.getByRole("region", { name: "Upcoming reservations" }).or(page.locator("section[aria-labelledby='upcoming-heading']"));
  await expect(upcoming.getByText("Back-to-back follow-up").first()).toBeVisible();
  await expect(page.getByTestId("stat-upcoming-reservations")).not.toHaveText("0");
});

test("a deactivated resource cannot be booked", async ({ page }) => {
  await page.goto(`/resources/${resourceId}`);
  await page.getByRole("button", { name: "Deactivate" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Deactivate" }).click();
  await expect(page.getByText(`${resourceName} deactivated`)).toBeVisible();
  await expect(page.getByText("This resource is inactive")).toBeVisible();
  await expect(page.getByRole("link", { name: "Book" })).toHaveCount(0);

  await page.goto("/reservations/new");
  await expect(page.getByLabel("Resource").locator("option", { hasText: resourceName })).toHaveCount(0);
});
