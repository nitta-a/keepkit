import assert from "node:assert/strict";
import test from "node:test";
import { LocalStorageAdapter, mergeKeepItems, migrateKeepItems } from "../dist/index.js";

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
}

const item = {
  id: "article-1",
  savedAt: 1735689600000,
  updatedAt: 1735689600000,
  targetType: "article",
  meta: { title: "Example article", url: "https://example.com" },
};

test("returns an empty array when there is no saved data", async () => {
  const adapter = new LocalStorageAdapter({ key: "test:items", storage: createStorage() });
  assert.deepEqual(await adapter.getAll(), []);
});

test("sets and reads items using the configured key", async () => {
  const storage = createStorage();
  const adapter = new LocalStorageAdapter({ key: "test:items", storage });

  await adapter.set(item);

  assert.deepEqual(await adapter.getAll(), [item]);
  assert.match(storage.getItem("test:items"), /article-1/);
});

test("upserts an item with the same id", async () => {
  const adapter = new LocalStorageAdapter({ storage: createStorage() });
  await adapter.set(item);
  const updated = { ...item, updatedAt: item.updatedAt + 1, note: "Read this" };

  await adapter.set(updated);

  assert.deepEqual(await adapter.getAll(), [updated]);
});

test("removes and clears items", async () => {
  const adapter = new LocalStorageAdapter({ storage: createStorage() });
  await adapter.set(item);
  await adapter.remove(item.id);
  assert.deepEqual(await adapter.getAll(), []);

  await adapter.set(item);
  await adapter.clear();
  assert.deepEqual(await adapter.getAll(), []);
});

test("ignores malformed JSON and invalid item arrays", async () => {
  const storage = createStorage();
  const adapter = new LocalStorageAdapter({ storage });
  storage.setItem(adapter.storageKey, "not-json");
  assert.deepEqual(await adapter.getAll(), []);

  storage.setItem(adapter.storageKey, JSON.stringify([{ id: "missing-fields" }]));
  assert.deepEqual(await adapter.getAll(), []);
});

test("merges local items and keeps the newest version", async () => {
  const storage = createStorage();
  const adapter = new LocalStorageAdapter({ storage });
  await adapter.set({ ...item, note: "remote" });

  const merged = await adapter.merge([
    { ...item, updatedAt: item.updatedAt - 1, note: "old local" },
    {
      id: "product-1",
      savedAt: item.savedAt,
      updatedAt: item.updatedAt + 1,
      targetType: "product",
      meta: { title: "Example product" },
    },
  ]);

  assert.equal(merged.find((entry) => entry.id === item.id)?.note, "remote");
  assert.equal(
    merged.some((entry) => entry.id === "product-1"),
    true,
  );
});

test("does not require window during construction", async () => {
  const adapter = new LocalStorageAdapter({ key: "ssr:items" });
  assert.deepEqual(await adapter.getAll(), []);
});

test("merges local items into an adapter without merge support", async () => {
  const saved = new Map();
  const target = {
    getAll: async () => [...saved.values()],
    set: async (entry) => saved.set(entry.id, entry),
    remove: async (id) => saved.delete(id),
    clear: async () => saved.clear(),
  };
  const merged = await mergeKeepItems([item], target);

  assert.deepEqual(merged, [item]);
  assert.deepEqual([...saved.values()], [item]);
});

test("migrates items and clears the local source after success", async () => {
  const source = new LocalStorageAdapter({ key: "local:items", storage: createStorage() });
  const target = new LocalStorageAdapter({ key: "remote:items", storage: createStorage() });
  await source.set(item);

  const merged = await migrateKeepItems(source, target);

  assert.deepEqual(merged, [item]);
  assert.deepEqual(await source.getAll(), []);
  assert.deepEqual(await target.getAll(), [item]);
});
