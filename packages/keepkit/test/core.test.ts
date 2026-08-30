import assert from "node:assert/strict";
import test from "node:test";
import {
  createKeepInvalidationPlugin,
  createStorageAdapter,
  exportItems,
  KeepStore as FrameworkNeutralKeepStore,
  getTagCounts,
  importItems,
  isKeepItemMetadataStale,
  KeepBackupImportError,
  KeepBackupParseError,
  KeepSchemaValidationError,
  KeepStorageAccessError,
  KeepStorageError,
  KeepStorageParseError,
  KeepStorageQuotaError,
  KeepStore,
  LocalStorageAdapter,
  mergeKeepItems,
  migrateKeepItems,
  normalizeKeepTags,
  parseKeepMeta,
  queryKeepItems,
  reconcileKeepItems,
  revalidateKeepItems,
  SyncStorageAdapter,
} from "../dist/core.js";

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

test("publishes framework-neutral primitives through the core entry point", () => {
  assert.equal(FrameworkNeutralKeepStore, KeepStore);
  const store = new FrameworkNeutralKeepStore({
    items: [itemA],
    isLoading: false,
    isHydrated: true,
    isMutating: false,
    error: null,
  });
  assert.deepEqual(store.getSnapshot().items, [itemA]);
});

test("refreshes metadata and detects or removes unavailable items", async () => {
  const source = [
    { ...itemA, metaUpdatedAt: 10 },
    { ...itemB, metaUpdatedAt: 10 },
    { id: "c", savedAt: 30, updatedAt: 30, meta: { title: "C" } },
  ];
  const summary = await revalidateKeepItems(
    source,
    async (item) => {
      if (item.id === "a") return { status: "available", meta: { title: "A refreshed" } };
      if (item.id === "b") return { status: "private", reason: "account-only" };
      return "expired";
    },
    { removeStatuses: ["expired"], now: () => 100 },
  );

  assert.equal(summary.checked, 3);
  assert.equal(summary.updated, 1);
  assert.equal(summary.removed, 1);
  assert.deepEqual(summary.items, [
    { ...itemA, meta: { title: "A refreshed" }, metaUpdatedAt: 100, updatedAt: 100 },
    { ...itemB, metaUpdatedAt: 10 },
  ]);
  assert.deepEqual(summary.removedIds, ["c"]);
  assert.deepEqual(
    summary.results.map(({ item, status, updated }) => ({ id: item.id, status, updated })),
    [
      { id: "a", status: "available", updated: true },
      { id: "b", status: "private", updated: false },
      { id: "c", status: "expired", updated: false },
    ],
  );

  const values = new Map(source.map((item) => [item.id, item]));
  const storage = {
    getAll: async () => [...values.values()],
    set: async (item) => void values.set(item.id, item),
    remove: async (id) => void values.delete(id),
    clear: async () => void values.clear(),
  };
  await reconcileKeepItems(storage, async (item) => (item.id === "b" ? "deleted" : "available"), {
    removeStatuses: ["deleted"],
  });
  assert.deepEqual([...values.keys()], ["a", "c"]);
});

test("identifies metadata that has exceeded its freshness window", () => {
  assert.equal(
    isKeepItemMetadataStale({ ...itemA, metaUpdatedAt: 90 }, 10, () => 100),
    true,
  );
  assert.equal(
    isKeepItemMetadataStale({ ...itemA, metaUpdatedAt: 91 }, 10, () => 100),
    false,
  );
  assert.equal(
    isKeepItemMetadataStale(itemA, 60, () => 100),
    true,
  );
});

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

test("notifies store subscribers only when state changes", () => {
  const store = new KeepStore({
    items: [],
    isLoading: false,
    isHydrated: false,
    isMutating: false,
    error: null,
  });
  let calls = 0;
  const unsubscribe = store.subscribe(() => calls++);
  const initial = store.getSnapshot();
  store.setState({ isLoading: false });
  assert.equal(calls, 0);
  store.setState({ isHydrated: true });
  assert.equal(calls, 1);
  assert.equal(store.getSnapshot().isHydrated, true);
  assert.notEqual(store.getSnapshot(), initial);
  unsubscribe();
  store.setState({ isLoading: true });
  assert.equal(calls, 1);
});

