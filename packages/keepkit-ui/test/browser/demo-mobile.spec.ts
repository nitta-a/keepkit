import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://**/*", (route) => route.abort());
});

for (const width of [320, 360, 390, 768, 1024]) {
  test(`demo fits a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Your saves" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

for (const width of [390, 1280]) {
  test(`saves a URL and recovers from an empty search at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page
      .getByRole("button", { name: /Add a link/ })
      .first()
      .click();
    await expect(page.getByLabel("Title (optional)")).toBeHidden();
    await page.getByLabel("URL", { exact: true }).fill("https://example.com/first");
    await page.getByRole("button", { name: "Save link", exact: true }).click();
    const link = page.getByRole("link", { name: /example.com/ }).first();
    await expect(link).toHaveAttribute("href", "https://example.com/first");
    await expect(page.getByText(/Link saved\. Find it below/)).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("searchbox").fill("example.com");
    await expect(link).toBeVisible();
    await page.getByRole("searchbox").fill("nothing matches");
    await page.getByRole("button", { name: "Clear filters", exact: true }).click();
    await expect(link).toBeVisible();
  });
}

test("resaving a URL preserves its details and does not create a duplicate after reload", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: /Add a link/ })
    .first()
    .click();
  await page.getByLabel("URL", { exact: true }).fill("https://example.com/reference");
  await page.getByText("Add details").click();
  await page.getByLabel("Title (optional)").fill("Reference title");
  await page.getByLabel("Note (optional)").fill("Keep this note");
  await page.getByLabel("Tags (optional)").fill("research");
  await page.getByLabel("Collection (optional)").selectOption("__new__");
  await page.getByLabel("New collection name").fill("Research");
  await page.getByRole("button", { name: "Save link", exact: true }).click();
  await expect(page.getByRole("link", { name: "Reference title" })).toBeVisible();

  await page.reload({ waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: /Add a link/ })
    .first()
    .click();
  await page.getByLabel("URL", { exact: true }).fill("https://example.com/reference");
  await expect(page.getByText(/already saved/)).toBeVisible();
  await page.getByRole("button", { name: "Save link", exact: true }).click();
  await page.reload({ waitUntil: "domcontentloaded" });

  const cards = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: "Reference title" }) });
  await expect(cards).toHaveCount(1);
  await expect(cards.getByRole("link", { name: "Reference title" })).toHaveAttribute(
    "href",
    "https://example.com/reference",
  );
  await cards.getByRole("button", { name: "Edit saved item" }).click();
  await expect(cards.getByRole("textbox", { name: "Note" })).toHaveValue("Keep this note");
  await expect(cards.getByRole("textbox", { name: "Tags" })).toHaveValue("research");
  await expect(cards.getByRole("combobox", { name: "Collection" })).toHaveValue("research");
});

test("clearing an empty search stays in Archive", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: /Add a link/ })
    .first()
    .click();
  await page.getByLabel("URL", { exact: true }).fill("https://example.com/archived");
  await page.getByText("Add details").click();
  await page.getByLabel("Title (optional)").fill("Archived reference");
  await page.getByRole("button", { name: "Save link", exact: true }).click();
  const card = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: "Archived reference" }) });
  await card.getByText("More", { exact: true }).click();
  await card.getByRole("button", { name: "Archive", exact: true }).click();
  await page.getByRole("navigation", { name: "Library" }).getByRole("button", { name: "Archive" }).click();
  await expect(page.getByRole("link", { name: "Archived reference" })).toBeVisible();
  await page.getByRole("searchbox").fill("nothing matches");
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Archive" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Archived reference" })).toBeVisible();
});

test("backup confirmation moves focus and returns it on Escape", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Storage and settings" }).click();
  await page.getByRole("combobox", { name: "Import mode" }).selectOption("replace");
  await page.locator('input[type="file"]').setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ format: "keepkit", version: 1, exportedAt: 1, items: [] })),
  });
  const dialog = page.getByRole("dialog", { name: "Confirm replace" });
  await expect(dialog.getByRole("button", { name: "Replace", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.locator('button[data-keep-action="import-backup"]')).toBeFocused();
});

test("mobile navigation, saving and filters remain usable", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const navigation = page.getByRole("button", { name: "Browse library" });
  await expect(navigation).toHaveAttribute("aria-expanded", "false");
  await navigation.click();
  await page.getByRole("button", { name: /Pinned/ }).click();
  await expect(navigation).toHaveAttribute("aria-expanded", "false");
  await navigation.click();
  await page.getByRole("button", { name: /All saves/ }).click();

  await page
    .getByRole("button", { name: /Add a link/ })
    .first()
    .click();
  await page.getByLabel("URL", { exact: true }).fill("https://example.com/mobile");
  await page.getByText("Add details").click();
  await page.getByLabel("Title (optional)").fill("Mobile example");
  await page.getByLabel("Tags (optional)").fill("mobile");
  await page.getByRole("button", { name: "Save link", exact: true }).click();
  await expect(page.getByRole("link", { name: /Mobile example/ })).toBeVisible();

  const filter = page.getByRole("button", { name: "Filter", exact: true });
  await expect(filter).toHaveAttribute("aria-expanded", "false");
  const group = page.locator('[data-group="filters"]');
  await expect(group).toBeHidden();
  await filter.click();
  await expect(group).toBeVisible();
  await group.getByRole("button", { name: /mobile/ }).click();
  await expect(page.getByRole("button", { name: "Hide filters" })).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "Hide filters" }).click();
  await expect(group).toBeHidden();
  const activeTag = page.getByRole("button", { name: "mobile Remove" });
  await expect(activeTag).toBeVisible();
  await activeTag.click();
  await expect(activeTag).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const search = page.getByRole("searchbox");
  expect(
    await search.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  const box = await filter.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
});
