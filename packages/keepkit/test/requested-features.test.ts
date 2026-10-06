import assert from "node:assert/strict";
import test from "node:test";
import {
  addKeepItemToCollection,
  exportItems,
  importItems,
  type KeepBackupV1,
  LocalStorageAdapter,
  LocalStorageKeepHistoryStorage,
  LocalStorageKeepProgressStorage,
  LocalStorageKeepViewingRecordStorage,
  removeKeepItemFromCollection,
  reorderKeepCollectionItems,
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
    language: "ja",
    contentVersion: "2026-01",
  });

  assert.equal((await progress.getCourse("course-a"))?.currentItemId, "guide-a");
  assert.equal(
    (await progress.getItem("guide-a", { language: "ja", contentVersion: "2026-01" }))?.audioPositionMs,
    1250,
  );
  assert.equal(await progress.getItem("guide-a"), undefined);
  assert.equal(await progress.getItem("guide-a", { language: "ja" }), undefined);
  assert.equal(await progress.getItem("guide-a", { contentVersion: "2026-02" }), undefined);
  await progress.resetItem("guide-a");
  assert.equal(await progress.getItem("guide-a"), undefined);
  assert.equal((await progress.getAll()).length, 1);

  await assert.rejects(progress.set({ kind: "item", itemId: "guide-a", audioPositionMs: -1, updatedAt: 1 }), TypeError);
});
