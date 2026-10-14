import { expect, type Page, test } from "@playwright/test";
import type { FixtureApi } from "./fixture/main";

type Snapshot = Awaited<ReturnType<FixtureApi["read"]>>;

async function openFixture(page: Page, scope = "reader") {
  await page.goto(`/?scope=${scope}`);
  await expect(page.getByTestId("hydrated")).toHaveText("ready");
}

function titles(snapshot: Snapshot) {
  return snapshot.items.map((item) => `${item.id}:${item.meta.title}`).sort();
}

test("complete checkpoints preserve items, collections and memberships when mirroring fails", async ({ page }) => {
  await openFixture(page);
  await page.evaluate(async () => {
    const api = window.keepkitFixture;
    api.setFaults({ mirror: true });
    await api.save("alpha", "Latest article");
    await api.saveCollection("reading", "Reading list");
    await api.saveMembership("reading", "alpha");
    await api.read();
    api.setFaults({ primary: true });
  });
  await page.reload();
  await expect(page.getByTestId("hydrated")).toHaveText("ready");
  const snapshot = await page.evaluate(() => window.keepkitFixture.read());
  expect(titles(snapshot)).toEqual(["alpha:Latest article"]);
  expect(snapshot.collections.map((value) => value.name)).toEqual(["Reading list"]);
  expect(snapshot.memberships.map((value) => [value.collectionId, value.itemId])).toEqual([["reading", "alpha"]]);
  await page.evaluate(() => window.keepkitFixture.setFaults({ primary: false, mirror: false }));
  await page.evaluate(() => window.keepkitFixture.retry());
  expect(titles(await page.evaluate(() => window.keepkitFixture.readPrimary()))).toEqual(["alpha:Latest article"]);
});

test("outage operations survive reload and replay in FIFO order without resurrecting removals", async ({ page }) => {
  await openFixture(page);
  await page.evaluate(async () => {
    const api = window.keepkitFixture;
    await api.save("alpha", "Original");
    await api.save("beta", "To remove");
    await api.saveCollection("reading", "Before");
    await api.saveCollection("temporary", "To remove");
    await api.saveMembership("reading", "alpha");
    await api.saveMembership("temporary", "beta");
    api.setFaults({ primary: true, mirror: true });
    await api.save("alpha", "Updated offline");
    await api.remove("beta");
    await api.save("gamma", "New offline");
    await api.saveCollection("reading", "Renamed offline");
    await api.saveMembership("reading", "gamma");
    await api.removeCollection("temporary");
  });
  await page.reload();
  await expect(page.getByTestId("hydrated")).toHaveText("ready");
  const offline = await page.evaluate(() => window.keepkitFixture.read());
  expect(titles(offline)).toEqual(["alpha:Updated offline", "gamma:New offline"]);
  expect(offline.collections.map((value) => value.name)).toEqual(["Renamed offline"]);
  expect(offline.memberships.map((value) => value.itemId).sort()).toEqual(["alpha", "gamma"]);
  await page.evaluate(async () => {
    const api = window.keepkitFixture;
    await api.clear();
    await api.save("final", "After clear");
    api.setFaults({ primary: false });
    await api.retry();
  });
  const primary = await page.evaluate(() => window.keepkitFixture.readPrimary());
  expect(titles(primary)).toEqual(["final:After clear"]);
  expect(primary.collections.map((value) => value.name)).toEqual(["Renamed offline"]);
  expect(primary.memberships).toEqual([]);
  await page.reload();
  await expect(page.getByTestId("hydrated")).toHaveText("ready");
  expect(titles(await page.evaluate(() => window.keepkitFixture.read()))).toEqual(["final:After clear"]);
});

test("a previous factory v1 journal survives outage reload and migrates without losing pending operations", async ({
  page,
}) => {
  await openFixture(page);
  const legacyKey = await page.evaluate(async () => {
    const api = window.keepkitFixture;
    await api.save("removed", "Previously saved");
    api.setFaults({ primary: true, mirror: true });
    return api.seedLegacyRecovery();
  });
  await page.reload();
  await expect(page.getByTestId("hydrated")).toHaveText("ready");
  const offline = await page.evaluate(() => window.keepkitFixture.read());
  expect(titles(offline)).toEqual(["v1-new:Pending v1 item"]);
  expect(offline.collections.map((collection) => collection.name)).toEqual(["Pending v1 collection"]);
  expect(offline.memberships.map((membership) => membership.itemId)).toEqual(["v1-new"]);
  expect(await page.evaluate((key) => localStorage.getItem(key) !== null, legacyKey)).toBe(true);
  await page.evaluate(async () => {
    const api = window.keepkitFixture;
    api.setFaults({ primary: false, mirror: false });
    await api.retry();
  });
  expect(titles(await page.evaluate(() => window.keepkitFixture.readPrimary()))).toEqual(["v1-new:Pending v1 item"]);
  const migrated = await page.evaluate(() => window.keepkitFixture.readCurrentJournal());
  expect(migrated?.version).toBe(2);
  expect(migrated?.operations).toEqual([]);
  await page.reload();
  await expect(page.getByTestId("hydrated")).toHaveText("ready");
  expect(titles(await page.evaluate(() => window.keepkitFixture.read()))).toEqual(["v1-new:Pending v1 item"]);
});

