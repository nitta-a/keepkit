import { expect, test } from "@playwright/test";

for (const css of ["theme", "tailwind"]) {
  test(`${css} resolves host colors and preserves them outside a local dark subtree`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(`/entry.html?${css}`);
    await page.addStyleTag({ content: "#root { --primary: 348 84% 44%; --foreground: 0 0% 12%; }" });
    const theme = page.locator("#root [data-keep-theme]").first();
    const trigger = page.getByRole("button", { name: "Save item" });
    await expect(theme).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(trigger).toHaveCSS("background-color", "rgb(37, 99, 235)");
    await page.addStyleTag({ content: "#root { --color-primary: rgb(10 20 30); }" });
    await expect(trigger).toHaveCSS("background-color", "rgb(10, 20, 30)");
    await expect(trigger).not.toHaveCSS("box-shadow", "none");
    await page.locator("#root").evaluate((root) => root.classList.add("dark"));
    await expect(theme).toHaveCSS("color", "rgb(226, 232, 240)");
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Edit saved item" });
    await expect(dialog).toHaveCSS("color", "rgb(226, 232, 240)");
    await expect(dialog).not.toHaveCSS("box-shadow", "none");
    await page.locator("#root").evaluate((root) => root.classList.remove("dark"));
    await expect(dialog).toHaveCSS("color", "rgb(15, 23, 42)");

    await page.goto(`/entry.html?${css}&hsl`);
    await page.addStyleTag({ content: "#root { --primary: 348 84% 44%; --primary-foreground: 0 0% 100%; }" });
    await expect(trigger).toHaveCSS("background-color", "rgb(206, 18, 56)");
    await expect(trigger).toHaveCSS("color", "rgb(255, 255, 255)");
    await trigger.focus();
    await expect(trigger).toHaveCSS("outline-color", "rgb(206, 18, 56)");
    await expect(theme).toHaveCSS("color", "rgb(15, 23, 42)");
  });
}

test("explicit modes, palette shadows and high contrast take precedence", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  for (const mode of ["light", "system"]) {
    await page.goto(`/entry.html?${mode}`);
    await page.locator("#root").evaluate((root) => root.classList.add("dark"));
    await expect(page.locator("#root [data-keep-theme]").first()).toHaveCSS("color", "rgb(15, 23, 42)");
  }
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("#root [data-keep-theme]").first()).toHaveCSS("color", "rgb(226, 232, 240)");
  await page.goto("/entry.html?ocean");
  const trigger = page.getByRole("button", { name: "Save item" });
  await page.addStyleTag({
    content:
      ".keep-theme { --keep-primary: #ff0000 } [data-testid=clipped-card] { box-shadow: var(--keep-card-shadow) }",
  });
  await expect(page.getByTestId("clipped-card")).toHaveCSS("box-shadow", /(?:255, 0, 0|srgb 1 0 0)/);
  await page.goto("/entry.html?contrast");
  await expect(trigger).toHaveCSS("background-color", "rgb(0, 55, 179)");
  await page.goto("/entry.html?nested&light");
  const preview = page.getByTestId("nested").getByText("Preview");
  await expect(preview).toHaveCSS("background-color", "rgb(255, 0, 0)");
  await expect(preview).toHaveCSS("color", "rgb(226, 232, 240)");
  await expect(trigger).toHaveCSS("background-color", "rgb(37, 99, 235)");
});

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
    if (size.width === 375) {
      expect(box.x).toBe(0);
      expect(box.width).toBe(size.width);
      expect(box.y + box.height).toBe(size.height);
    }
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
