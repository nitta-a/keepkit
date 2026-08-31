import assert from "node:assert/strict";
import test from "node:test";
import { type KeepItem, KeepStorageAccessError, type SyncOperation, type SyncQueueAdapter } from "../dist/core.js";
import {
  FallbackSyncQueueAdapter,
  IndexedDBSyncQueueAdapter,
  LocalStorageSyncQueueAdapter,
  SyncStorageAdapter,
} from "../dist/storage.js";

const itemA: KeepItem<{ title: string }> = {
  id: "a",
  savedAt: 1,
  updatedAt: 1,
  meta: { title: "A" },
};

const itemB: KeepItem<{ title: string }> = {
  id: "b",
  savedAt: 2,
  updatedAt: 2,
  meta: { title: "B" },
};

type MemoryStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function createStorage(): MemoryStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

function operation(id: string, type: SyncOperation["type"] = "upsert"): SyncOperation<(typeof itemA)["meta"]> {
  return {
    operationId: `operation-${id}-${type}`,
    type,
    id,
    ...(type === "upsert" ? { item: itemA } : {}),
    createdAt: 1,
  };
}

test("persists, filters, and clears local sync queue operations", async () => {
  const storage = createStorage();
  const queue = new LocalStorageSyncQueueAdapter({ key: "queue", storage });

  assert.deepEqual(await queue.getAll(), []);
  await queue.setMany([operation("a"), operation("b", "remove")]);
  assert.deepEqual(await queue.getAll(), [operation("a"), operation("b", "remove")]);
  await queue.remove(["operation-a-upsert", "operation-a-upsert"]);
  assert.deepEqual(await queue.getAll(), [operation("b", "remove")]);
  await queue.clear();
  assert.deepEqual(await queue.getAll(), []);

  storage.setItem("queue", "not-json");
  await assert.rejects(queue.getAll(), /invalid JSON/);
  storage.setItem("queue", JSON.stringify([{ operationId: "missing-type", id: "a", createdAt: 1 }]));
  await assert.rejects(queue.getAll(), /invalid operations/);

  const unavailable = new LocalStorageSyncQueueAdapter({ storage: undefined });
  assert.deepEqual(await unavailable.getAll(), []);
  await unavailable.setMany([operation("a")]);
  await unavailable.remove([operation("a").operationId]);
  await unavailable.clear();
});