test("two tabs serialize outage writes and both changes reach IndexedDB after reload", async ({ context, page }) => {
  await openFixture(page);
  const second = await context.newPage();
  await openFixture(second);
  await page.evaluate(() => window.keepkitFixture.observeRecovery());
  await second.evaluate(() => window.keepkitFixture.observeRecovery());
  await page.evaluate(() => window.keepkitFixture.setFaults({ primary: true }));
  await second.evaluate(() => window.keepkitFixture.setFaults({ primary: true }));
  await Promise.all([
    page.evaluate(() => window.keepkitFixture.save("tab-one", "First tab")),
    second.evaluate(() => window.keepkitFixture.save("tab-two", "Second tab")),
  ]);
  try {
    await expect(page.getByRole("link", { name: /Second tab/ })).toBeVisible();
    await expect(second.getByRole("link", { name: /First tab/ })).toBeVisible();
  } catch (error) {
    const snapshots = await Promise.all(
      [page, second].map((tab) =>
        tab.evaluate(() => ({
          values: Object.fromEntries(Object.entries(localStorage)),
          state: window.keepkitFixture.getRecoveryState(),
          observed: window.keepkitFixture.getObservedState(),
        })),
      ),
    );
    await test
      .info()
      .attach("tab-storage", { body: JSON.stringify(snapshots, null, 2), contentType: "application/json" });
    throw error;
  }
  await expect
    .poll(async () =>
      Math.max(
        await page.evaluate(() => window.keepkitFixture.getObservedState().pendingOperations),
        await second.evaluate(() => window.keepkitFixture.getObservedState().pendingOperations),
      ),
    )
    .toBe(2);
  expect(await page.evaluate(() => window.keepkitFixture.getObservedState().notifications)).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByTestId("hydrated")).toHaveText("ready");
  expect(titles(await page.evaluate(() => window.keepkitFixture.read()))).toEqual([
    "tab-one:First tab",
    "tab-two:Second tab",
  ]);
  await page.evaluate(async () => {
    window.keepkitFixture.setFaults({ primary: false });
    await window.keepkitFixture.retry();
  });
  expect(titles(await page.evaluate(() => window.keepkitFixture.readPrimary()))).toEqual([
    "tab-one:First tab",
    "tab-two:Second tab",
  ]);
});

test("shared backend scopes preserve same-name IDs and clearing one scope leaves the other intact", async ({
  context,
  page,
}) => {
  await openFixture(page, "alice");
  const second = await context.newPage();
  await openFixture(second, "bob");
  await Promise.all([
    page.evaluate(() => window.keepkitFixture.save("shared", "Alice article")),
    second.evaluate(() => window.keepkitFixture.save("shared", "Bob article")),
  ]);
  expect(titles(await page.evaluate(() => window.keepkitFixture.read()))).toEqual(["shared:Alice article"]);
  expect(titles(await second.evaluate(() => window.keepkitFixture.read()))).toEqual(["shared:Bob article"]);
  await page.evaluate(async () => {
    const api = window.keepkitFixture;
    api.setFaults({ primary: true });
    await api.clear();
    api.setFaults({ primary: false });
    await api.retry();
  });
  expect((await page.evaluate(() => window.keepkitFixture.readPrimary())).items).toEqual([]);
  expect(titles(await second.evaluate(() => window.keepkitFixture.readPrimary()))).toEqual(["shared:Bob article"]);
  const preview = await page.evaluate(() => window.keepkitFixture.inspect());
  expect(
    preview.sources.flatMap((source) => source.snapshot.items).every((item) => item.scope?.userId === "alice"),
  ).toBe(true);
});

test("without Web Locks healthy primary writes succeed and fallback writes are refused", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "locks", { value: undefined, configurable: true }));
  await openFixture(page);
  await page.evaluate(() => window.keepkitFixture.save("healthy", "Native IndexedDB"));
  expect(titles(await page.evaluate(() => window.keepkitFixture.readPrimary()))).toEqual(["healthy:Native IndexedDB"]);
  await page.evaluate(() => window.keepkitFixture.setFaults({ primary: true }));
  const failure = await page.evaluate(async () => {
    try {
      await window.keepkitFixture.save("refused", "No unsafe write");
      return null;
    } catch (error) {
      return error instanceof Error ? { name: error.name, message: error.message } : null;
    }
  });
  expect(failure).not.toBeNull();
  expect(failure?.name).toBe("KeepStorageAccessError");
  expect(
    await page.evaluate(() => Object.values(localStorage).some((value) => String(value).includes('"id":"refused"'))),
  ).toBe(false);
});

