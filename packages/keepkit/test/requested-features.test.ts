import assert from "node:assert/strict";
import test from "node:test";
import {
  addKeepItemToCollection,
  createBrowserStorageAdapter,
  createScopedStorageAdapter,
  createStorageAdapter,
  exportItems,
  importItems,
  type KeepBackupV1,
  LocalStorageAdapter,
  LocalStorageKeepHistoryStorage,
  LocalStorageKeepProgressStorage,
  LocalStorageKeepViewingRecordStorage,
  migrateLegacyCollectionMemberships,
  removeKeepItemFromCollection,
  reorderKeepCollectionItems,
  type StorageAdapter,
} from "../dist/core.js";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  } as Storage;
}

const savedItem = { id: "guide-a", savedAt: 1, updatedAt: 1, meta: { title: "Guide A" } };

test("history tracks unsaved guides independently and enforces the configured limit", async () => {
  const storage = createStorage();
  const adapter = new LocalStorageAdapter({ key: "request:items", storage });
  const history = new LocalStorageKeepHistoryStorage({ key: "request:history", storage, maxEntries: 2 });

  await history.record("guide-a", 10);
  await history.record("guide-b", 20);
  await history.record("guide-c", 30);
  assert.deepEqual(
    (await history.getAll()).map((entry) => entry.itemId),
    ["guide-c", "guide-b"],
  );
  await history.record("guide-a", 5);
  assert.deepEqual(
    (await history.getAll()).map((entry) => entry.itemId),
    ["guide-c", "guide-b"],
  );
  await history.record("guide-c", 1);
  assert.equal((await history.getAll())[0]?.lastViewedAt, 30);
  assert.deepEqual(await adapter.getAll(), []);

  await adapter.set(savedItem);
  await adapter.remove(savedItem.id);
  assert.deepEqual(
    (await history.getAll()).map((entry) => entry.itemId),
    ["guide-c", "guide-b"],
  );
  await history.remove("guide-b");
  assert.deepEqual(
    (await history.getAll()).map((entry) => entry.itemId),
    ["guide-c"],
  );
  await history.setLimit(1);
  assert.equal(await history.getLimit(), 1);
  await history.clear();
  assert.deepEqual(await history.getAll(), []);
});

test("viewing records distinguish repeated self-reported events from opens", async () => {
  const storage = createStorage();
  const records = new LocalStorageKeepViewingRecordStorage({
    key: "request:viewings",
    storage,
    now: () => 50,
    createId: (() => {
      let index = 0;
      return () => `record-${++index}`;
    })(),
  });

  const first = await records.add("guide-a", { viewedAt: 10, note: "First watch" });
  const second = await records.add("guide-a", { viewedAt: 20 });
  assert.deepEqual(
    (await records.getAll("guide-a")).map((record) => record.id),
    ["record-2", "record-1"],
  );
  await records.set({ ...first, note: "Finished" });
  assert.equal((await records.getAll("guide-a")).find((record) => record.id === first.id)?.note, "Finished");
  const savedItems = new LocalStorageAdapter({ key: "request:saved-items", storage });
  await savedItems.set(savedItem);
  await savedItems.remove(savedItem.id);
  assert.equal((await records.getAll("guide-a")).length, 2);
  await records.remove(second.id);
  assert.deepEqual(
    (await records.getAll("guide-a")).map((record) => record.id),
    [first.id],
  );
  await records.removeForItem("guide-a");
  assert.deepEqual(await records.getAll(), []);
});

test("collection memberships reuse items and reorder independently per collection", async () => {
  const adapter = new LocalStorageAdapter({ key: "request:collections", storage: createStorage() });
  await adapter.setMany([
    savedItem,
    { id: "guide-b", savedAt: 2, updatedAt: 2, meta: { title: "Guide B" } },
    { id: "guide-c", savedAt: 3, updatedAt: 3, meta: { title: "Guide C" } },
  ]);
  await adapter.setCollection({ id: "course-a", name: "Course A" });
  await adapter.setCollection({ id: "course-b", name: "Course B" });
  await addKeepItemToCollection(adapter, "course-a", "guide-a");
  await addKeepItemToCollection(adapter, "course-a", "guide-b");
  await addKeepItemToCollection(adapter, "course-b", "guide-a");
  await addKeepItemToCollection(adapter, "course-b", "guide-c");

  await assert.rejects(
    adapter.setCollectionMembership?.({ collectionId: "course-a", itemId: "guide-c", order: 0.5 }),
    /invalid/i,
  );

  await reorderKeepCollectionItems(adapter, "course-a", ["guide-b", "guide-a"]);
  assert.deepEqual(
    (await adapter.getCollectionMemberships?.())?.filter((entry) => entry.collectionId === "course-b"),
    [
      { collectionId: "course-b", itemId: "guide-a", order: 0 },
      { collectionId: "course-b", itemId: "guide-c", order: 1 },
    ],
  );
  await removeKeepItemFromCollection(adapter, "course-a", "guide-a");
  assert.deepEqual(
    (await adapter.getCollectionMemberships?.())?.filter((entry) => entry.collectionId === "course-a"),
    [{ collectionId: "course-a", itemId: "guide-b", order: 0 }],
  );
  assert.equal((await adapter.getCollectionMemberships?.())?.length, 3);
  assert.equal((await adapter.getAll()).length, 3);
});