test("switches sync queue adapters only for selected primary failures", async () => {
  const cause = new Error("primary unavailable");
  const calls: string[] = [];
  const primary: SyncQueueAdapter = {
    getAll: async () => {
      calls.push("primary:getAll");
      throw cause;
    },
    setMany: async () => {
      calls.push("primary:setMany");
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
  const fallback: SyncQueueAdapter = {
    getAll: async () => {
      calls.push("fallback:getAll");
      return [operation("fallback")];
    },
    setMany: async () => {
      calls.push("fallback:setMany");
    },
    remove: async () => {
      calls.push("fallback:remove");
    },
    clear: async () => {
      calls.push("fallback:clear");
    },
  };
  const queue = new FallbackSyncQueueAdapter({ primary, fallback });

  assert.equal(queue.isUsingFallback, false);
  assert.deepEqual(await queue.getAll(), [operation("fallback")]);
  assert.equal(queue.isUsingFallback, true);
  await queue.setMany([operation("a")]);
  await queue.remove(["operation-a-upsert"]);
  await queue.clear();
  assert.deepEqual(calls, [
    "primary:getAll",
    "fallback:getAll",
    "fallback:setMany",
    "fallback:remove",
    "fallback:clear",
  ]);

  const rejected = new FallbackSyncQueueAdapter({
    primary: { ...primary },
    fallback,
    shouldFallback: () => false,
  });
  await assert.rejects(rejected.getAll(), (error) => error === cause);
  assert.equal(rejected.isUsingFallback, false);
});

class FakeRequest<T = unknown> {
  result = undefined as T;
  error: unknown = null;
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;
}

class FakeTransaction {
  error: unknown = null;
  oncomplete: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
}

class FakeDatabase {
  readonly operations = new Map<string, SyncOperation>();
  private hasStore = false;

  get objectStoreNames() {
    return { contains: () => this.hasStore };
  }

  createObjectStore() {
    this.hasStore = true;
    return {};
  }

  transaction() {
    const transaction = new FakeTransaction();
    const store = {
      getAll: () => {
        const request = new FakeRequest<SyncOperation[]>();
        queueMicrotask(() => {
          request.result = [...this.operations.values()];
          request.onsuccess?.();
        });
        return request;
      },
      put: (value: SyncOperation) => void this.operations.set(value.operationId, value),
      delete: (id: string) => void this.operations.delete(id),
      clear: () => void this.operations.clear(),
    };
    (transaction as FakeTransaction & { objectStore: () => typeof store }).objectStore = () => store;
    queueMicrotask(() => transaction.oncomplete?.());
    return transaction;
  }
}

function createIndexedDB() {
  const databases = new Map<string, FakeDatabase>();
  return {
    open(name: string) {
      const request = new FakeRequest<FakeDatabase>();
      const database = databases.get(name) ?? new FakeDatabase();
      const isNew = !databases.has(name);
      databases.set(name, database);
      queueMicrotask(() => {
        request.result = database;
        if (isNew) request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
}

test("supports IndexedDB sync queue CRUD and no-IDB operation", async () => {
  const queue = new IndexedDBSyncQueueAdapter({
    databaseName: "sync-test",
    storeName: "operations",
    indexedDB: createIndexedDB(),
  });
  await queue.setMany([operation("a"), operation("b", "remove")]);
  assert.deepEqual(await queue.getAll(), [operation("a"), operation("b", "remove")]);
  await queue.remove([operation("a").operationId, operation("a").operationId]);
  assert.deepEqual(await queue.getAll(), [operation("b", "remove")]);
  await queue.clear();
  assert.deepEqual(await queue.getAll(), []);

  const unavailable = new IndexedDBSyncQueueAdapter({ indexedDB: undefined });
  assert.deepEqual(await unavailable.getAll(), []);
  await unavailable.setMany([operation("a")]);
  await unavailable.remove([operation("a").operationId]);
  await unavailable.clear();
});

function createLocal(initial: KeepItem<{ title: string }>[] = [], withBatch = true) {
  const values = new Map(initial.map((item) => [item.id, item]));
  const calls = { set: 0, setMany: 0, remove: 0, removeMany: 0, clear: 0 };
  const local: {
    getAll: () => Promise<KeepItem<{ title: string }>[]>;
    set: (item: KeepItem<{ title: string }>) => Promise<void>;
    setMany?: (items: KeepItem<{ title: string }>[]) => Promise<void>;
    remove: (id: string) => Promise<void>;
    removeMany?: (ids: string[]) => Promise<void>;
    clear: () => Promise<void>;
    storageKey: string;
  } = {
    storageKey: "sync-local",
    getAll: async () => [...values.values()],
    set: async (item) => {
      calls.set += 1;
      values.set(item.id, item);
    },
    remove: async (id) => {
      calls.remove += 1;
      values.delete(id);
    },
    clear: async () => {
      calls.clear += 1;
      values.clear();
    },
  };
  if (withBatch) {
    local.setMany = async (items) => {
      calls.setMany += 1;
      for (const item of items) values.set(item.id, item);
    };
    local.removeMany = async (ids) => {
      calls.removeMany += 1;
      for (const id of ids) values.delete(id);
    };
  }
  return { local, values, calls };
}

function createMemoryQueue(initial: SyncOperation[] = []) {
  const operations = [...initial];
  const queue: SyncQueueAdapter = {
    getAll: async () => [...operations],
    setMany: async (next) => {
      for (const entry of next) {
        const index = operations.findIndex((current) => current.operationId === entry.operationId);
        if (index === -1) operations.push(entry);
        else operations[index] = entry;
      }
    },
    remove: async (ids) => {
      const idSet = new Set(ids);
      operations.splice(0, operations.length, ...operations.filter((entry) => !idSet.has(entry.operationId)));
    },
    clear: async () => void operations.splice(0),
  };
  return { queue, operations };
}

test("handles sync adapter batch CRUD, listeners, merge, clear, and local write rollback", async () => {
  const { local, values, calls } = createLocal([itemA, itemB], false);
  const { queue, operations } = createMemoryQueue();
  const adapter = new SyncStorageAdapter({
    local,
    queue,
    remote: { push: async () => ({ type: "synced" }) },
    clientId: "client",
    now: () => 10,
  });
  let syncNotifications = 0;
  let dataNotifications = 0;
  const unsubscribeSync = adapter.subscribeSync(() => syncNotifications++);
  const unsubscribeData = adapter.subscribe(() => dataNotifications++);

  await adapter.setMany([
    { ...itemA, updatedAt: 3 },
    { ...itemB, updatedAt: 4 },
  ]);
  assert.equal(calls.set, 2);
  assert.equal(operations.length, 2);
  await adapter.removeMany(["a", "a", "b"]);
  assert.equal(calls.remove, 3);
  assert.deepEqual(await adapter.getAll(), []);
  assert.equal(operations.filter((entry) => entry.type === "remove").length, 2);
  await adapter.clear();
  assert.equal(calls.clear, 1);

  const merged = await adapter.merge([itemA]);
  assert.deepEqual(merged, [itemA]);
  assert.equal(operations.filter((entry) => entry.type === "upsert").length, 1);
  assert.equal(values.get("a"), itemA);
  assert.ok(syncNotifications > 0);
  assert.ok(dataNotifications > 0);
  unsubscribeSync();
  unsubscribeData();
  adapter.dispose();

  const failing = createLocal([], false);
  const failingQueue = createMemoryQueue();
  const writeCause = new Error("local write failed");
  failing.local.set = async () => {
    throw writeCause;
  };
  const failingAdapter = new SyncStorageAdapter({
    local: failing.local,
    queue: failingQueue.queue,
    remote: { push: async () => ({ type: "synced" }) },
  });
  await assert.rejects(failingAdapter.set(itemA), (error) => error === writeCause);
  assert.deepEqual(failingQueue.operations, []);
  failingAdapter.dispose();
});

test("pulls non-stale remote items, applies server revisions, and reports push failures", async () => {
  const { local, values, calls } = createLocal([itemA]);
  const { queue } = createMemoryQueue();
  const remoteItem = { ...itemB, updatedAt: 20 };
  let pullCalls = 0;
  const pushCause = new Error("remote unavailable");
  const adapter = new SyncStorageAdapter({
    local,
    queue,
    remote: {
      pull: async () => {
        pullCalls += 1;
        return [remoteItem, { ...itemA, updatedAt: 0 }, { ...itemA, updatedAt: 1 }];
      },
      push: async () => {
        throw pushCause;
      },
    },
  });
  let dataNotifications = 0;
  const unsubscribe = adapter.subscribe(() => dataNotifications++);

  await adapter.flushSync();
  assert.equal(pullCalls, 1);
  assert.equal(calls.setMany, 1);
  assert.equal(values.get("b"), remoteItem);
  assert.equal(dataNotifications, 1);

  await adapter.set({ ...itemA, updatedAt: 3, revision: "base" });
  await adapter.flushSync();
  assert.equal(adapter.getSyncState().status, "error");
  assert.equal(adapter.getSyncState().error, pushCause);
  assert.equal(adapter.getSyncState().pendingCount, 1);

  unsubscribe();
  adapter.dispose();
});

test("retries transient pushes and carries user and tenant scope", async () => {
  const { local } = createLocal();
  const queued: SyncOperation[] = [];
  const queue: SyncQueueAdapter = {
    getAll: async () => [...queued],
    setMany: async (operations) => queued.push(...operations),
    remove: async (ids) =>
      queued.splice(0, queued.length, ...queued.filter((entry) => !ids.includes(entry.operationId))),
    clear: async () => void queued.splice(0),
  };
  let attempts = 0;
  const adapter = new SyncStorageAdapter({
    local,
    queue,
    userId: "user-1",
    tenantId: "tenant-1",
    maxRetries: 2,
    remote: {
      push: async () => {
        attempts += 1;
        if (attempts < 3) throw new Error("temporary outage");
        return { type: "synced" };
      },
    },
  });
  await adapter.set(itemA);
  assert.deepEqual(queued[0]?.scope, { userId: "user-1", tenantId: "tenant-1" });
  await adapter.flushSync();
  assert.equal(attempts, 3);
  assert.equal(adapter.getSyncState().status, "synced");
  adapter.dispose();
});

test("keeps unresolved conflicts pending and carries remote revisions into resolved retries", async () => {
  const { local, values } = createLocal([itemA]);
  const firstQueue = createMemoryQueue();
  const unresolved = new SyncStorageAdapter({
    local,
    queue: firstQueue.queue,
    remote: {
      push: async () => ({ type: "conflict", remote: { ...itemA, note: "remote" }, revision: "remote-1" }),
    },
  });
  await unresolved.set({ ...itemA, note: "local", updatedAt: 2 });
  await unresolved.flushSync();
  assert.equal(unresolved.getSyncState().status, "conflict");
  assert.deepEqual(unresolved.getSyncState().conflictIds, ["a"]);
  assert.equal(firstQueue.operations.length, 1);
  unresolved.dispose();

  const resolvedQueue = createMemoryQueue();
  let pushes = 0;
  const resolved = new SyncStorageAdapter({
    local,
    queue: resolvedQueue.queue,
    remote: {
      push: async (_entry) => {
        pushes += 1;
        if (pushes === 1) return { type: "conflict", remote: { ...itemA, note: "remote" }, revision: "remote-2" };
        return { type: "synced" };
      },
    },
    resolveConflict: (current, remote, context) => ({
      ...remote,
      note: `${current?.note ?? ""}/${remote.note ?? ""}`,
      updatedAt: 3,
      revision: context.remoteRevision,
    }),
  });
  await resolved.set({ ...itemA, note: "local", updatedAt: 2 });
  await resolved.flushSync();
  assert.equal(resolvedQueue.operations.length, 1);
  assert.equal(values.get("a")?.note, "local/remote");
  assert.equal(resolvedQueue.operations[0]?.item?.revision, "remote-2");
  await resolved.flushSync();
  assert.equal(resolved.getSyncState().status, "synced");
  assert.equal(resolvedQueue.operations.length, 0);
  resolved.dispose();
});

test("surfaces queue-load errors and resumes persisted operations", async () => {
  const cause = new KeepStorageAccessError({ operation: "getAll", cause: new Error("queue blocked") });
  const brokenQueue: SyncQueueAdapter = {
    getAll: async () => {
      throw cause;
    },
    setMany: async () => undefined,
    remove: async () => undefined,
    clear: async () => undefined,
  };
  const local = createLocal([itemA]).local;
  const broken = new SyncStorageAdapter({
    local,
    queue: brokenQueue,
    remote: { push: async () => ({ type: "synced" }) },
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(broken.getSyncState().status, "error");
  assert.equal(broken.getSyncState().error, cause);
  broken.dispose();

  const persisted = createMemoryQueue([operation("a")]);
  const pushed: string[] = [];
  const resumed = new SyncStorageAdapter({
    local,
    queue: persisted.queue,
    remote: {
      push: async (entry) => {
        pushed.push(entry.operationId);
        return { type: "synced", item: { ...itemA, revision: "server-1" }, revision: "server-1" };
      },
    },
  });
  await resumed.flushSync();
  assert.deepEqual(pushed, [operation("a").operationId]);
  assert.equal(resumed.getSyncState().status, "synced");
  assert.equal((await resumed.getAll())[0]?.revision, "server-1");
  resumed.dispose();
});
