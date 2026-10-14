import assert from "node:assert/strict";
import test from "node:test";
import {
  createScopedStorageAdapter,
  exportItems,
  type FallbackRecoveryJournalState,
  FallbackStorageAdapter,
  type KeepItem,
  KeepStorageAccessError,
  type KeepStorageRecovery,
  KeepStorageSerializationError,
  LocalStorageAdapter,
  LocalStorageSyncQueueAdapter,
  type StorageAdapter,
  SyncStorageAdapter,
} from "../dist/core.js";

const saved: KeepItem<{ title: string }> = { id: "same", savedAt: 1, updatedAt: 1, meta: { title: "Saved" } };

test("a fallback infers and enforces its primary's bound scope before outage reads and journaling", async () => {
  let items = [
    { ...saved, scope: { userId: "alice" } },
    { ...saved, scope: { userId: "bob" } },
  ];
  const unavailable: StorageAdapter<{ title: string }> = {
    scope: { userId: "alice" },
    getAll: async () => {
      throw new KeepStorageAccessError({ operation: "getAll" });
    },
    set: async () => {
      throw new KeepStorageAccessError({ operation: "set" });
    },
    remove: async () => {
      throw new KeepStorageAccessError({ operation: "remove" });
    },
    clear: async () => {
      throw new KeepStorageAccessError({ operation: "clear" });
    },
  };
  const fallback: StorageAdapter<{ title: string }> = {
    getAll: async () => [...items],
    set: async (item) => {
      items = [
        ...items.filter((entry) => entry.scope.userId !== item.scope?.userId),
        { ...item, scope: { userId: "alice" } },
      ];
    },
    remove: async () => undefined,
    clear: async () => assert.fail("A scoped fallback must not clear the backend."),
  };
  let journal: FallbackRecoveryJournalState<{ title: string }> | undefined;
  const adapter = new FallbackStorageAdapter({
    primary: unavailable,
    fallback,
    recoveryJournal: {
      read: async () => journal,
      write: async (next) => {
        journal = next;
      },
      runExclusive: (operation) => operation(),
    },
  });
  assert.deepEqual(await adapter.getAll(), [{ ...saved, scope: { userId: "alice" } }]);
  await adapter.set({ ...saved, meta: { title: "Alice changed" } });
  assert.deepEqual(
    (await adapter.getAll()).map((item) => item.scope?.userId),
    ["alice"],
  );
  assert.equal(items.find((item) => item.scope.userId === "bob")?.meta.title, "Saved");
  const preview = await adapter.recovery?.inspect?.();
  assert.ok(preview?.sources.every((source) => source.snapshot.items.every((item) => item.scope?.userId === "alice")));
});

test("fallback reporting and observers cannot interrupt persistence or later source observers", async () => {
  const values = new Map<string, string>();
  const fallback = new LocalStorageAdapter<{ title: string }>({
    storage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => void values.set(key, value),
      removeItem: (key) => void values.delete(key),
    },
  });
  const fail = async (): Promise<never> => {
    throw new KeepStorageAccessError({ operation: "set" });
  };
  const primary: StorageAdapter<{ title: string }> = { getAll: fail, set: fail, remove: fail, clear: fail };
  for (const journaled of [false, true]) {
    let state: FallbackRecoveryJournalState<{ title: string }> | undefined;
    const adapter = new FallbackStorageAdapter({
      primary,
      fallback,
      onFallback: () => {
        throw new Error("Reporter failed");
      },
      ...(journaled
        ? {
            recoveryJournal: {
              read: async () => state,
              write: async (next) => {
                state = next;
              },
              runExclusive: (operation) => operation(),
            },
          }
        : {}),
    });
    let observed = 0;
    const first = adapter.subscribe(() => {
      throw new Error("Observer failed");
    });
    const second = adapter.subscribe(() => {
      observed += 1;
    });
    await adapter.set(saved);
    assert.deepEqual(await fallback.getAll(), [saved]);
    assert.ok(observed > 0);
    first();
    second();
  }
});