test("backups preserve empty collections and memberships while accepting v1 item-only backups", async () => {
  const storage = createStorage();
  const source = new LocalStorageAdapter({ key: "request:backup-source", storage });
  const target = new LocalStorageAdapter({ key: "request:backup-target", storage });
  await source.set(savedItem);
  await source.setCollection({ id: "empty-course", name: "Empty Course" });
  await source.setCollection({ id: "course-a", name: "Course A" });
  await addKeepItemToCollection(source, "course-a", "guide-a");

  const backup = await exportItems(source);
  assert.equal(JSON.parse(backup).version, 2);
  const restored = await importItems(target, backup, { mode: "replace" });
  assert.equal(restored.imported, 1);
  assert.deepEqual((await target.getCollections?.())?.map((collection) => collection.id).sort(), [
    "course-a",
    "empty-course",
  ]);
  assert.deepEqual(await target.getCollectionMemberships?.(), [
    { collectionId: "course-a", itemId: "guide-a", order: 0 },
  ]);

  const legacy = JSON.stringify({
    format: "keepkit",
    version: 1,
    exportedAt: 1,
    items: [savedItem],
  });
  const legacyResult = await importItems(target, legacy, { mode: "replace" });
  assert.equal(legacyResult.imported, 1);
  assert.deepEqual(legacyResult.items, [savedItem]);
  assert.deepEqual(await target.getCollections?.(), []);
  const legacyObject: KeepBackupV1 = { format: "keepkit", version: 1, exportedAt: 1, items: [savedItem] };
  assert.equal((await importItems(target, legacyObject)).imported, 1);
  assert.deepEqual(Object.keys(legacyObject).sort(), ["exportedAt", "format", "items", "version"]);
});

test("backup merge replaces matching IDs but keeps same-name collections with other IDs", async () => {
  const storage = createStorage();
  const source = new LocalStorageAdapter({ key: "request:collision-source", storage });
  const target = new LocalStorageAdapter({ key: "request:collision-target", storage });
  await source.set(savedItem);
  await source.setCollection({ id: "course-a", name: "Course A" });
  await addKeepItemToCollection(source, "course-a", "guide-a");
  await target.setCollection({ id: "course-a", name: "Old name" });
  await target.setCollection({ id: "other-course", name: "Course A" });
  await target.setCollectionMembership({ collectionId: "course-a", itemId: "guide-a", order: 8 });

  await importItems(target, await exportItems(source), { mode: "merge" });
  assert.deepEqual(await target.getCollections?.(), [
    { id: "other-course", name: "Course A" },
    { id: "course-a", name: "Course A" },
  ]);
  assert.deepEqual(await target.getCollectionMemberships?.(), [
    { collectionId: "course-a", itemId: "guide-a", order: 0 },
  ]);
});

test("progress is stored independently and incompatible content offsets are not returned", async () => {
  const progress = new LocalStorageKeepProgressStorage({
    key: "request:progress",
    storage: createStorage(),
    now: () => 100,
  });
  await progress.saveCourse("course-a", "guide-a");
  await progress.saveItem("guide-a", {
    audioPositionMs: 1250,
    readingPosition: 4,
    audioId: "audio-ja",
    language: "ja",
    contentVersion: "2026-01",
  });

  assert.equal((await progress.getCourse("course-a"))?.currentItemId, "guide-a");
  assert.equal(
    (await progress.getItem("guide-a", { audioId: "audio-ja", language: "ja", contentVersion: "2026-01" }))
      ?.audioPositionMs,
    1250,
  );
  assert.equal(
    (await progress.getItem("guide-a", { audioId: "audio-ja", language: "ja", contentVersion: "2026-01" }))?.audioId,
    "audio-ja",
  );
  assert.equal(await progress.getItem("guide-a"), undefined);
  assert.equal(await progress.getItem("guide-a", { language: "ja" }), undefined);
  assert.equal(await progress.getItem("guide-a", { contentVersion: "2026-02" }), undefined);
  await progress.resetItem("guide-a");
  assert.equal(await progress.getItem("guide-a"), undefined);
  assert.equal((await progress.getAll()).length, 1);

  await assert.rejects(progress.set({ kind: "item", itemId: "guide-a", audioPositionMs: -1, updatedAt: 1 }), TypeError);
});

