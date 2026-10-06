import assert from "node:assert/strict";
import test from "node:test";
import {
  createBrowserStorageAdapter,
  createScopedStorageAdapter,
  createStorageAdapter,
  exportItems,
  FallbackStorageAdapter,
  importItems,
  KeepBackupImportError,
  KeepBackupParseError,
  KeepStorageAccessError,
  KeepStorageParseError,
  KeepStorageQuotaError,
  LocalStorageAdapter,
  mergeKeepItems,
  migrateKeepItems,
  type StorageAdapter,
} from "../dist/core.js";

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

test("persists collection definitions in a separate localStorage key", async () => {
  const storage = createStorage();
  const adapter = new LocalStorageAdapter({ key: "collections-test", storage });
  await adapter.set(item);
  await adapter.setCollection({ id: "empty", name: "Empty" });
  await adapter.setCollection({ id: "reading", name: "Reading" });
  await adapter.setCollection({ id: "reading", name: "Read later" });
  assert.match(storage.getItem("collections-test:collections"), /Read later/);

  const reopened = new LocalStorageAdapter({ key: "collections-test", storage });
  assert.deepEqual(await reopened.getCollections(), [
    { id: "empty", name: "Empty" },
    { id: "reading", name: "Read later" },
  ]);
  await reopened.clear();
  assert.deepEqual(await reopened.getCollections(), await adapter.getCollections());
  await reopened.removeCollection("reading");
  assert.deepEqual(await adapter.getCollections(), [{ id: "empty", name: "Empty" }]);
});

test("rejects malformed collection metadata and reports collection write failures", async () => {
  const storage = createStorage();
  const adapter = new LocalStorageAdapter({ key: "invalid-collections", storage });
  storage.setItem("invalid-collections:collections", JSON.stringify([{ id: "empty", name: " " }]));
  await assert.rejects(adapter.getCollections(), KeepStorageParseError);

  storage.removeItem("invalid-collections:collections");
  const cause = Object.assign(new Error("full"), { name: "QuotaExceededError", code: 22 });
  const failing = new LocalStorageAdapter({
    key: "invalid-collections",
    storage: {
      ...storage,
      setItem: () => {
        throw cause;
      },
    },
  });
  await assert.rejects(failing.setCollection({ id: "empty", name: "Empty" }), KeepStorageQuotaError);
});

test("keeps fallback collection metadata current and migrates it when the primary is empty", async () => {
  const primaryStorage = createStorage();
  const fallbackStorage = createStorage();
  const primary = new LocalStorageAdapter({ key: "primary", storage: primaryStorage });
  const fallback = new LocalStorageAdapter({ key: "fallback", storage: fallbackStorage });
  await fallback.setCollection({ id: "saved", name: "Saved" });
  const adapter = new FallbackStorageAdapter({ primary, fallback, migrateFallbackOnEmpty: true, mirrorWrites: true });
  assert.deepEqual(await adapter.getCollections?.(), [{ id: "saved", name: "Saved" }]);
  assert.deepEqual(await primary.getCollections(), [{ id: "saved", name: "Saved" }]);
  await adapter.setCollection?.({ id: "empty", name: "Empty" });
  assert.deepEqual(await fallback.getCollections(), [
    { id: "saved", name: "Saved" },
    { id: "empty", name: "Empty" },
  ]);
});

test("isolates collection definitions by user scope", async () => {
  const base = new LocalStorageAdapter({ key: "scoped-collections", storage: createStorage() });
  const alice = createScopedStorageAdapter(base, { userId: "alice" });
  const bob = createScopedStorageAdapter(base, { userId: "bob" });
  await alice.setCollection?.({ id: "route", name: "Alice route" });
  await bob.setCollection?.({ id: "route", name: "Bob route" });
  assert.deepEqual(await alice.getCollections?.(), [{ id: "route", name: "Alice route", scope: { userId: "alice" } }]);
  assert.deepEqual(await bob.getCollections?.(), [{ id: "route", name: "Bob route", scope: { userId: "bob" } }]);
  await alice.removeCollection?.("route");
  assert.deepEqual(await alice.getCollections?.(), []);
  assert.equal((await bob.getCollections?.())?.[0]?.name, "Bob route");
});

test("reports malformed JSON and invalid item arrays", async () => {
  const storage = createStorage();
  const adapter = new LocalStorageAdapter({ storage });
  storage.setItem(adapter.storageKey, "not-json");
  await assert.rejects(adapter.getAll(), (error) => {
    assert.equal(error instanceof KeepStorageParseError, true);
    assert.equal(error.operation, "getAll");
    return true;
  });

  storage.setItem(adapter.storageKey, JSON.stringify([{ id: "missing-fields" }]));
  await assert.rejects(adapter.getAll(), KeepStorageParseError);

  storage.setItem(adapter.storageKey, JSON.stringify([{ ...item, order: "bad" }]));
  await assert.rejects(adapter.getAll(), KeepStorageParseError);
});

