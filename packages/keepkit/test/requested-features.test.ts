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
  mergeKeepItems,
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

test("empty-string scope identifiers get a distinct browser storage key", () => {
  const storage = createStorage();
  const unscoped = createBrowserStorageAdapter({ key: "empty-scope-key", indexedDB: undefined, storage });
  const emptyObject = createBrowserStorageAdapter({
    key: "empty-scope-key",
    indexedDB: undefined,
    scope: {},
    storage,
  });
  const emptyUser = createBrowserStorageAdapter({
    key: "empty-scope-key",
    indexedDB: undefined,
    scope: { userId: "" },
    storage,
  });
  const emptyTenant = createBrowserStorageAdapter({
    key: "empty-scope-key",
    indexedDB: undefined,
    scope: { tenantId: "" },
    storage,
  });

  assert.equal(emptyObject.storageKey, unscoped.storageKey);
  assert.notEqual(emptyUser.storageKey, unscoped.storageKey);
  assert.notEqual(emptyTenant.storageKey, unscoped.storageKey);
  assert.notEqual(emptyTenant.storageKey, emptyUser.storageKey);
});

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

test("serializes parallel collection additions and reorder operations on one adapter", async () => {
  const adapter = new LocalStorageAdapter({ key: "request:parallel-collections", storage: createStorage() });
  await adapter.setMany([
    savedItem,
    { id: "guide-b", savedAt: 2, updatedAt: 2, meta: { title: "Guide B" } },
    { id: "guide-c", savedAt: 3, updatedAt: 3, meta: { title: "Guide C" } },
  ]);

  await Promise.all([
    addKeepItemToCollection(adapter, "course", "guide-a"),
    addKeepItemToCollection(adapter, "course", "guide-b"),
    addKeepItemToCollection(adapter, "course", "guide-c"),
    reorderKeepCollectionItems(adapter, "course", ["guide-c", "guide-a"]),
  ]);

  assert.deepEqual(await adapter.getCollectionMemberships(), [
    { collectionId: "course", itemId: "guide-c", order: 0 },
    { collectionId: "course", itemId: "guide-a", order: 1 },
    { collectionId: "course", itemId: "guide-b", order: 2 },
  ]);
  assert.equal((await adapter.getAll()).length, 3);
});

test("parallel low-level membership upserts and removals preserve other entries", async () => {
  const adapter = new LocalStorageAdapter({ key: "request:parallel-membership-writes", storage: createStorage() });
  await Promise.all([
    adapter.setCollectionMembership({ collectionId: "course", itemId: "guide-a", order: 0 }),
    adapter.setCollectionMembership({ collectionId: "course", itemId: "guide-b", order: 1 }),
    adapter.setCollectionMembership({ collectionId: "course", itemId: "guide-c", order: 2 }),
  ]);
  assert.deepEqual((await adapter.getCollectionMemberships()).map((entry) => entry.itemId).sort(), [
    "guide-a",
    "guide-b",
    "guide-c",
  ]);

  await Promise.all([
    adapter.removeCollectionMembership("course", "guide-a"),
    adapter.removeCollectionMembership("course", "guide-b"),
  ]);
  assert.deepEqual(await adapter.getCollectionMemberships(), [{ collectionId: "course", itemId: "guide-c", order: 2 }]);
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

test("same-key activity updates from separate instances use cross-context locks", async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const lockNames: string[] = [];
  let queue: Promise<unknown> = Promise.resolve();
  const locks = {
    request: <T>(name: string, operation: () => Promise<T>): Promise<T> => {
      lockNames.push(name);
      const next = queue.then(operation);
      queue = next.catch(() => undefined);
      return next;
    },
  };
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { locks } });

  try {
    const storage = createStorage();
    const historyA = new LocalStorageKeepHistoryStorage({ key: "cross-context:history", storage });
    const historyB = new LocalStorageKeepHistoryStorage({ key: "cross-context:history", storage });
    const viewingA = new LocalStorageKeepViewingRecordStorage({
      key: "cross-context:viewings",
      storage,
      createId: () => "view-a",
    });
    const viewingB = new LocalStorageKeepViewingRecordStorage({
      key: "cross-context:viewings",
      storage,
      createId: () => "view-b",
    });
    const progressA = new LocalStorageKeepProgressStorage({ key: "cross-context:progress", storage, now: () => 1 });
    const progressB = new LocalStorageKeepProgressStorage({ key: "cross-context:progress", storage, now: () => 2 });

    await Promise.all([
      historyA.record("history-a", 10),
      historyB.record("history-b", 20),
      viewingA.add("view-a", { viewedAt: 10 }),
      viewingB.add("view-b", { viewedAt: 20 }),
      progressA.saveItem("progress-a", { readingPosition: "section-a" }),
      progressB.saveItem("progress-b", { readingPosition: "section-b" }),
    ]);

    assert.deepEqual((await historyA.getAll()).map((entry) => entry.itemId).sort(), ["history-a", "history-b"]);
    assert.deepEqual((await viewingA.getAll()).map((entry) => entry.id).sort(), ["view-a", "view-b"]);
    const originalViewing = (await viewingA.getAll()).find((entry) => entry.id === "view-a");
    assert.ok(originalViewing?.updatedAt !== undefined);
    await viewingA.set({ ...originalViewing, note: "newer", updatedAt: originalViewing.updatedAt + 10 });
    await viewingB.set({ ...originalViewing, note: "stale", updatedAt: originalViewing.updatedAt + 5 });
    assert.equal((await viewingA.getAll()).find((entry) => entry.id === "view-a")?.note, "newer");
    assert.deepEqual(
      (await progressA.getAll())
        .filter((entry) => entry.kind === "item")
        .map((entry) => entry.itemId)
        .sort(),
      ["progress-a", "progress-b"],
    );
    await Promise.all([
      progressA.saveItem("shared-progress", { readingPosition: "section-a" }),
      progressB.saveItem("shared-progress", { audioPositionMs: 45, audioId: "track-a" }),
    ]);
    const sharedProgress = await progressA.getItem("shared-progress", { audioId: "track-a" });
    assert.equal(sharedProgress?.readingPosition, "section-a");
    assert.equal(sharedProgress?.audioPositionMs, 45);
    assert.equal(sharedProgress?.audioId, "track-a");
    await progressA.set({ kind: "item", itemId: "conflicted-progress", readingPosition: "latest", updatedAt: 50 });
    await progressB.set({ kind: "item", itemId: "conflicted-progress", readingPosition: "stale", updatedAt: 40 });
    assert.equal((await progressA.getItem("conflicted-progress"))?.readingPosition, "latest");
    assert.deepEqual([...new Set(lockNames)].sort(), [
      "keepkit:local-storage:cross-context:history",
      "keepkit:local-storage:cross-context:progress",
      "keepkit:local-storage:cross-context:viewings",
    ]);
  } finally {
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
});