test("concurrent activity writes preserve distinct records and newer history context", async () => {
  const storage = createStorage();
  const history = new LocalStorageKeepHistoryStorage({ key: "concurrent:history", storage });
  const viewings = new LocalStorageKeepViewingRecordStorage({ key: "concurrent:viewings", storage });
  const progress = new LocalStorageKeepProgressStorage({ key: "concurrent:progress", storage });
  await Promise.all([
    history.record("a", 10, { language: "ja" }),
    history.record("b", 20, { language: "en" }),
    history.record("a", 30, { language: "fr" }),
    viewings.set({ id: "one", itemId: "a", viewedAt: 10 }),
    viewings.set({ id: "two", itemId: "b", viewedAt: 20 }),
    progress.saveItem("a", { readingPosition: 1 }),
    progress.saveItem("b", { readingPosition: 2 }),
  ]);
  assert.deepEqual((await history.getAll()).map((entry) => entry.itemId).sort(), ["a", "b"]);
  assert.deepEqual(
    (await history.getAll()).find((entry) => entry.itemId === "a"),
    {
      itemId: "a",
      lastViewedAt: 30,
      context: { language: "fr" },
    },
  );
  assert.deepEqual((await viewings.getAll()).map((entry) => entry.id).sort(), ["one", "two"]);
  assert.deepEqual(
    (await progress.getAll())
      .filter((entry) => entry.kind === "item")
      .map((entry) => entry.itemId)
      .sort(),
    ["a", "b"],
  );
});

test("activity and progress writes reject when persistent storage is unavailable", async () => {
  const history = new LocalStorageKeepHistoryStorage({ key: "unavailable:history" });
  const records = new LocalStorageKeepViewingRecordStorage({ key: "unavailable:viewings" });
  const progress = new LocalStorageKeepProgressStorage({ key: "unavailable:progress" });
  await assert.rejects(history.record("a"), /persist/i);
  await assert.rejects(records.add("a"), /persist/i);
  await assert.rejects(progress.saveCourse("course-a"), /persist/i);
});

test("removing an item removes its memberships in the matching scope", async () => {
  const adapter = new LocalStorageAdapter({ key: "membership-removal", storage: createStorage() });
  await adapter.setMany([
    { ...savedItem, scope: { userId: "alice" } },
    { ...savedItem, scope: { userId: "bob" } },
  ]);
  await adapter.setCollection({ id: "course", name: "Course", scope: { userId: "alice" } });
  await adapter.setCollection({ id: "course", name: "Course", scope: { userId: "bob" } });
  await adapter.setCollectionMembership({
    collectionId: "course",
    itemId: savedItem.id,
    order: 0,
    scope: { userId: "alice" },
  });
  await adapter.setCollectionMembership({
    collectionId: "course",
    itemId: savedItem.id,
    order: 0,
    scope: { userId: "bob" },
  });
  const alice = createScopedStorageAdapter(adapter, { userId: "alice" });
  await alice.remove(savedItem.id);
  assert.deepEqual(await alice.getCollectionMemberships?.(), []);
  assert.equal((await adapter.getCollectionMemberships()).length, 1);
  assert.deepEqual(await alice.getAll(), []);
  assert.deepEqual(
    (await adapter.getAll()).map((item) => item.scope?.userId),
    ["bob"],
  );
  await adapter.set({ ...savedItem, scope: { userId: "alice" } });
  assert.equal((await adapter.getAll()).length, 2);
  assert.deepEqual(await alice.getCollectionMemberships?.(), []);
  await adapter.setCollectionMembership({
    collectionId: "course",
    itemId: savedItem.id,
    order: 0,
    scope: { userId: "alice" },
  });
  await alice.clear();
  assert.deepEqual(await alice.getAll(), []);
  assert.deepEqual(
    (await adapter.getAll()).map((item) => item.scope?.userId),
    ["bob"],
  );
  assert.deepEqual(await alice.getCollectionMemberships?.(), []);
  assert.deepEqual(await adapter.getCollections(), [
    { id: "course", name: "Course", scope: { userId: "alice" } },
    { id: "course", name: "Course", scope: { userId: "bob" } },
  ]);
});