test("wraps storage access failures", async () => {
  const cause = new Error("storage is blocked");
  const storage = {
    ...createStorage(),
    getItem: () => {
      throw cause;
    },
  };
  const adapter = new LocalStorageAdapter({ storage });

  await assert.rejects(adapter.getAll(), (error) => {
    assert.equal(error instanceof KeepStorageAccessError, true);
    assert.equal(error.cause, cause);
    assert.equal(error.storageKey, adapter.storageKey);
    return true;
  });
});

test("wraps quota failures with a typed error", async () => {
  const cause = Object.assign(new Error("full"), { name: "QuotaExceededError", code: 22 });
  const storage = {
    ...createStorage(),
    setItem: () => {
      throw cause;
    },
  };
  const adapter = new LocalStorageAdapter({ storage });

  await assert.rejects(adapter.set(item), (error) => {
    assert.equal(error instanceof KeepStorageQuotaError, true);
    assert.equal(error.cause, cause);
    assert.equal(error.operation, "set");
    return true;
  });
});

test("exports and imports versioned backups", async () => {
  const storage = createStorage();
  const adapter = new LocalStorageAdapter({ key: "backup:source", storage });
  const target = new LocalStorageAdapter({ key: "backup:target", storage });
  await adapter.set({ ...item, tags: ["reading"] });

  const backup = await exportItems(adapter);
  const result = await importItems(target, backup, { mode: "replace" });

  assert.equal(JSON.parse(backup).format, "keepkit");
  assert.equal(JSON.parse(backup).version, 2);
  assert.equal(result.imported, 1);
  assert.equal(result.failed, 0);
  assert.deepEqual(await target.getAll(), [{ ...item, tags: ["reading"] }]);
});

test("rejects unsupported backup data", async () => {
  const adapter = new LocalStorageAdapter({ storage: createStorage() });
  await assert.rejects(importItems(adapter, JSON.stringify({ version: 999 })), KeepBackupParseError);
});

test("reports persistence failures during backup import", async () => {
  const cause = new Error("write failed");
  const adapter = {
    getAll: async () => [],
    set: async () => {
      throw cause;
    },
    remove: async () => undefined,
    clear: async () => undefined,
  };
  const backup = JSON.stringify({
    format: "keepkit",
    version: 1,
    exportedAt: 1,
    items: [item],
  });

  await assert.rejects(importItems(adapter, backup, { mode: "replace" }), (error) => {
    assert.equal(error instanceof KeepBackupImportError, true);
    assert.equal(error.failed, 1);
    assert.equal(error.cause, cause);
    return true;
  });
});

test("creates an adapter from sync persistence functions", async () => {
  const saved = new Map();
  const adapter = createStorageAdapter({
    storageKey: "sync:adapter",
    getAll: () => [...saved.values()],
    set: (entry) => saved.set(entry.id, entry),
    remove: (id) => saved.delete(id),
    clear: () => saved.clear(),
  });

  await adapter.set(item);
  assert.equal(adapter.storageKey, "sync:adapter");
  assert.deepEqual(await adapter.getAll(), [item]);
});

test("switches to a fallback adapter after an IndexedDB access failure", async () => {
  const cause = new KeepStorageAccessError({
    operation: "getAll",
    storageKey: "indexed-db",
    cause: new Error("blocked"),
  });
  let fallbackWrites = 0;
  const fallback: StorageAdapter<typeof item.meta> = {
    getAll: async () => [item],
    set: async () => {
      fallbackWrites += 1;
    },
    remove: async () => undefined,
    clear: async () => undefined,
  };
  const primary: StorageAdapter<typeof item.meta> = {
    getAll: async () => {
      throw cause;
    },
    set: async () => undefined,
    remove: async () => undefined,
    clear: async () => undefined,
  };
  let fallbackError: unknown;
  const adapter = new FallbackStorageAdapter({
    primary,
    fallback,
    onFallback: (error) => {
      fallbackError = error;
    },
  });

  assert.deepEqual(await adapter.getAll(), [item]);
  await adapter.set(item);
  assert.equal(fallbackWrites, 1);
  assert.equal(adapter.isUsingFallback, true);
  assert.equal(fallbackError, cause);
});

