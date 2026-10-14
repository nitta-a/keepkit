import { expect, test } from "@playwright/test";
import type { FixtureApi } from "./fixture/main";

type Snapshot = Awaited<ReturnType<FixtureApi["read"]>>;
function ids(snapshot: Snapshot) {
  return snapshot.items.map((item) => item.id).sort();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("hydrated")).toHaveText("ready");
  await page.evaluate(async () => {
    const api = window.keepkitFixture;
    await api.save("alpha", "First article");
    await api.save("beta", "Second article");
    await api.refreshUi();
  });
  await expect(page.getByRole("link", { name: /First article/ })).toBeVisible();
});

test("custom Link regions contain one anchor and record exactly one open", async ({ page }) => {
  expect(await page.locator("a a").count()).toBe(0);
  await page
    .getByRole("region", { name: "Custom cards" })
    .getByRole("button", { name: "Pin", exact: true })
    .first()
    .click();
  await expect(page.getByTestId("opened")).toHaveText("0");
  expect(await page.evaluate(() => location.hash)).toBe("");
  await expect
    .poll(() =>
      page.evaluate(
        async () => (await window.keepkitFixture.readPrimary()).items.find((item) => item.id === "alpha")?.pinned,
      ),
    )
    .toBe(true);
  const writes = await page.evaluate(() => window.keepkitFixture.getPrimaryWrites());
  const link = page.getByRole("link", { name: /First article/ });
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("opened")).toHaveText("1");
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.keepkitFixture
          .readPrimary()
          .then((snapshot) => snapshot.items.find((item) => item.id === "alpha")?.lastOpenedAt),
      ),
    )
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => window.keepkitFixture.getPrimaryWrites())).toBe(writes + 1);
  expect(await page.evaluate(() => location.hash)).toBe("#opened");
});

test("confirmation cancellation keeps data, restores keyboard focus, and confirmation includes off-page selection with Undo", async ({
  page,
}) => {
  const remove = page.getByRole("button", { name: "Delete selected", exact: true });
  await remove.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Confirm removal" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("2");
  await expect(dialog.getByRole("button", { name: "Delete selected" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(remove).toBeFocused();
  expect(ids(await page.evaluate(() => window.keepkitFixture.readPrimary()))).toEqual(["alpha", "beta"]);
  await remove.click();
  await dialog.getByRole("button", { name: "Delete selected" }).click();
  await expect(dialog).not.toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(async () => (await window.keepkitFixture.readPrimary()).items.map((item) => item.id).sort()),
    )
    .toEqual([]);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(async () => (await window.keepkitFixture.readPrimary()).items.map((item) => item.id).sort()),
    )
    .toEqual(["alpha", "beta"]);
});

test("a failed confirmed removal keeps the approval available for retry and Undo", async ({ page }) => {
  await page.getByRole("button", { name: "Delete selected", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Confirm removal" });
  await page.evaluate(() => window.keepkitFixture.setFaults({ primary: true, journal: true }));
  const confirm = dialog.getByRole("button", { name: "Delete selected" });
  await confirm.click();
  await expect(dialog).toBeVisible();
  await expect(confirm).toBeEnabled();
  expect(ids(await page.evaluate(() => window.keepkitFixture.readPrimary()))).toEqual(["alpha", "beta"]);
  await page.evaluate(() => window.keepkitFixture.setFaults({ journal: false }));
  await confirm.click();
  await expect(dialog).not.toBeVisible();
  expect(ids(await page.evaluate(() => window.keepkitFixture.read()))).toEqual([]);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect
    .poll(() => page.evaluate(async () => (await window.keepkitFixture.read()).items.map((item) => item.id).sort()))
    .toEqual(["alpha", "beta"]);
});

test("recovery comparison and review are read-only and keyboard approval applies the selected branch", async ({
  page,
}) => {
  await page.goto("/?recovery=1");
  await expect(page.getByTestId("hydrated")).toHaveText("ready");
  await page.evaluate(() => window.keepkitFixture.seedFallback("alpha", "Selected fallback article"));
  const writes = await page.evaluate(() => window.keepkitFixture.getPrimaryWrites());
  const region = page.getByRole("region", { name: "Storage recovery" });
  await region.getByRole("button", { name: "Compare saved data" }).focus();
  await page.keyboard.press("Enter");
  const choice = region.getByRole("combobox", { name: "Saved items: alpha" });
  await expect(choice).toBeFocused();
  await choice.selectOption("fallback");
  await region.getByRole("button", { name: "Review changes" }).focus();
  await page.keyboard.press("Enter");
  const apply = region.getByRole("button", { name: "Apply reviewed changes" });
  await expect(apply).toBeFocused();
  expect(await page.evaluate(() => window.keepkitFixture.getPrimaryWrites())).toBe(writes);
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      page.evaluate(
        async () => (await window.keepkitFixture.readPrimary()).items.find((item) => item.id === "alpha")?.meta.title,
      ),
    )
    .toBe("Selected fallback article");
  expect(ids(await page.evaluate(() => window.keepkitFixture.readPrimary()))).toEqual(["alpha", "beta"]);
});
