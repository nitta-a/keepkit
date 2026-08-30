import assert from "node:assert/strict";
import test from "node:test";
import {
  createStorageAdapter,
  exportItems,
  importItems,
  KeepBackupImportError,
  KeepBackupParseError,
  KeepStorageAccessError,
  KeepStorageError,
  KeepStorageParseError,
  KeepStorageQuotaError,
  LocalStorageAdapter,
  mergeKeepItems,
  migrateKeepItems,
  normalizeKeepTags,
} from "../dist/index.js";

const itemA = {
  id: "a",
  savedAt: 10,
  updatedAt: 10,
  meta: { title: "A" },
};

const itemB = {
  id: "b",
  savedAt: 20,
  updatedAt: 20,
  meta: { title: "B" },
};

function createStorage(initial = []) {
  const values = new Map([["keepkit:items", JSON.stringify(initial)]]);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
}

function backup(items = [itemA]) {
  return { format: "keepkit", version: 1, exportedAt: 1, items };
}

test("normalizes tags and exposes typed storage errors", () => {
  assert.deepEqual(normalizeKeepTags([" one ", "", "one", "two"]), ["one", "two"]);
  assert.equal(normalizeKeepTags(), undefined);
  assert.equal(normalizeKeepTags([" "]), undefined);

  const cause = new Error("cause");
  const error = new KeepStorageError("message", {
    operation: "set",
    storageKey: "key",
    cause,
  });
  assert.equal(error.name, "KeepStorageError");
  assert.equal(error.operation, "set");
  assert.equal(error.storageKey, "key");
  assert.equal(error.cause, cause);

  const quota = new KeepStorageQuotaError({ operation: "set" });
  const access = new KeepStorageAccessError({ operation: "getAll" });
  const parse = new KeepStorageParseError({ operation: "getAll" });
  assert.equal(quota.name, "KeepStorageQuotaError");
  assert.equal(access.name, "KeepStorageAccessError");
  assert.equal(parse.name, "KeepStorageParseError");
});

test("supports batch local-storage operations and missing browser storage", async () => {
  const storage = createStorage();
  const adapter = new LocalStorageAdapter({ key: "batch", storage });
  await adapter.setMany([itemA, itemB, { ...itemA, updatedAt: 11 }]);
  assert.deepEqual(await adapter.getAll(), [{ ...itemA, updatedAt: 11 }, itemB]);

  await adapter.removeMany(["a", "missing", "a"]);
  assert.deepEqual(await adapter.getAll(), [itemB]);

  await adapter.clear();
  assert.equal(storage.getItem("batch"), null);

  const ssrAdapter = new LocalStorageAdapter({ key: "ssr" });
  await ssrAdapter.set(itemA);
  await ssrAdapter.remove(itemA.id);
  await ssrAdapter.clear();
  assert.deepEqual(await ssrAdapter.getAll(), []);
});

test("wraps local-storage write, remove, clear, and quota failures", async () => {
  const causes = {
    write: new Error("write"),
    remove: new Error("remove"),
    clear: new Error("clear"),
  };
  const storage = {
    ...createStorage(),
    setItem: () => {
      throw causes.write;
    },
    removeItem: () => {
      throw causes.remove;
    },
  };
  const adapter = new LocalStorageAdapter({ storage });

  await assert.rejects(adapter.set(itemA), (error) => {
    assert.equal(error instanceof KeepStorageAccessError, true);
    assert.equal(error.operation, "set");
    assert.equal(error.cause, causes.write);
    return true;
  });
  await assert.rejects(adapter.remove(itemA.id), (error) => {
    assert.equal(error instanceof KeepStorageAccessError, true);
    assert.equal(error.operation, "remove");
    assert.equal(error.cause, causes.write);
    return true;
  });

  const clearStorage = {
    ...createStorage(),
    removeItem: () => {
      throw causes.clear;
    },
  };
  await assert.rejects(new LocalStorageAdapter({ storage: clearStorage }).clear(), (error) => {
    assert.equal(error instanceof KeepStorageAccessError, true);
    assert.equal(error.operation, "clear");
    assert.equal(error.cause, causes.clear);
    return true;
  });

  for (const quotaCause of [
    Object.assign(new Error("quota"), { name: "NS_ERROR_DOM_QUOTA_REACHED" }),
    Object.assign(new Error("quota"), { code: 1014 }),
  ]) {
    const quotaStorage = {
      ...createStorage(),
      setItem: () => {
        throw quotaCause;
      },
    };
    await assert.rejects(new LocalStorageAdapter({ storage: quotaStorage }).set(itemA), (error) => {
      assert.equal(error instanceof KeepStorageQuotaError, true);
      assert.equal(error.cause, quotaCause);
      return true;
    });
  }
});

