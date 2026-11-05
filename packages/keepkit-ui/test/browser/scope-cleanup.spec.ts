import { expect, test } from "@playwright/test";

test("switching real scoped storage clears archive Undo for an overlapping item ID", async ({ page }) => {
  await page.goto("/?scope-test=1");
  await expect(page.getByTestId("hydrated")).toHaveText("ready");
  await page.evaluate(async () => {
    await window.keepkitFixture.save("shared", "First account");
    await window.keepkitFixture.saveOtherArchived("shared", "Other account");
    await window.keepkitFixture.refreshUi();
  });
  const card = page.getByRole("region", { name: "Custom cards" });
  await expect(card.getByRole("link", { name: "First account" })).toBeVisible();
  await card.getByRole("button", { name: "Archive", exact: true }).click();
  const undo = page.locator('[data-keepkit="archive-undo"]');
  await expect(undo).toContainText("First account");
  await page.getByRole("button", { name: "Switch storage" }).click();
  await expect(card.getByRole("link", { name: "Other account" })).toBeVisible();
  await expect(undo).toBeHidden();
  const otherItems = await page.evaluate(() => window.keepkitFixture.readOther());
  expect(otherItems).toEqual([
    expect.objectContaining({ id: "shared", archived: true, meta: { title: "Other account" } }),
  ]);
  const firstItems = await page.evaluate(() => window.keepkitFixture.readPrimary());
  expect(firstItems.items).toEqual([expect.objectContaining({ id: "shared", archived: true })]);
});

test("stale cleanup keeps data after a storage failure and succeeds on retry", async ({ page }) => {
  await page.goto("/?cleanup-test=1");
  await expect(page.getByTestId("hydrated")).toHaveText("ready");
  await page.evaluate(async () => {
    await window.keepkitFixture.saveStale("stale", "Expired link");
    await window.keepkitFixture.save("active", "Active link");
    await window.keepkitFixture.refreshUi();
  });
  const cleanup = page.getByRole("button", { name: "Remove unavailable items (1)" });
  const error = page.locator('[data-keepkit="prune-stale"] + [role="alert"]');
  await expect(cleanup).toBeEnabled();
  await page.evaluate(() => window.keepkitFixture.setFaults({ primary: true, journal: true }));
  await cleanup.click();
  await expect(error).toBeVisible();
  const beforeRetry = await page.evaluate(() => window.keepkitFixture.readPrimary());
  expect(beforeRetry.items.map((entry) => entry.id).sort()).toEqual(["active", "stale"]);
  await page.evaluate(() => window.keepkitFixture.setFaults({ primary: false, journal: false }));
  await cleanup.click();
  await expect(error).toBeHidden();
  await expect
    .poll(() => page.evaluate(async () => (await window.keepkitFixture.readPrimary()).items.map((entry) => entry.id)))
    .toEqual(["active"]);
});