test("scoped mutations write only the requested records without re-upserting another scope", async () => {
  const writes: KeepItem<{ title: string }>[][] = [];
  const removals: { ids: string[]; userId?: string }[] = [];
  let reads = 0;
  const base: StorageAdapter<{ title: string }> = {
    getAll: async () => {
      reads += 1;
      return [
        { ...saved, scope: { userId: "alice" } },
        { ...saved, scope: { userId: "bob" } },
      ];
    },
    set: async (item) => void writes.push([item]),
    setMany: async (items) => void writes.push(items),
    remove: async (id, scope) => void removals.push({ ids: [id], userId: scope?.userId }),
    removeMany: async (ids, scope) => void removals.push({ ids, userId: scope?.userId }),
    clear: async () => assert.fail("A scoped clear must never clear the physical backend."),
  };
  const alice = createScopedStorageAdapter(base, { userId: "alice" });
  const bob = createScopedStorageAdapter(base, { userId: "bob" });
  await Promise.all([alice.set(saved), bob.set(saved)]);
  assert.equal(reads, 0);
  assert.deepEqual(
    writes.map((items) => items.map((item) => item.scope?.userId)),
    [["alice"], ["bob"]],
  );
  await alice.removeMany(["same", "same"]);
  assert.equal(reads, 0);
  await alice.clear();
  assert.deepEqual(removals, [
    { ids: ["same"], userId: "alice" },
    { ids: ["same"], userId: "alice" },
  ]);
});

test("rebinding an already scoped adapter cannot write or delete records in its original scope", async () => {
  let writes = 0;
  const changed = async () => {
    writes += 1;
  };
  const base: StorageAdapter<{ title: string }> = {
    getAll: async () => [{ ...saved, scope: { userId: "alice" } }],
    getCollections: async () => [{ id: "reading", name: "Reading", scope: { userId: "alice" } }],
    setCollection: changed,
    removeCollection: changed,
    getCollectionMemberships: async () => [
      { collectionId: "reading", itemId: saved.id, order: 0, scope: { userId: "alice" } },
    ],
    setCollectionMembership: changed,
    removeCollectionMembership: changed,
    set: changed,
    setMany: changed,
    remove: changed,
    removeMany: changed,
    clear: changed,
  };
  const alice = createScopedStorageAdapter(base, { userId: "alice" });
  const bob = createScopedStorageAdapter(alice, { userId: "bob" });
  assert.deepEqual(await bob.getAll(), []);
  for (const operation of [
    () => bob.set(saved),
    () => bob.setMany([saved]),
    () => bob.remove(saved.id),
    () => bob.removeMany([saved.id]),
    () => bob.clear(),
    () => bob.merge([saved]),
    () => bob.setCollection?.({ id: "reading", name: "Reading" }),
    () => bob.removeCollection?.("reading"),
    () => bob.setCollectionMembership?.({ collectionId: "reading", itemId: saved.id, order: 0 }),
    () => bob.removeCollectionMembership?.("reading", saved.id),
  ]) {
    const promise = operation();
    assert.ok(promise);
    await assert.rejects(promise, /different storage scope/);
  }
  assert.equal(writes, 0);
});