test("scoped adapter forwards scope through the persistence-function adapter", async () => {
  let items = [
    { ...savedItem, scope: { userId: "alice" } },
    { ...savedItem, scope: { userId: "bob" } },
  ];
  const base = createStorageAdapter({
    getAll: () => items,
    set: (item) => {
      items = [...items.filter((entry) => entry.id !== item.id || entry.scope?.userId !== item.scope?.userId), item];
    },
    remove: (id, scope) => {
      items = items.filter((item) => item.id !== id || item.scope?.userId !== scope?.userId);
    },
    clear: () => {
      items = [];
    },
  });
  const alice = createScopedStorageAdapter(base, { userId: "alice" });

  await alice.remove(savedItem.id);

  assert.deepEqual(
    (await base.getAll()).map((item) => item.scope?.userId),
    ["bob"],
  );
});

test("legacy collection migration is idempotent and reports missing names", async () => {
  const adapter = new LocalStorageAdapter({ key: "legacy-membership", storage: createStorage() });
  await adapter.set({ ...savedItem, collectionId: "old-course", order: 4 });
  const first = await migrateLegacyCollectionMemberships(adapter);
  const second = await migrateLegacyCollectionMemberships(adapter);
  assert.deepEqual(first, { migrated: 1, skipped: 0, missingCollectionIds: ["old-course"] });
  assert.deepEqual(second, { migrated: 0, skipped: 0, missingCollectionIds: [] });
  assert.deepEqual(await adapter.getCollectionMemberships(), [
    { collectionId: "old-course", itemId: savedItem.id, order: 4 },
  ]);
  assert.equal((await adapter.getAll())[0]?.collectionId, undefined);
});

test("legacy migration reports missing scoped definitions even when a matching membership exists", async () => {
  const adapter = new LocalStorageAdapter({ key: "legacy-membership-scope", storage: createStorage() });
  await adapter.set({ ...savedItem, scope: { userId: "alice" }, collectionId: "course" });
  await adapter.setCollection?.({ id: "course", name: "Bob's Course", scope: { userId: "bob" } });
  await adapter.setCollectionMembership?.({
    collectionId: "course",
    itemId: savedItem.id,
    order: 3,
    scope: { userId: "alice" },
  });

  const result = await migrateLegacyCollectionMemberships(adapter);

  assert.deepEqual(result, { migrated: 0, skipped: 1, missingCollectionIds: ["course"] });
  assert.equal((await adapter.getAll())[0]?.collectionId, undefined);
});

