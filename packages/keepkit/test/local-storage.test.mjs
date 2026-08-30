import assert from "node:assert/strict";
import test from "node:test";
import { LocalStorageAdapter } from "../dist/index.js";

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

const item = {
  id: "favorite-1",
  resourceId: "article-1",
  title: "Example article",
  comment: "Read later",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

test("returns an empty array when there is no saved data", async () => {
  const adapter = new LocalStorageAdapter({ key: "test:favorites", storage: createStorage() });
  assert.deepEqual(await adapter.getAll(), []);
});

test("adds and reads favorites using the configured key", async () => {
  const storage = createStorage();
  const adapter = new LocalStorageAdapter({ key: "test:favorites", storage });

  await adapter.add(item);

  assert.deepEqual(await adapter.getAll(), [item]);
  assert.match(storage.getItem("test:favorites"), /article-1/);
});

test("updates a favorite and preserves immutable fields", async () => {
  const adapter = new LocalStorageAdapter({ storage: createStorage() });
  await adapter.add(item);

  await adapter.update(item.id, { comment: "Updated note", resourceId: "cannot-change" });
  const [updated] = await adapter.getAll();

  assert.equal(updated.comment, "Updated note");
  assert.equal(updated.resourceId, item.resourceId);
  assert.equal(updated.createdAt, item.createdAt);
  assert.notEqual(updated.updatedAt, item.updatedAt);
});

test("removes a favorite", async () => {
  const adapter = new LocalStorageAdapter({ storage: createStorage() });
  await adapter.add(item);

  await adapter.remove(item.id);

  assert.deepEqual(await adapter.getAll(), []);
});

test("does not require window during construction", async () => {
  const adapter = new LocalStorageAdapter({ key: "ssr:favorites" });
  assert.deepEqual(await adapter.getAll(), []);
});