test("preserves parse errors, mirrors healthy writes, and routes subscriptions by active adapter", async () => {
  const parseError = new KeepStorageParseError({ operation: "getAll", storageKey: "primary" });
  const primaryListeners = new Set<() => void>();
  const fallbackListeners = new Set<() => void>();
  const primaryItems: (typeof item)[] = [];
  const fallbackItems: (typeof item)[] = [];
  const createAdapter = (
    values: (typeof item)[],
    listeners: Set<() => void>,
    shouldFail = false,
  ): StorageAdapter<typeof item.meta> => ({
    storageKey: "shared",
    getAll: async () => {
      if (shouldFail) throw parseError;
      return [...values];
    },
    set: async (next) => {
      values.splice(0, values.length, next);
      listeners.forEach((listener) => {
        listener();
      });
    },
    setMany: async (next) => {
      values.splice(0, values.length, ...next);
    },
    remove: async () => undefined,
    clear: async () => values.splice(0),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
  const parsePrimary = createAdapter(primaryItems, primaryListeners, true);
  const fallback = createAdapter(fallbackItems, fallbackListeners);
  const parseAdapter = new FallbackStorageAdapter({ primary: parsePrimary, fallback });
  await assert.rejects(parseAdapter.getAll(), (error) => error === parseError);
  assert.equal(parseAdapter.isUsingFallback, false);

  const healthyPrimary = createAdapter(primaryItems, primaryListeners);
  const mirrored = new FallbackStorageAdapter({
    primary: healthyPrimary,
    fallback,
    mirrorWrites: true,
  });
  let calls = 0;
  const unsubscribe = mirrored.subscribe(() => calls++);
  await mirrored.set(item);
  assert.deepEqual(primaryItems, [item]);
  assert.deepEqual(fallbackItems, [item]);
  primaryListeners.forEach((listener) => {
    listener();
  });
  fallbackListeners.forEach((listener) => {
    listener();
  });
  assert.equal(calls, 2);
  unsubscribe();
  primaryListeners.forEach((listener) => {
    listener();
  });
  assert.equal(calls, 2);
});

test("uses fallback batch methods and honors custom fallback predicates", async () => {
  const calls: string[] = [];
  const cause = new Error("temporary");
  const primary: StorageAdapter<typeof item.meta> = {
    getAll: async () => [],
    set: async () => {
      calls.push("primary:set");
      throw cause;
    },
    remove: async () => {
      calls.push("primary:remove");
      throw cause;
    },
    clear: async () => {
      calls.push("primary:clear");
      throw cause;
    },
  };
  const fallback: StorageAdapter<typeof item.meta> = {
    getAll: async () => [],
    set: async () => calls.push("fallback:set"),
    setMany: async () => calls.push("fallback:setMany"),
    remove: async () => calls.push("fallback:remove"),
    removeMany: async () => calls.push("fallback:removeMany"),
    clear: async () => calls.push("fallback:clear"),
  };
  const adapter = new FallbackStorageAdapter({
    primary,
    fallback,
    shouldFallback: (error) => error === cause,
  });
  await adapter.setMany([item]);
  await adapter.removeMany([item.id]);
  await adapter.clear();
  assert.equal(adapter.isUsingFallback, true);
  assert.deepEqual(calls, ["primary:set", "fallback:setMany", "fallback:removeMany", "fallback:clear"]);

  const notRecoverable = new Error("not recoverable");
  const noFallback = new FallbackStorageAdapter({
    primary: {
      ...primary,
      set: async () => {
        throw notRecoverable;
      },
    },
    fallback,
    shouldFallback: () => false,
  });
  await assert.rejects(noFallback.set(item), (error) => error === notRecoverable);
  assert.equal(noFallback.isUsingFallback, false);
});

test("creates a local-storage adapter when IndexedDB is unavailable", async () => {
  const storage = createStorage();
  const adapter = createBrowserStorageAdapter({ key: "browser-fallback", indexedDB: undefined, storage });
  assert.equal(adapter instanceof LocalStorageAdapter, true);
  await adapter.set(item);
  assert.deepEqual(await adapter.getAll(), [item]);
});

test("migrates legacy fallback data into an empty primary adapter", async () => {
  let primaryItems: (typeof item)[] = [];
  const primary: StorageAdapter<typeof item.meta> = {
    getAll: async () => primaryItems,
    set: async (next) => {
      primaryItems = [...primaryItems.filter((current) => current.id !== next.id), next];
    },
    setMany: async (next) => {
      primaryItems = [...next];
    },
    remove: async () => undefined,
    clear: async () => undefined,
  };
  const fallback = new LocalStorageAdapter<typeof item.meta>({ storage: createStorage() });
  await fallback.set(item);
  const adapter = new FallbackStorageAdapter({
    primary,
    fallback,
    migrateFallbackOnEmpty: true,
  });

  assert.deepEqual(await adapter.getAll(), [item]);
  assert.deepEqual(primaryItems, [item]);
  assert.equal(adapter.isUsingFallback, false);
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

test("subscribes to matching storage events and unsubscribes cleanly", () => {
  const listeners = new Set();
  globalThis.window = {
    addEventListener: (type, listener) => {
      if (type === "storage") listeners.add(listener);
    },
    removeEventListener: (type, listener) => {
      if (type === "storage") listeners.delete(listener);
    },
  };

  const adapter = new LocalStorageAdapter({ key: "sync:items", storage: createStorage() });
  let calls = 0;
  const unsubscribe = adapter.subscribe(() => calls++);

  for (const listener of listeners) listener({ key: "other:items" });
  for (const listener of listeners) listener({ key: "sync:items" });
  for (const listener of listeners) listener({ key: null });
  assert.equal(calls, 2);

  unsubscribe();
  assert.equal(listeners.size, 0);
  delete globalThis.window;
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