test("replace restore clears scoped data and reports partial application stage", async () => {
  const base = new LocalStorageAdapter({ key: "scoped-replace", storage: createStorage() });
  await base.set({ ...savedItem, scope: { userId: "alice" } });
  await base.set({ ...savedItem, scope: { userId: "bob" } });
  const alice = createScopedStorageAdapter(base, { userId: "alice" });
  const empty = JSON.stringify({
    format: "keepkit",
    version: 2,
    exportedAt: 1,
    items: [],
    collections: [],
    memberships: [],
  });
  await assert.rejects(
    importItems(
      alice,
      JSON.stringify({
        format: "keepkit",
        version: 2,
        exportedAt: 1,
        items: [{ ...savedItem, scope: { userId: "bob" } }],
        collections: [],
        memberships: [],
      }),
      { mode: "replace" },
    ),
    (error) => error.failedStage === "validation",
  );
  assert.deepEqual(
    (await alice.getAll()).map((item) => item.id),
    [savedItem.id],
  );
  const result = await importItems(alice, empty, { mode: "replace" });
  assert.deepEqual(result.items, []);
  assert.deepEqual(
    (await base.getAll()).map((item) => item.scope?.userId),
    ["bob"],
  );

  const browserScoped = createBrowserStorageAdapter({
    key: "browser-scoped-replace",
    storage: createStorage(),
    scope: { userId: "alice" },
  });
  await browserScoped.set(savedItem);
  const scopedBackup = await exportItems(browserScoped);
  assert.deepEqual(JSON.parse(scopedBackup).scopes, [{ userId: "alice" }]);
  const scopedResult = await importItems(browserScoped, empty, { mode: "replace" });
  assert.deepEqual(scopedResult.scopes, []);
  assert.deepEqual(await browserScoped.getAll(), []);
  assert.deepEqual(JSON.parse(await exportItems(browserScoped)).scopes, [{ userId: "alice" }]);

  const broken: StorageAdapter = {
    getAll: () => alice.getAll(),
    getCollections: () => alice.getCollections?.() ?? Promise.resolve([]),
    setCollection: async () => {
      throw new Error("collection write failed");
    },
    removeCollection: (id, scope) => alice.removeCollection?.(id, scope) ?? Promise.resolve(),
    getCollectionMemberships: () => alice.getCollectionMemberships?.() ?? Promise.resolve([]),
    setCollectionMembership: (entry) => alice.setCollectionMembership?.(entry) ?? Promise.resolve(),
    removeCollectionMembership: (collectionId, itemId, scope) =>
      alice.removeCollectionMembership?.(collectionId, itemId, scope) ?? Promise.resolve(),
    set: (item) => alice.set(item),
    setMany: (items) =>
      alice.setMany?.(items) ?? Promise.all(items.map((item) => alice.set(item))).then(() => undefined),
    remove: (id, scope) => alice.remove(id, scope),
    removeMany: (ids, scope) =>
      alice.removeMany?.(ids, scope) ?? Promise.all(ids.map((id) => alice.remove(id, scope))).then(() => undefined),
    clear: () => alice.clear(),
  };
  await assert.rejects(
    importItems(
      broken,
      JSON.stringify({
        format: "keepkit",
        version: 2,
        exportedAt: 1,
        items: [savedItem],
        collections: [{ id: "c", name: "Course" }],
        memberships: [],
      }),
      { mode: "replace" },
    ),
    (error) => error.failedStage === "collections" && error.applied.items === 1 && error.imported === 1,
  );
});

test("backup merge can keep existing names and v1 results report missing definitions", async () => {
  const storage = createStorage();
  const source = new LocalStorageAdapter({ key: "backup-policy-source", storage });
  const target = new LocalStorageAdapter({ key: "backup-policy-target", storage });
  await source.set(savedItem);
  await source.setCollection({ id: "course", name: "Backup name" });
  await target.setCollection({ id: "course", name: "Existing name" });
  await importItems(target, await exportItems(source), { mode: "merge", collectionNameConflict: "existing" });
  assert.equal((await target.getCollections())[0]?.name, "Existing name");
  const legacy = await importItems(
    target,
    {
      format: "keepkit",
      version: 1,
      exportedAt: 1,
      items: [{ ...savedItem, collectionId: "old-course" }],
    },
    { mode: "merge" },
  );
  assert.deepEqual(legacy.missingCollectionIds, ["old-course"]);
  assert.deepEqual(legacy.includedData, ["items"]);
});

test("history context, viewing timestamps, and stable reading anchors are retained", async () => {
  const storage = createStorage();
  const history = new LocalStorageKeepHistoryStorage({ key: "metadata:history", storage });
  let clock = 99;
  const viewings = new LocalStorageKeepViewingRecordStorage({
    key: "metadata:viewings",
    storage,
    now: () => ++clock,
  });
  const progress = new LocalStorageKeepProgressStorage({ key: "metadata:progress", storage, now: () => 100 });
  await history.record("guide-a", 20, { language: "ja", deck: "beginner" });
  await history.record("guide-a", 10, { language: "en" });
  assert.deepEqual((await history.getAll())[0]?.context, { language: "ja", deck: "beginner" });
  const record = await viewings.add("guide-a", { viewedAt: 5 });
  assert.equal(record.createdAt, 100);
  assert.equal(record.updatedAt, 101);
  await viewings.set({ ...record, note: "Edited" });
  const updated = (await viewings.getAll())[0];
  assert.equal(updated?.createdAt, 100);
  assert.equal(updated?.updatedAt, 102);
  await progress.saveItem("guide-a", { readingPosition: "heading-intro", language: "ja", contentVersion: "v2" });
  assert.equal(
    (await progress.getItem("guide-a", { language: "ja", contentVersion: "v2" }))?.readingPosition,
    "heading-intro",
  );
  assert.equal(
    await progress.getItem("guide-a", { language: "ja", contentVersion: "v2", audioId: "other" }),
    undefined,
  );
});