test("validates all backup fields and accepts object backups", async () => {
  const adapter = new LocalStorageAdapter({ storage: createStorage() });
  const invalidBackups = [
    "not-json",
    null,
    { format: "other", version: 1, exportedAt: 1, items: [] },
    { format: "keepkit", version: 2, exportedAt: 1, items: [] },
    { format: "keepkit", version: 1, exportedAt: Infinity, items: [] },
    { format: "keepkit", version: 1, exportedAt: 1, items: {} },
    { format: "keepkit", version: 1, exportedAt: 1, items: [{ ...itemA, savedAt: "bad" }] },
    { format: "keepkit", version: 1, exportedAt: 1, items: [{ ...itemA, updatedAt: NaN }] },
    { format: "keepkit", version: 1, exportedAt: 1, items: [{ ...itemA, meta: undefined }] },
    { format: "keepkit", version: 1, exportedAt: 1, items: [{ ...itemA, note: 1 }] },
    { format: "keepkit", version: 1, exportedAt: 1, items: [{ ...itemA, tags: [1] }] },
    { format: "keepkit", version: 1, exportedAt: 1, items: [{ ...itemA, schemaVersion: NaN }] },
  ];

  for (const invalid of invalidBackups) {
    await assert.rejects(
      importItems(adapter, typeof invalid === "string" ? invalid : JSON.stringify(invalid)),
      (error) => {
        assert.equal(error instanceof KeepBackupParseError, true);
        return true;
      },
    );
  }

  const result = await importItems(adapter, backup([itemA, itemB]), { mode: "replace" });
  assert.deepEqual(result, {
    mode: "replace",
    imported: 2,
    failed: 0,
    total: 2,
    items: [itemA, itemB],
  });
});

test("exports JSON and reports merge and replace import failures", async () => {
  const source = new LocalStorageAdapter({ key: "source", storage: createStorage() });
  await source.set(itemA);
  const exported = await exportItems(source);
  const parsed = JSON.parse(exported);
  assert.deepEqual(parsed.items, [itemA]);
  assert.equal(parsed.format, "keepkit");
  assert.equal(parsed.version, 1);
  assert.equal(typeof parsed.exportedAt, "number");

  const mergeCause = new Error("merge failed");
  const mergeTarget = {
    getAll: async () => [],
    set: async () => undefined,
    remove: async () => undefined,
    clear: async () => undefined,
    merge: async () => {
      throw mergeCause;
    },
  };
  await assert.rejects(importItems(mergeTarget, backup()), (error) => {
    assert.equal(error instanceof KeepBackupImportError, true);
    assert.equal(error.mode, "merge");
    assert.equal(error.imported, 0);
    assert.equal(error.failed, 1);
    assert.equal(error.cause, mergeCause);
    return true;
  });

  const clearCause = new Error("clear failed");
  const replaceTarget = {
    getAll: async () => [],
    set: async () => undefined,
    remove: async () => undefined,
    clear: async () => {
      throw clearCause;
    },
  };
  await assert.rejects(importItems(replaceTarget, backup(), { mode: "replace" }), (error) => {
    assert.equal(error instanceof KeepBackupImportError, true);
    assert.equal(error.mode, "replace");
    assert.equal(error.imported, 0);
    assert.equal(error.failed, 1);
    assert.equal(error.cause, clearCause);
    return true;
  });
});

test("adapts optional persistence methods and normalizes subscriptions", async () => {
  const saved = new Map();
  let received: (() => void) | undefined;
  const adapter = createStorageAdapter({
    storageKey: "custom",
    getAll: () => [...saved.values()],
    set: (entry) => saved.set(entry.id, entry),
    setMany: (entries) => {
      entries.forEach((entry) => {
        saved.set(entry.id, entry);
      });
    },
    remove: (id) => saved.delete(id),
    removeMany: (ids) => {
      ids.forEach((id) => {
        saved.delete(id);
      });
    },
    clear: () => saved.clear(),
    merge: (localItems) => localItems,
    subscribe: (listener) => {
      received = listener;
      return undefined;
    },
  });

  assert.equal(adapter.storageKey, "custom");
  await adapter.setMany([itemA, itemB]);
  await adapter.removeMany([itemB.id]);
  assert.deepEqual(await adapter.getAll(), [itemA]);
  assert.deepEqual(await adapter.merge([itemB]), [itemB]);
  const unsubscribe = adapter.subscribe(() => undefined);
  assert.equal(typeof unsubscribe, "function");
  assert.equal(typeof received, "function");
  await adapter.clear();
  assert.deepEqual(await adapter.getAll(), []);
});

test("merges using a target merge method and migrates with cleanup", async () => {
  const local = [itemA];
  let mergeArgument: typeof local | undefined;
  const target = {
    getAll: async () => [],
    set: async () => undefined,
    remove: async () => undefined,
    clear: async () => undefined,
    merge: async (items) => {
      mergeArgument = items;
      return [itemB];
    },
  };
  assert.deepEqual(await mergeKeepItems(local, target), [itemB]);
  assert.equal(mergeArgument, local);

  let cleared = false;
  const source = {
    getAll: async () => local,
    set: async () => undefined,
    remove: async () => undefined,
    clear: async () => {
      cleared = true;
    },
  };
  assert.deepEqual(await migrateKeepItems(source, target), [itemB]);
  assert.equal(cleared, true);
});
