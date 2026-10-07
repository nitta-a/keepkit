import assert from "node:assert/strict";
import test from "node:test";
import {
  createAuthenticatedSyncKit,
  type KeepCollectionMembership,
  type KeepItem,
  KeepStorageAccessError,
  KeepSyncAuthError,
  LocalStorageAdapter,
  type StorageAdapter,
  type SyncOperation,
  type SyncQueueAdapter,
} from "../dist/core.js";
import {
  FallbackSyncQueueAdapter,
  IndexedDBSyncQueueAdapter,
  LocalStorageSyncQueueAdapter,
  ScopedSyncQueueAdapter,
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

test("scoped sync queues preserve pending work and restrict removals to their scope", async () => {
  const aliceScope = { tenantId: "tenant-1", userId: "alice" };
  const bobScope = { tenantId: "tenant-1", userId: "bob" };
  const alicePending = { ...operation("alice-pending"), scope: aliceScope };
  const bobPending = { ...operation("bob-pending"), scope: bobScope };
  const { queue, operations } = createMemoryQueue([alicePending, bobPending]);
  const scoped = new ScopedSyncQueueAdapter(queue, aliceScope);

  await scoped.setMany([operation("alice-new")]);
  assert.deepEqual(
    operations.map((entry) => entry.operationId).sort(),
    [alicePending.operationId, bobPending.operationId, operation("alice-new").operationId].sort(),
  );
  assert.deepEqual(await scoped.getAll(), [alicePending, { ...operation("alice-new"), scope: aliceScope }]);

  await scoped.remove([bobPending.operationId, alicePending.operationId]);
  assert.deepEqual(
    operations.map((entry) => entry.operationId).sort(),
    [bobPending.operationId, operation("alice-new").operationId].sort(),
  );
  await scoped.clear();
  assert.deepEqual(operations, [bobPending]);
});

test("sync adapters with a custom queue only flush their active scope", async () => {
  const aliceScope = { tenantId: "tenant-1", userId: "alice" };
  const bobPending = { ...operation("bob-pending"), scope: { tenantId: "tenant-1", userId: "bob" } };
  const alicePending = { ...operation("alice-pending"), scope: aliceScope };
  const { queue, operations } = createMemoryQueue([alicePending, bobPending]);
  const pushedScopes: string[] = [];
  const adapter = new SyncStorageAdapter({
    local: new LocalStorageAdapter({ key: "sync-scoped-queue", storage: createStorage() }),
    queue,
    scope: aliceScope,
    remote: {
      push: async (entry) => {
        pushedScopes.push(entry.scope?.userId ?? "unscoped");
        return { type: "synced" as const };
      },
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  await adapter.flushSync();

  assert.deepEqual(pushedScopes, ["alice"]);
  assert.deepEqual(operations, [bobPending]);
  adapter.dispose();
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

test("pulls newer activity without rolling back newer content", async () => {
  const localItem = { ...itemA, note: "new content", updatedAt: 20 };
  const { local, values } = createLocal([localItem]);
  const { queue } = createMemoryQueue();
  const adapter = new SyncStorageAdapter({
    local,
    queue,
    remote: {
      pull: async () => [{ ...itemA, note: "old content", updatedAt: 10, lastOpenedAt: 30 }],
      push: async () => ({ type: "synced" }),
    },
  });

  await adapter.flushSync();
  assert.deepEqual(values.get(itemA.id), { ...localItem, lastOpenedAt: 30 });
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

test("authenticated sync refreshes tokens per request and isolates scope changes", async () => {
  const { local, values } = createLocal();
  const queue = createMemoryQueue();
  const tokens = ["token-a", "token-b", "token-c"];
  const requests: Array<{ token: string | null; scope?: { userId?: string; tenantId?: string } }> = [];
  let scopeChanges = 0;
  let activeScope = { userId: "user-a", tenantId: "tenant-a" };
  const kit = createAuthenticatedSyncKit({
    local,
    queue: queue.queue,
    scope: activeScope,
    getScope: () => activeScope,
    getAuthToken: async () => tokens.shift() ?? null,
    transport: {
      push: async (_operation, context) => {
        requests.push({ token: context.token, scope: context.scope });
        return { type: "synced" };
      },
    },
    clientId: "auth-client",
    now: () => 10,
  });
  const unsubscribeScope = kit.storage.subscribeScope?.(() => scopeChanges++);

  await kit.storage.set(itemA);
  await kit.storage.flushSync();
  assert.deepEqual(requests, [{ token: "token-a", scope: { userId: "user-a", tenantId: "tenant-a" } }]);
  assert.equal(kit.scopeKey, ":tenant-a:user-a");

  activeScope = { userId: "user-b", tenantId: "tenant-a" };
  assert.deepEqual(await kit.storage.getAll(), []);
  assert.equal(scopeChanges, 1);
  await kit.storage.set(itemB);
  await kit.storage.flushSync();
  assert.equal(requests[1]?.token, "token-b");
  assert.deepEqual(requests[1]?.scope, { userId: "user-b", tenantId: "tenant-a" });

  activeScope = { userId: "user-a", tenantId: "tenant-a" };
  assert.deepEqual(await kit.storage.getAll(), [{ ...itemA, scope: { userId: "user-a", tenantId: "tenant-a" } }]);
  assert.equal(values.get("a")?.scope?.userId, "user-a");
  assert.equal(values.get("b")?.scope?.userId, "user-b");
  unsubscribeScope?.();
  kit.dispose();
});

test("authenticated collection transport carries request tokens and the active scope", async () => {
  const requests: Array<{ token: string | null; scope?: { userId?: string; tenantId?: string } }> = [];
  const kit = createAuthenticatedSyncKit({
    local: new LocalStorageAdapter({ key: "authenticated-collections", storage: createStorage() }),
    queue: createMemoryQueue().queue,
    scope: { userId: "user-a", tenantId: "tenant-a" },
    getAuthToken: async () => "token-a",
    transport: {
      push: async () => ({ type: "synced" }),
      pushCollection: async (_operation, context) => {
        requests.push({ token: context.token, scope: context.scope });
      },
      pullCollections: async (context) => {
        requests.push({ token: context.token, scope: context.scope });
        return [];
      },
      pushMembership: async (_operation, context) => {
        requests.push({ token: context.token, scope: context.scope });
      },
      pullMemberships: async (context) => {
        requests.push({ token: context.token, scope: context.scope });
        return [];
      },
    },
    now: () => 10,
  });

  await kit.storage.setCollection?.({ id: "course-a", name: "Course A" });
  await kit.storage.setCollectionMembership?.({ collectionId: "course-a", itemId: "guide-a", order: 0 });
  await kit.storage.flushSync();
  assert.deepEqual(requests, [
    { token: "token-a", scope: { userId: "user-a", tenantId: "tenant-a" } },
    { token: "token-a", scope: { userId: "user-a", tenantId: "tenant-a" } },
    { token: "token-a", scope: { userId: "user-a", tenantId: "tenant-a" } },
    { token: "token-a", scope: { userId: "user-a", tenantId: "tenant-a" } },
  ]);
  kit.dispose();
});

test("authenticated sync reports 401/403 errors once without retrying them", async () => {
  const { local } = createLocal();
  const queue = createMemoryQueue();
  let pushes = 0;
  const authErrors: KeepSyncAuthError<{ title: string }>[] = [];
  const kit = createAuthenticatedSyncKit({
    local,
    queue: queue.queue,
    getAuthToken: async () => "expired-token",
    transport: {
      push: async () => {
        pushes += 1;
        throw Object.assign(new Error("expired"), { status: 401 });
      },
    },
    maxRetries: 3,
    onAuthError: (error) => void authErrors.push(error),
  });

  await kit.storage.set(itemA);
  await kit.storage.flushSync();
  assert.equal(pushes, 1);
  assert.equal(authErrors.length, 1);
  assert.ok(authErrors[0] instanceof KeepSyncAuthError);
  assert.equal(authErrors[0]?.status, 401);
  assert.equal(kit.storage.getSyncState().status, "error");
  kit.dispose();
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
  assert.equal(unresolved.getSyncState().conflicts?.[0]?.remote.note, "remote");
  await unresolved.resolveSyncConflict("a", "remote");
  assert.equal(unresolved.getSyncState().status, "synced");
  assert.equal(unresolved.getSyncState().conflicts?.length, 0);
  assert.equal(firstQueue.operations.length, 0);
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

test("syncs collection definitions through the scoped durable queue", async () => {
  const { queue, operations } = createMemoryQueue();
  const remoteCollections = new Map<
    string,
    { id: string; name: string; scope?: { userId?: string; tenantId?: string } }
  >();
  const pushed: string[] = [];
  const local = new LocalStorageAdapter({ key: "sync-collections", storage: createStorage() });
  const adapter = new SyncStorageAdapter({
    local,
    queue,
    userId: "user-1",
    tenantId: "tenant-1",
    remote: {
      push: async () => ({ type: "synced" }),
      pushCollection: async (operation) => {
        pushed.push(operation.type);
        if (operation.type === "upsert" && operation.collection) {
          assert.equal(
            (await adapter.getCollections?.())?.some((entry) => entry.id === operation.id),
            true,
          );
          remoteCollections.set(operation.id, operation.collection);
        } else {
          remoteCollections.delete(operation.id);
        }
      },
      pullCollections: async () => [...remoteCollections.values()],
    },
  });

  await adapter.setCollection?.({ id: "course-a", name: "Course A" });
  assert.deepEqual(operations[0]?.scope, { userId: "user-1", tenantId: "tenant-1" });
  await adapter.flushSync();
  assert.equal(remoteCollections.get("course-a")?.name, "Course A");

  await adapter.setCollection?.({ id: "course-a", name: "Renamed Course" });
  await adapter.flushSync();
  assert.equal(remoteCollections.get("course-a")?.name, "Renamed Course");
  await adapter.removeCollection?.("course-a");
  await adapter.flushSync();
  assert.deepEqual(pushed, ["upsert", "upsert", "remove"]);
  assert.equal(remoteCollections.has("course-a"), false);

  await local.setCollection({
    id: "removed-remotely",
    name: "Stale Course",
    scope: { userId: "user-1", tenantId: "tenant-1" },
  });
  await local.setCollectionMembership({
    collectionId: "removed-remotely",
    itemId: "guide-a",
    order: 0,
    scope: { userId: "user-1", tenantId: "tenant-1" },
  });
  remoteCollections.set("another-user-course", {
    id: "another-user-course",
    name: "Other User Course",
    scope: { userId: "user-2", tenantId: "tenant-1" },
  });
  await adapter.flushSync();
  assert.deepEqual(await adapter.getCollections?.(), []);
  assert.deepEqual(await adapter.getCollectionMemberships?.(), []);
  adapter.dispose();
});

test("syncs membership order changes and removals through the durable queue", async () => {
  const remoteMemberships = new Map<string, { collectionId: string; itemId: string; order: number }>();
  const makeAdapter = (key: string) => {
    const local = new LocalStorageAdapter({ key, storage: createStorage() });
    return new SyncStorageAdapter({
      local,
      queue: createMemoryQueue().queue,
      remote: {
        push: async () => ({ type: "synced" as const }),
        pushMembership: async (operation) => {
          if (operation.type === "remove") remoteMemberships.delete(operation.id);
          else if (operation.membership) remoteMemberships.set(operation.id, operation.membership);
        },
        pullMemberships: async () => [...remoteMemberships.values()],
      },
    });
  };
  const first = makeAdapter("membership-sync-a");
  const second = makeAdapter("membership-sync-b");
  for (const adapter of [first, second]) {
    for (const id of ["guide-a", "guide-b", "guide-c"]) {
      await adapter.set({ id, savedAt: 1, updatedAt: 1, meta: {} });
    }
    await adapter.setCollection?.({ id: "course-a", name: "Course A" });
    await adapter.setCollection?.({ id: "course-b", name: "Course B" });
  }
  await first.setCollectionMembership?.({ collectionId: "course-a", itemId: "guide-a", order: 0 });
  await first.setCollectionMembership?.({ collectionId: "course-a", itemId: "guide-b", order: 1 });
  await first.setCollectionMembership?.({ collectionId: "course-b", itemId: "guide-c", order: 0 });
  await first.setCollectionMembership?.({ collectionId: "course-b", itemId: "guide-a", order: 1 });
  await first.flushSync();
  await second.flushSync();
  assert.deepEqual(
    (await second.getCollectionMemberships?.())?.sort(
      (a, b) => a.collectionId.localeCompare(b.collectionId) || a.order - b.order,
    ),
    [
      { collectionId: "course-a", itemId: "guide-a", order: 0 },
      { collectionId: "course-a", itemId: "guide-b", order: 1 },
      { collectionId: "course-b", itemId: "guide-c", order: 0 },
      { collectionId: "course-b", itemId: "guide-a", order: 1 },
    ],
  );
  await first.setCollectionMembership?.({ collectionId: "course-a", itemId: "guide-b", order: 0 });
  await first.setCollectionMembership?.({ collectionId: "course-a", itemId: "guide-a", order: 1 });
  await first.flushSync();
  await second.flushSync();
  assert.deepEqual(
    (await second.getCollectionMemberships?.())?.filter((membership) => membership.collectionId === "course-b"),
    [
      { collectionId: "course-b", itemId: "guide-c", order: 0 },
      { collectionId: "course-b", itemId: "guide-a", order: 1 },
    ],
  );
  await first.removeCollectionMembership?.("course-a", "guide-a");
  await first.flushSync();
  await second.flushSync();
  assert.deepEqual(
    (await second.getCollectionMemberships?.())?.filter((membership) => membership.collectionId === "course-b"),
    [
      { collectionId: "course-b", itemId: "guide-c", order: 0 },
      { collectionId: "course-b", itemId: "guide-a", order: 1 },
    ],
  );
  assert.deepEqual(
    (await second.getCollectionMemberships?.())?.filter((membership) => membership.collectionId === "course-a"),
    [{ collectionId: "course-a", itemId: "guide-b", order: 0 }],
  );
  first.dispose();
  second.dispose();
});

test("membership operations survive a lost acknowledgement and replay idempotently", async () => {
  const storage = createStorage();
  const local = new LocalStorageAdapter({ key: "membership-replay", storage });
  const queueKey = "membership-replay-queue";
  const remoteMemberships = new Map<string, { collectionId: string; itemId: string; order: number }>();
  const attempts: string[] = [];
  await local.set(itemA);
  await local.setCollection?.({ id: "course-a", name: "Course A" });
  const createAdapter = () =>
    new SyncStorageAdapter({
      local,
      queue: new LocalStorageSyncQueueAdapter({ key: queueKey, storage }),
      maxRetries: 0,
      remote: {
        push: async () => ({ type: "synced" as const }),
        pushMembership: async (operation) => {
          attempts.push(operation.operationId);
          if (operation.type === "upsert" && operation.membership) {
            remoteMemberships.set(operation.id, operation.membership);
          }
          if (attempts.length === 1) throw new Error("acknowledgement lost");
        },
      },
    });
  const first = createAdapter();
  await first.setCollectionMembership?.({ collectionId: "course-a", itemId: itemA.id, order: 0 });
  await first.flushSync();
  assert.equal(first.getSyncState().status, "error");
  assert.equal((await new LocalStorageSyncQueueAdapter({ key: queueKey, storage }).getAll()).length, 1);
  first.dispose();

  const second = createAdapter();
  await second.flushSync();

  assert.equal(remoteMemberships.size, 1);
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0], attempts[1]);
  assert.equal((await new LocalStorageSyncQueueAdapter({ key: queueKey, storage }).getAll()).length, 0);
  second.dispose();
});

test("collection revision conflicts report outcomes and support host resolution", async () => {
  const local = new LocalStorageAdapter({ key: "collection-conflict", storage: createStorage() });
  let pushCount = 0;
  const adapter = new SyncStorageAdapter({
    local,
    queue: createMemoryQueue().queue,
    remote: {
      push: async () => ({ type: "synced" as const }),
      pushCollection: async (operation) => {
        pushCount += 1;
        if (pushCount === 1) {
          assert.equal(operation.baseRevision, "revision-1");
          return {
            type: "conflict" as const,
            resolution: "manual" as const,
            deleted: true,
            revision: "revision-2",
          };
        }
        return { type: "synced" as const, deleted: true, revision: "revision-3" };
      },
    },
  });
  await local.setCollection({ id: "course-a", name: "Local", revision: "revision-1" });
  await adapter.setCollection?.({ id: "course-a", name: "Renamed", revision: "revision-1" });
  await adapter.flushSync();
  assert.equal(adapter.getSyncState().collectionConflicts?.[0]?.resolution, "manual");
  await adapter.resolveCollectionSyncConflict?.("course-a", "remote");
  assert.deepEqual(await adapter.getCollections?.(), []);
  assert.equal(adapter.getSyncState().pendingCount, 0);
  adapter.dispose();
});

test("a local collection conflict outcome preserves a local rename against a remote tombstone", async () => {
  const local = new LocalStorageAdapter({ key: "collection-local-wins", storage: createStorage() });
  await local.setCollection({ id: "course-a", name: "Original", revision: "revision-1" });
  const adapter = new SyncStorageAdapter({
    local,
    queue: createMemoryQueue().queue,
    remote: {
      push: async () => ({ type: "synced" as const }),
      pushCollection: async () => ({
        type: "conflict" as const,
        resolution: "local" as const,
        deleted: true,
        revision: "revision-2",
      }),
    },
  });

  await adapter.setCollection?.({ id: "course-a", name: "Renamed Locally", revision: "revision-1" });
  await adapter.flushSync();

  assert.deepEqual(await adapter.getCollections?.(), [
    { id: "course-a", name: "Renamed Locally", revision: "revision-2" },
  ]);
  assert.equal(adapter.getSyncState().collectionConflicts?.[0]?.resolution, "local");
  assert.equal(adapter.getSyncState().pendingCount, 0);
  adapter.dispose();
});

test("a local collection deletion outcome is not reversed by a remote rename", async () => {
  const local = new LocalStorageAdapter({ key: "collection-local-delete-wins", storage: createStorage() });
  await local.setCollection({ id: "course-a", name: "Original", revision: "revision-1" });
  const adapter = new SyncStorageAdapter({
    local,
    queue: createMemoryQueue().queue,
    remote: {
      push: async () => ({ type: "synced" as const }),
      pushCollection: async () => ({
        type: "conflict" as const,
        resolution: "local" as const,
        deleted: false,
        collection: { id: "course-a", name: "Renamed Remotely" },
        revision: "revision-2",
      }),
    },
  });

  await adapter.removeCollection?.("course-a");
  await adapter.flushSync();

  assert.deepEqual(await adapter.getCollections?.(), []);
  assert.equal(adapter.getSyncState().collectionConflicts?.[0]?.resolution, "local");
  adapter.dispose();
});

test("item removal does not queue membership operations unsupported by the remote driver", async () => {
  const local = new LocalStorageAdapter({ key: "membership-unsupported", storage: createStorage() });
  await local.set(itemA);
  await local.setCollection?.({ id: "course-a", name: "Course A" });
  await local.setCollectionMembership?.({ collectionId: "course-a", itemId: itemA.id, order: 0 });
  const adapter = new SyncStorageAdapter({
    local,
    queue: createMemoryQueue().queue,
    remote: { push: async () => ({ type: "synced" as const }) },
  });

  await adapter.remove(itemA.id);
  await adapter.flushSync();

  assert.deepEqual(await adapter.getCollectionMemberships?.(), []);
  assert.equal(adapter.getSyncState().status, "synced");
  assert.equal(adapter.getSyncState().pendingCount, 0);
  adapter.dispose();
});

test("collection removal queues remote membership cleanup", async () => {
  const local = new LocalStorageAdapter({ key: "membership-collection-removal", storage: createStorage() });
  const removedMemberships: string[] = [];
  const pushes: string[] = [];
  await local.set(itemA);
  await local.setCollection?.({ id: "course-a", name: "Course A" });
  await local.setCollectionMembership?.({ collectionId: "course-a", itemId: itemA.id, order: 0 });
  const adapter = new SyncStorageAdapter({
    local,
    queue: createMemoryQueue().queue,
    remote: {
      push: async () => ({ type: "synced" as const }),
      pushCollection: async () => {
        pushes.push("collection");
        return { type: "synced" as const, deleted: true };
      },
      pushMembership: async (operation) => {
        if (operation.type === "remove") {
          removedMemberships.push(operation.id);
          pushes.push("membership");
        }
      },
    },
  });

  await adapter.removeCollection?.("course-a");
  await adapter.flushSync();

  assert.deepEqual(removedMemberships, ["course-a\u0000a"]);
  assert.deepEqual(pushes, ["membership", "collection"]);
  assert.deepEqual(await adapter.getCollectionMemberships?.(), []);
  assert.equal(adapter.getSyncState().pendingCount, 0);
  adapter.dispose();
});

test("membership snapshots skip references to missing items or collections", async () => {
  const local = new LocalStorageAdapter({ key: "membership-orphans", storage: createStorage() });
  const adapter = new SyncStorageAdapter({
    local,
    queue: createMemoryQueue().queue,
    remote: {
      push: async () => ({ type: "synced" as const }),
      pull: async () => [],
      pullCollections: async () => [],
      pullMemberships: async () => [{ collectionId: "missing-course", itemId: "missing-item", order: 0 }],
    },
  });

  await adapter.flushSync();

  assert.deepEqual(await adapter.getCollectionMemberships?.(), []);
  adapter.dispose();
});

test("membership pulls require local collection definitions before applying memberships", async () => {
  const memberships: KeepCollectionMembership[] = [];
  const local: StorageAdapter = {
    getAll: async () => [itemA],
    set: async () => undefined,
    remove: async () => undefined,
    clear: async () => undefined,
    getCollectionMemberships: async () => memberships,
    setCollectionMembership: async (membership) => void memberships.push(membership),
    removeCollectionMembership: async (collectionId, itemId) => {
      const index = memberships.findIndex(
        (membership) => membership.collectionId === collectionId && membership.itemId === itemId,
      );
      if (index !== -1) memberships.splice(index, 1);
    },
  };
  const adapter = new SyncStorageAdapter({
    local,
    queue: createMemoryQueue().queue,
    remote: {
      push: async () => ({ type: "synced" as const }),
      pull: async () => [],
      pullMemberships: async () => [{ collectionId: "missing-course", itemId: itemA.id, order: 0 }],
    },
  });

  await adapter.flushSync();

  assert.deepEqual(memberships, []);
  adapter.dispose();
});

test("scoped pulls assign the active scope to unscoped remote snapshots", async () => {
  const local = new LocalStorageAdapter({ key: "membership-scoped-pull", storage: createStorage() });
  await local.set({ ...itemA, scope: { userId: "user-a" } });
  const adapter = new SyncStorageAdapter({
    local,
    queue: createMemoryQueue().queue,
    scope: { userId: "user-a" },
    remote: {
      push: async () => ({ type: "synced" as const }),
      pull: async () => [itemA],
      pullCollections: async () => [{ id: "course-a", name: "Course A" }],
      pullMemberships: async () => [{ collectionId: "course-a", itemId: itemA.id, order: 0 }],
    },
  });

  await adapter.flushSync();

  assert.deepEqual(await adapter.getCollections?.(), [
    { id: "course-a", name: "Course A", scope: { userId: "user-a" } },
  ]);
  assert.deepEqual(await adapter.getCollectionMemberships?.(), [
    { collectionId: "course-a", itemId: itemA.id, order: 0, scope: { userId: "user-a" } },
  ]);
  adapter.dispose();
});

test("scoped sync deletion and clear preserve another scope with the same item IDs", async () => {
  const local = new LocalStorageAdapter({ key: "scoped-sync-delete", storage: createStorage() });
  await local.setMany([
    { ...itemA, scope: { userId: "user-a" } },
    { ...itemA, scope: { userId: "user-b" } },
    { ...itemB, scope: { userId: "user-a" } },
    { ...itemB, scope: { userId: "user-b" } },
  ]);
  await local.setCollection?.({ id: "course", name: "Course A", scope: { userId: "user-a" } });
  await local.setCollection?.({ id: "course", name: "Course B", scope: { userId: "user-b" } });
  await local.setCollectionMembership?.({
    collectionId: "course",
    itemId: itemA.id,
    order: 0,
    scope: { userId: "user-a" },
  });
  await local.setCollectionMembership?.({
    collectionId: "course",
    itemId: itemA.id,
    order: 0,
    scope: { userId: "user-b" },
  });
  const adapter = new SyncStorageAdapter({
    local,
    queue: createMemoryQueue().queue,
    scope: { userId: "user-a" },
    remote: {
      push: async () => ({ type: "synced" as const }),
      pushMembership: async () => undefined,
    },
  });

  await adapter.remove(itemA.id);
  await adapter.flushSync();
  assert.deepEqual(
    (await adapter.getAll()).map((item) => item.id),
    [itemB.id],
  );
  assert.deepEqual(
    (await local.getAll()).map((item) => item.scope?.userId),
    ["user-b", "user-a", "user-b"],
  );
  assert.deepEqual(await adapter.getCollectionMemberships?.(), []);
  assert.deepEqual(
    (await local.getCollectionMemberships()).map((entry) => entry.scope?.userId),
    ["user-b"],
  );

  await adapter.clear();
  assert.deepEqual(await adapter.getAll(), []);
  assert.deepEqual(
    (await local.getAll()).map((item) => item.scope?.userId),
    ["user-b", "user-b"],
  );
  assert.deepEqual(
    (await local.getCollectionMemberships()).map((entry) => entry.scope?.userId),
    ["user-b"],
  );
  adapter.dispose();
});

test("remote collection conflict resolution saves the server revision", async () => {
  const local = new LocalStorageAdapter({ key: "collection-conflict-revision", storage: createStorage() });
  const adapter = new SyncStorageAdapter({
    local,
    queue: createMemoryQueue().queue,
    remote: {
      push: async () => ({ type: "synced" as const }),
      pushCollection: async () => ({
        type: "conflict" as const,
        resolution: "manual" as const,
        deleted: false,
        collection: { id: "course-a", name: "Remote" },
        revision: "revision-2",
      }),
    },
  });
  await adapter.setCollection?.({ id: "course-a", name: "Local" });
  await adapter.flushSync();

  await adapter.resolveCollectionSyncConflict?.("course-a", "remote");

  assert.deepEqual(await adapter.getCollections?.(), [{ id: "course-a", name: "Remote", revision: "revision-2" }]);
  assert.equal(adapter.getSyncState().pendingCount, 0);
  adapter.dispose();
});