test("invalidates static and context-derived query keys after plugin completion", async () => {
  const invalidated: string[] = [];
  const staticPlugin = createKeepInvalidationPlugin({
    name: "static-cache",
    queryKeys: ["items", "all"],
    invalidate: async (key, context) => {
      invalidated.push(`${key.join(":")}:${context.action}`);
    },
  });
  assert.equal(staticPlugin.name, "static-cache");
  await staticPlugin.after?.({ action: "save", id: "a", item: itemA });

  const dynamicPlugin = createKeepInvalidationPlugin({
    queryKeys: (context) => [["items", context.id], ["tags"]],
    invalidate: (key) => invalidated.push(key.join(":")),
  });
  assert.equal(dynamicPlugin.name, "keepkit-cache-invalidation");
  await dynamicPlugin.after?.({ action: "remove", id: "a" });
  assert.deepEqual(invalidated, ["items:all:save", "items:a", "tags"]);
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
    { format: "keepkit", version: 1, exportedAt: 1, items: [{ ...itemA, metaUpdatedAt: "bad" }] },
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

test("supports date ranges, tokenized search, and tag counts", () => {
  const items = [
    { ...itemA, savedAt: 10, note: "Alpha guide", tags: ["work", "read"] },
    { ...itemB, savedAt: 20, note: "Beta reference", tags: ["work"] },
    { ...itemA, id: "c", savedAt: 30, note: "Gamma guide", tags: ["read"] },
  ];
  const result = queryKeepItems(items, {
    savedBetween: [new Date(10), new Date(25)],
    search: { query: "alpha guide", mode: "and" },
  });
  assert.deepEqual(
    result.items.map((item) => item.id),
    ["a"],
  );
  assert.deepEqual(result.tagCounts, { read: 1, work: 1 });
  assert.deepEqual(getTagCounts(items), { read: 2, work: 2 });
  assert.deepEqual(
    queryKeepItems(items, { search: { query: "reference missing", mode: "or" } }).items.map((item) => item.id),
    ["b"],
  );
});

test("supports every list filter, search field, sorting, and pagination boundary", () => {
  const items = [
    { ...itemA, savedAt: 10, updatedAt: 30, targetType: "article", note: "First note", tags: ["one", "shared"] },
    { ...itemB, savedAt: 20, updatedAt: 20, targetType: "article", note: "Second note", tags: ["two", "shared"] },
    { ...itemA, id: "c", savedAt: 30, updatedAt: 10, targetType: "video", note: "Third note", tags: ["three"] },
  ];
  assert.deepEqual(
    queryKeepItems(items, { targetType: "article", tag: "shared", tags: ["one"] }).items.map((item) => item.id),
    ["a"],
  );
  assert.deepEqual(
    queryKeepItems(items, { filterFn: (item) => item.id !== "b" }).items.map((item) => item.id),
    ["a", "c"],
  );
  assert.deepEqual(
    queryKeepItems(items, { search: { query: "third", fields: ["note"], tokenize: false } }).items.map(
      (item) => item.id,
    ),
    ["c"],
  );
  assert.deepEqual(
    queryKeepItems(items, { search: { query: "one missing", fields: ["tags"], tokenize: false } }).items,
    [],
  );
  assert.deepEqual(
    queryKeepItems(items, { search: { query: "one missing", fields: ["tags"], mode: "or" } }).items.map(
      (item) => item.id,
    ),
    ["a"],
  );
  assert.deepEqual(
    queryKeepItems(items, { sort: { by: "updatedAt", direction: "desc" }, offset: 1, limit: 1 }).items.map(
      (item) => item.id,
    ),
    ["b"],
  );
  assert.deepEqual(
    queryKeepItems(items, { savedBetween: [11, 29] }).items.map((item) => item.id),
    ["b"],
  );
  assert.deepEqual(queryKeepItems(items, { limit: 0 }).items, []);
});

test("parses metadata with parse, safeParse, and Standard Schema contracts", async () => {
  assert.equal(await parseKeepMeta({ parse: (value) => String(value).trim() }, " value "), "value");
  assert.equal(await parseKeepMeta({ safeParse: (value) => ({ success: true, data: Number(value) }) }, "42"), 42);
  await assert.rejects(parseKeepMeta({ safeParse: () => ({ success: false, error: "invalid" }) }, "bad"));
  assert.deepEqual(await parseKeepMeta({ "~standard": { validate: async () => ({ value: { ok: true } }) } }, null), {
    ok: true,
  });
});

test("wraps schema failures and preserves validation error details", async () => {
  const cause = new Error("parse failed");
  await assert.rejects(parseKeepMeta({ parse: () => Promise.reject(cause) }, itemA.meta), (error) => {
    assert.equal(error instanceof KeepSchemaValidationError, true);
    assert.equal(error.cause, cause);
    return true;
  });
  await assert.rejects(
    parseKeepMeta({ "~standard": { validate: () => ({ issues: ["invalid"] }) } }, itemA.meta),
    (error) => {
      assert.equal(error instanceof KeepSchemaValidationError, true);
      assert.deepEqual(error.cause, ["invalid"]);
      return true;
    },
  );
  const validated = await parseKeepMeta({ safeParse: () => ({ success: true, data: { title: "validated" } }) }, null);
  assert.deepEqual(validated, { title: "validated" });
});

test("drops invalid metadata during backup import when requested", async () => {
  const adapter = new LocalStorageAdapter({ key: "schema-import", storage: createStorage() });
  const invalid = { ...itemB, meta: { title: 42 } } as typeof itemB;
  const invalidItems: string[] = [];
  const result = await importItems(adapter, backup([itemA, invalid]), {
    schema: {
      parse: (value) => {
        const record = value as Record<string, unknown>;
        if (!value || typeof value !== "object" || typeof record.title !== "string") {
          throw new Error("invalid title");
        }
        return value as { title: string };
      },
    },
    invalidItemPolicy: "drop",
    onInvalidItem: (_error, item) => invalidItems.push(item.id),
    mode: "replace",
  });
  assert.equal(result.imported, 1);
  assert.equal(result.failed, 1);
  assert.deepEqual(invalidItems, ["b"]);
  assert.deepEqual(
    (await adapter.getAll()).map((item) => item.id),
    ["a"],
  );
});

test("persists local changes, compresses the sync queue, and flushes remotely", async () => {
  const values = new Map<string, typeof itemA>();
  const queued: Array<{
    operationId: string;
    type: "upsert" | "remove";
    id: string;
    item?: typeof itemA;
    createdAt: number;
  }> = [];
  const local = {
    getAll: async () => [...values.values()],
    set: async (item) => void values.set(item.id, item),
    remove: async (id) => void values.delete(id),
    clear: async () => void values.clear(),
  };
  const queue = {
    getAll: async () => [...queued],
    setMany: async (operations) => {
      for (const operation of operations) {
        const index = queued.findIndex((current) => current.operationId === operation.operationId);
        if (index >= 0) queued[index] = operation;
        else queued.push(operation);
      }
    },
    remove: async (ids) => {
      const idSet = new Set(ids);
      queued.splice(0, queued.length, ...queued.filter((operation) => !idSet.has(operation.operationId)));
    },
    clear: async () => void queued.splice(0),
  };
  const pushed: string[] = [];
  const adapter = new SyncStorageAdapter({
    local,
    queue,
    clientId: "client",
    now: (() => {
      let value = 100;
      return () => value++;
    })(),
    remote: {
      push: async (operation) => {
        pushed.push(`${operation.type}:${operation.id}`);
        return { type: "synced" };
      },
    },
  });

  await adapter.set(itemA);
  await adapter.set({ ...itemA, updatedAt: 11, note: "new" });
  assert.equal((await adapter.getAll())[0].note, "new");
  assert.equal(queued.length, 1);
  assert.equal(adapter.getSyncState().status, "pending");

  await adapter.flushSync();
  assert.deepEqual(pushed, ["upsert:a"]);
  assert.equal(adapter.getSyncState().status, "synced");
  assert.equal(adapter.getSyncState().pendingCount, 0);
  adapter.dispose();
});

test("keeps unresolved conflicts pending and retries resolved conflicts", async () => {
  const values = new Map([[itemA.id, itemA]]);
  const queued: Array<{
    operationId: string;
    type: "upsert" | "remove";
    id: string;
    item?: typeof itemA;
    createdAt: number;
  }> = [];
  const local = {
    getAll: async () => [...values.values()],
    set: async (item) => void values.set(item.id, item),
    remove: async (id) => void values.delete(id),
    clear: async () => void values.clear(),
  };
  const queue = {
    getAll: async () => [...queued],
    setMany: async (items) => queued.push(...items),
    remove: async (ids) => {
      const idSet = new Set(ids);
      queued.splice(0, queued.length, ...queued.filter((item) => !idSet.has(item.operationId)));
    },
    clear: async () => void queued.splice(0),
  };
  let pushes = 0;
  const adapter = new SyncStorageAdapter({
    local,
    queue,
    clientId: "client",
    remote: {
      push: async () => {
        pushes += 1;
        return pushes === 1
          ? { type: "conflict", remote: { ...itemA, note: "remote" }, revision: "r1" }
          : { type: "synced" };
      },
    },
    resolveConflict: (localItem, remote) => ({
      ...remote,
      note: `${localItem?.note ?? ""}+${remote.note ?? ""}`,
      updatedAt: 12,
    }),
  });
  await adapter.set({ ...itemA, note: "local", updatedAt: 11 });
  await adapter.flushSync();
  assert.equal(adapter.getSyncState().status, "pending");
  assert.equal(queued.length, 1);
  await adapter.flushSync();
  assert.equal(adapter.getSyncState().status, "synced");
  assert.equal((await adapter.getAll())[0].note, "local+remote");
  adapter.dispose();
});

test("resumes a persisted queue on adapter startup", async () => {
  const queued = [
    {
      operationId: "previous-client:1:operation",
      type: "upsert" as const,
      id: itemA.id,
      item: itemA,
      createdAt: 1,
    },
  ];
  const local = {
    getAll: async () => [itemA],
    set: async () => undefined,
    remove: async () => undefined,
    clear: async () => undefined,
  };
  const queue = {
    getAll: async () => [...queued],
    setMany: async () => undefined,
    remove: async (ids: string[]) => {
      const idSet = new Set(ids);
      queued.splice(0, queued.length, ...queued.filter((operation) => !idSet.has(operation.operationId)));
    },
    clear: async () => undefined,
  };
  const pushed: string[] = [];
  const adapter = new SyncStorageAdapter({
    local,
    queue,
    remote: {
      push: async (operation) => {
        pushed.push(operation.operationId);
        return { type: "synced" };
      },
    },
  });

  await adapter.flushSync();
  assert.deepEqual(pushed, ["previous-client:1:operation"]);
  assert.equal(adapter.getSyncState().status, "synced");
  adapter.dispose();
});