test("scoped recovery is forwarded only for its bound scope and sync exposes status alone", async () => {
  let inspected = 0;
  const recovery: KeepStorageRecovery<{ title: string }> = {
    getState: () => ({ source: "primary", pendingOperations: 0, snapshotStale: false, repairSupported: true }),
    subscribe: () => () => undefined,
    inspect: async () => {
      inspected += 1;
      return { token: "test", sources: [], rows: [], issues: [], operations: [], backups: [] };
    },
    apply: async () => ({ status: "applied", pendingOperations: 0 }),
    retry: async () => ({ status: "applied", pendingOperations: 0 }),
  };
  const local: StorageAdapter<{ title: string }> = {
    scope: { userId: "alice" },
    recovery,
    getAll: async () => [],
    set: async () => undefined,
    remove: async () => undefined,
    clear: async () => undefined,
  };
  assert.equal(createScopedStorageAdapter(local, { userId: "alice" }).recovery, recovery);
  assert.equal(createScopedStorageAdapter(local, { userId: "bob" }).recovery, undefined);
  const sync = new SyncStorageAdapter({
    local,
    scope: { userId: "alice" },
    remote: { push: async () => undefined },
    queue: {
      getAll: async () => [],
      setMany: async () => undefined,
      remove: async () => undefined,
      clear: async () => undefined,
    },
  });
  assert.equal(sync.recovery?.getState().repairSupported, false);
  assert.equal(sync.recovery?.inspect, undefined);
  assert.equal(sync.recovery?.apply, undefined);
  assert.equal(sync.recovery?.retry, undefined);
  assert.equal(inspected, 0);
  sync.dispose();
  const mismatched = new SyncStorageAdapter({
    local,
    scope: { userId: "bob" },
    remote: { push: async () => undefined },
    queue: {
      getAll: async () => [],
      setMany: async () => undefined,
      remove: async () => undefined,
      clear: async () => undefined,
    },
  });
  assert.equal(mismatched.recovery, undefined);
  mismatched.dispose();
});

test("JSON backups and localStorage reject metadata that would lose information before writing", async () => {
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  const invalid: unknown[] = [
    new Date(0),
    new Map(),
    new Set(),
    Number.NaN,
    Number.POSITIVE_INFINITY,
    undefined,
    () => undefined,
    Symbol("value"),
    1n,
    circular,
    { nested: { value: undefined } },
    { [Symbol("key")]: "value" },
  ];
  let writes = 0;
  const adapter = new LocalStorageAdapter<unknown>({
    storage: {
      getItem: () => null,
      setItem: () => {
        writes += 1;
      },
      removeItem: () => undefined,
    },
  });
  for (const meta of invalid) {
    const item: KeepItem<unknown> = { ...saved, meta };
    await assert.rejects(adapter.set(item), KeepStorageSerializationError);
    const primary: StorageAdapter<unknown> = {
      getAll: async () => [item],
      set: async () => undefined,
      remove: async () => undefined,
      clear: async () => undefined,
    };
    await assert.rejects(exportItems(primary), KeepStorageSerializationError);
  }
  assert.equal(writes, 0);
  await adapter.set({ ...saved, note: undefined, scope: undefined });
  assert.equal(writes, 1);
});

test("JSON synchronization queues reject lossy metadata before writing and accept known optional fields", async () => {
  const values = new Map<string, string>();
  let writes = 0;
  const queue = new LocalStorageSyncQueueAdapter<unknown>({
    key: "serialization-queue",
    storage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        writes += 1;
        values.set(key, value);
      },
      removeItem: (key) => void values.delete(key),
    },
  });
  const operation = {
    operationId: "saved-operation",
    type: "upsert" as const,
    id: saved.id,
    createdAt: 1,
    item: saved,
    baseRevision: undefined,
    attempts: undefined,
    entity: undefined,
    collection: undefined,
    scope: undefined,
  };
  await queue.setMany([operation]);
  const persisted = values.get("serialization-queue");
  assert.equal(writes, 1);
  for (const meta of [new Date(0), undefined, Number.NaN, { value: undefined }, new Map()]) {
    await assert.rejects(queue.setMany([{ ...operation, item: { ...saved, meta } }]), KeepStorageSerializationError);
    assert.equal(values.get("serialization-queue"), persisted);
  }
  assert.equal(writes, 1);
  assert.deepEqual(await queue.getAll(), [
    {
      operationId: "saved-operation",
      type: "upsert",
      id: saved.id,
      createdAt: 1,
      item: saved,
    },
  ]);
});
