import { expect, test } from "@playwright/test";

for (const size of [
  { width: 1280, height: 720 },
  { width: 375, height: 667 },
]) {
  test(`keeps host controls unchanged and positions the editor at ${size.width}px`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/entry.html");
    for (const id of ["host-button", "host-input"]) {
      expect((await page.getByTestId(id).boundingBox())?.height).toBe(24);
    }
    const trigger = page.getByRole("button", { name: "Save item" });
    await expect(trigger).toBeEnabled();
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Edit saved item" });
    await expect(dialog).toBeVisible();
    expect(await page.getByTestId("clipped-card").evaluate((card) => card.querySelector('[role="dialog"]'))).toBeNull();
    const box = await dialog.boundingBox();
    if (!box) throw new Error("Missing dialog bounds.");
    const viewport = page.viewportSize();
    if (!viewport) throw new Error("Missing viewport.");
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    await expect(dialog.getByRole("textbox", { name: "Note" })).toBeFocused();
  });
}

test("keeps the editor interactive inside a native modal", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/entry.html");
  await page.evaluate(() => {
    const card = document.querySelector('[data-testid="clipped-card"]');
    const theme = document.querySelector("[data-keep-theme]");
    if (!card || !theme) throw new Error("Missing fixture elements.");
    const modal = document.createElement("dialog");
    theme.append(modal);
    modal.append(card);
    modal.showModal();
  });
  await page.getByRole("button", { name: "Save item" }).click();
  const editor = page.getByRole("dialog", { name: "Edit saved item" });
  const note = editor.getByRole("textbox", { name: "Note" });
  await expect(note).toBeFocused();
  await note.fill("A note inside the modal");
  await expect(note).toHaveValue("A note inside the modal");
});

test("supports an explicit portal container", async ({ page }) => {
  await page.goto("/entry.html?customPortal");
  await page.getByRole("button", { name: "Save item" }).click();
  await expect(page.getByTestId("custom-portal").getByRole("dialog", { name: "Edit saved item" })).toBeVisible();
});

test("keeps the floating tour controls usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 667 });
  await page.goto("/entry.html");
  await page.getByRole("button", { name: "Save item" }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Start tour" }).click();
  const tour = page.locator('[data-keepkit="floating-tour"]');
  await expect(tour).toBeVisible();
  const box = await tour.boundingBox();
  expect(box?.width).toBeGreaterThan(280);
  for (const control of await tour.locator('[data-keep-action^="tour-"]').all()) {
    const bounds = await control.boundingBox();
    expect(bounds?.width).toBeGreaterThanOrEqual(40);
  }
});