test("browser activity writes fail before mutation when cross-tab locking is unavailable", async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });

  try {
    const storage = createStorage();
    const history = new LocalStorageKeepHistoryStorage({ key: "no-lock:history", storage });
    await assert.rejects(history.record("guide-a", 1), /Web Locks API/);
    assert.equal(storage.getItem("no-lock:history"), null);
  } finally {
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else Reflect.deleteProperty(globalThis, "navigator");
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
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
  await base.setCollection({ id: "course", name: "Alice course", scope: { userId: "alice" } });
  await base.setCollection({ id: "course", name: "Bob course", scope: { userId: "bob" } });
  await base.setCollectionMembership({
    collectionId: "course",
    itemId: savedItem.id,
    order: 1,
    scope: { userId: "alice" },
  });
  await base.setCollectionMembership({
    collectionId: "course",
    itemId: savedItem.id,
    order: 2,
    scope: { userId: "bob" },
  });
  const alice = createScopedStorageAdapter(base, { userId: "alice" });
  const beforeRejectedImport = {
    items: await base.getAll(),
    collections: await base.getCollections(),
    memberships: await base.getCollectionMemberships(),
  };
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
    {
      items: await base.getAll(),
      collections: await base.getCollections(),
      memberships: await base.getCollectionMemberships(),
    },
    beforeRejectedImport,
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

test("shared local storage backup merge preserves same IDs across users and tenants", async () => {
  const storage = createStorage();
  const adapter = new LocalStorageAdapter({ key: "multi-scope-merge", storage });
  const alice = { userId: "alice", tenantId: "tenant-1" };
  const bob = { userId: "bob", tenantId: "tenant-1" };
  const tenantTwo = { userId: "alice", tenantId: "tenant-2" };
  await adapter.set({ ...savedItem, id: "guide-1", note: "Alice memo", updatedAt: 2, lastOpenedAt: 20, scope: alice });
  await adapter.set({ ...savedItem, id: "guide-1", note: "Bob memo", updatedAt: 3, lastOpenedAt: 30, scope: bob });
  await adapter.set({
    ...savedItem,
    id: "guide-1",
    note: "Tenant memo",
    updatedAt: 4,
    lastOpenedAt: 40,
    scope: tenantTwo,
  });
  await adapter.setCollection({ id: "X", name: "Aの予定", scope: alice });
  await adapter.setCollection({ id: "X", name: "Bの予定", scope: bob });
  await adapter.setCollection({ id: "X", name: "別テナント", scope: tenantTwo });
  await adapter.setCollectionMembership({ collectionId: "X", itemId: "guide-1", order: 1, scope: alice });
  await adapter.setCollectionMembership({ collectionId: "X", itemId: "guide-1", order: 2, scope: bob });
  await adapter.setCollectionMembership({ collectionId: "X", itemId: "guide-1", order: 3, scope: tenantTwo });

  const backup = await exportItems(adapter);
  await importItems(adapter, backup, { mode: "merge", collectionNameConflict: "existing" });
  await importItems(adapter, backup, { mode: "merge", collectionNameConflict: "existing" });

  const items = await adapter.getAll();
  assert.equal(items.length, 3);
  assert.deepEqual(
    items.map(({ scope, note, lastOpenedAt }) => ({ scope, note, lastOpenedAt })),
    [
      { scope: tenantTwo, note: "Tenant memo", lastOpenedAt: 40 },
      { scope: bob, note: "Bob memo", lastOpenedAt: 30 },
      { scope: alice, note: "Alice memo", lastOpenedAt: 20 },
    ],
  );
  assert.deepEqual(
    (await adapter.getCollections()).map(({ scope, name }) => ({ scope, name })),
    [
      { scope: alice, name: "Aの予定" },
      { scope: bob, name: "Bの予定" },
      { scope: tenantTwo, name: "別テナント" },
    ],
  );
  assert.deepEqual(
    (await adapter.getCollectionMemberships()).map(({ scope, order }) => ({ scope, order })),
    [
      { scope: alice, order: 1 },
      { scope: bob, order: 2 },
      { scope: tenantTwo, order: 3 },
    ],
  );

  const backupWins = new LocalStorageAdapter({ key: "multi-scope-backup-name", storage });
  await backupWins.setCollection({ id: "X", name: "Old Alice name", scope: alice });
  await backupWins.setCollection({ id: "X", name: "Old Bob name", scope: bob });
  await backupWins.setCollection({ id: "X", name: "Old tenant name", scope: tenantTwo });
  await importItems(backupWins, backup, { mode: "merge", collectionNameConflict: "backup" });
  assert.deepEqual(
    (await backupWins.getCollections()).map(({ scope, name }) => ({ scope, name })),
    [
      { scope: alice, name: "Aの予定" },
      { scope: bob, name: "Bの予定" },
      { scope: tenantTwo, name: "別テナント" },
    ],
  );

  const restored = new LocalStorageAdapter({ key: "multi-scope-merge-restored", storage });
  await importItems(restored, backup, { mode: "merge", collectionNameConflict: "existing" });
  const firstRestore = {
    items: await restored.getAll(),
    collections: await restored.getCollections(),
    memberships: await restored.getCollectionMemberships(),
  };
  await importItems(restored, backup, { mode: "merge", collectionNameConflict: "existing" });
  assert.deepEqual(
    {
      items: await restored.getAll(),
      collections: await restored.getCollections(),
      memberships: await restored.getCollectionMemberships(),
    },
    firstRestore,
  );
});

test("mergeKeepItems fallback identifies records by scope and ID", async () => {
  const storage = createStorage();
  const base = new LocalStorageAdapter({ key: "merge-keep-items-scoped", storage });
  const alice = { userId: "alice", tenantId: "tenant-1" };
  const bob = { userId: "bob", tenantId: "tenant-1" };
  await base.set({ ...savedItem, id: "guide-1", note: "Alice old", updatedAt: 1, lastOpenedAt: 4, scope: alice });
  await base.set({ ...savedItem, id: "guide-1", note: "Bob", updatedAt: 2, lastOpenedAt: 8, scope: bob });
  const target: StorageAdapter = {
    getAll: () => base.getAll(),
    set: (item) => base.set(item),
    setMany: (items) => base.setMany?.(items) ?? Promise.all(items.map((item) => base.set(item))).then(() => undefined),
    remove: (id, scope) => base.remove(id, scope),
    clear: () => base.clear(),
  };

  const merged = await mergeKeepItems(
    [{ ...savedItem, id: "guide-1", note: "Alice new", updatedAt: 3, lastOpenedAt: 5, scope: alice }],
    target,
  );

  assert.equal(merged.length, 2);
  assert.deepEqual(
    merged.find((item) => item.scope?.userId === "alice"),
    {
      ...savedItem,
      id: "guide-1",
      note: "Alice new",
      updatedAt: 3,
      lastOpenedAt: 5,
      scope: alice,
    },
  );
  assert.deepEqual(
    merged.find((item) => item.scope?.userId === "bob"),
    {
      ...savedItem,
      id: "guide-1",
      note: "Bob",
      updatedAt: 2,
      lastOpenedAt: 8,
      scope: bob,
    },
  );
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