test("checkpoint failure preserves a successful primary save and can be retried", async ({ page }) => {
  await openFixture(page);
  await page.evaluate(() => window.keepkitFixture.save("alpha", "Old checkpoint"));
  await page.evaluate(async () => {
    const api = window.keepkitFixture;
    api.setFaults({ journal: true });
    await api.save("alpha", "Saved in primary");
  });
  expect(titles(await page.evaluate(() => window.keepkitFixture.readPrimary()))).toEqual(["alpha:Saved in primary"]);
  expect(await page.evaluate(() => window.keepkitFixture.getRecoveryState().snapshotStale)).toBe(true);
  await page.evaluate(async () => {
    window.keepkitFixture.setFaults({ journal: false });
    await window.keepkitFixture.read();
  });
  expect(await page.evaluate(() => window.keepkitFixture.getRecoveryState().snapshotStale)).toBe(false);
  await page.evaluate(() => window.keepkitFixture.setFaults({ primary: true }));
  await page.reload();
  await expect(page.getByTestId("hydrated")).toHaveText("ready");
  expect(titles(await page.evaluate(() => window.keepkitFixture.read()))).toEqual(["alpha:Saved in primary"]);
});

test("native IndexedDB accepts BigInt and cycles while JSON fallback refuses a lossy save", async ({ page }) => {
  await openFixture(page);
  await page.evaluate(async () => {
    await window.keepkitFixture.saveNonJson("bigint", "bigint");
    await window.keepkitFixture.saveNonJson("cyclic", "cycle");
  });
  const primary = await page.evaluate(async () => {
    const { items } = await window.keepkitFixture.readPrimary();
    return items.map((item) => {
      const value = item.meta.value;
      return {
        id: item.id,
        bigint: typeof value === "bigint" && value === 12n,
        cyclic: typeof value === "object" && value !== null && "self" in value && value.self === value,
      };
    });
  });
  expect(primary).toEqual([
    { id: "bigint", bigint: true, cyclic: false },
    { id: "cyclic", bigint: false, cyclic: true },
  ]);
  const state = await page.evaluate(() => {
    const value = window.keepkitFixture.getRecoveryState();
    return { stale: value.snapshotStale, issue: value.issue instanceof Error ? value.issue.name : null };
  });
  expect(state).toEqual({ stale: true, issue: "KeepStorageSerializationError" });
  const failure = await page.evaluate(async () => {
    window.keepkitFixture.setFaults({ primary: true });
    try {
      await window.keepkitFixture.saveNonJson("refused", "bigint");
      return null;
    } catch (error) {
      return error instanceof Error ? error.name : String(error);
    }
  });
  expect(failure).toBe("KeepStorageSerializationError");
});

test("inspection is read-only, stale approval is refused, and pending repair resumes with retained backups", async ({
  page,
}) => {
  await openFixture(page);
  await page.evaluate(async () => {
    const api = window.keepkitFixture;
    await api.save("alpha", "Primary branch");
    await api.seedFallback("alpha", "Fallback branch");
    await api.seedFallback("beta", "Fallback-only item");
    await api.seedFallbackCollection("legacy", "Legacy collection");
  });
  const inspected = await page.evaluate(() => window.keepkitFixture.inspect());
  expect(inspected.rows.some((row) => row.id === "alpha" && row.conflict)).toBe(true);
  expect(titles(await page.evaluate(() => window.keepkitFixture.readPrimary()))).toEqual(["alpha:Primary branch"]);
  const stale = await page.evaluate(async (token) => {
    const api = window.keepkitFixture;
    await api.save("changed", "New concurrent write");
    try {
      await api.apply({ token, selections: {} });
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }, inspected.token);
  expect(stale).toMatch(/changed|stale|inspect|confirmation/i);
  await page.evaluate(async () => {
    await window.keepkitFixture.seedFallback("alpha", "Fallback branch");
    await window.keepkitFixture.seedFallback("beta", "Fallback-only item");
  });
  const pending = await page.evaluate(async () => {
    const api = window.keepkitFixture;
    const preview = await api.inspect();
    const selections: Record<string, string> = {};
    for (const row of preview.rows) {
      if (row.conflict)
        selections[row.key] = row.candidates.some((candidate) => candidate.source === "fallback")
          ? "fallback"
          : row.candidates[0].source;
    }
    api.setFaults({ primaryWritesBeforeFailure: 1 });
    return api.apply({ token: preview.token, selections });
  });
  expect(pending.status).toBe("pending");
  expect(pending.pendingOperations).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByTestId("hydrated")).toHaveText("ready");
  await page.evaluate(async () => {
    window.keepkitFixture.setFaults({ primaryWritesBeforeFailure: null });
    await window.keepkitFixture.retry();
  });
  const restored = await page.evaluate(() => window.keepkitFixture.readPrimary());
  expect(titles(restored)).toContain("alpha:Fallback branch");
  expect(titles(restored)).toContain("beta:Fallback-only item");
  expect(restored.collections.map((collection) => collection.name)).toContain("Legacy collection");
  expect((await page.evaluate(() => window.keepkitFixture.inspect())).backups.length).toBeGreaterThan(0);
});
