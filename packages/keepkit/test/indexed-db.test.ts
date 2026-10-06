import assert from "node:assert/strict";
import test from "node:test";
import { KeepStorageAccessError, KeepStorageParseError, KeepStorageQuotaError } from "../dist/core.js";
import { DEFAULT_INDEXEDDB_DATABASE, DEFAULT_INDEXEDDB_STORE, IndexedDBAdapter } from "../dist/storage.js";

const itemA = { id: "a", savedAt: 1, updatedAt: 1, meta: { title: "A" } };
const itemB = { id: "b", savedAt: 2, updatedAt: 2, meta: { title: "B" } };

class FakeRequest {
  result = undefined;
  error = null;
  onsuccess = null;
  onerror = null;
}

class FakeTransaction {
  error = null;
  oncomplete = null;
  onerror = null;
  onabort = null;

  complete() {
    queueMicrotask(() => this.oncomplete?.());
  }
}

class FakeObjectStore {
  constructor(database, transaction, name) {
    this.database = database;
    this.transaction = transaction;
    this.name = name;
  }

  getAll() {
    const request = new FakeRequest();
    queueMicrotask(() => {
      request.result = [...(this.database.stores.get(this.name)?.values() ?? [])];
      request.onsuccess?.();
    });
    return request;
  }

  put(item) {
    this.database.stores.get(this.name)?.set(item.key ?? item.id, item);
  }

  delete(id) {
    this.database.stores.get(this.name)?.delete(id);
  }

  clear() {
    this.database.stores.get(this.name)?.clear();
  }
}

class FakeDatabase {
  constructor(name) {
    this.name = name;
    this.stores = new Map();
    this.objectStoreNames = { contains: (name) => this.stores.has(name) };
  }

  createObjectStore(name) {
    this.stores.set(name, new Map());
    return {};
  }

  transaction(storeNames) {
    const transaction = new FakeTransaction();
    const available = Array.isArray(storeNames) ? storeNames : [storeNames];
    transaction.objectStore = (name) => {
      if (!available.includes(name)) throw new Error(`Object store "${name}" is outside this transaction.`);
      return new FakeObjectStore(this, transaction, name);
    };
    queueMicrotask(() => transaction.complete());
    return transaction;
  }
}

function createIndexedDB(options = {}) {
  const databases = new Map();
  return {
    open(name) {
      if (options.openError) throw options.openError;
      const request = new FakeRequest();
      const database = databases.get(name) ?? new FakeDatabase(name);
      const isNew = !databases.has(name);
      databases.set(name, database);
      queueMicrotask(() => {
        request.result = database;
        if (isNew) request.onupgradeneeded?.();
        if (options.blocked) {
          request.error = options.blocked;
          request.onblocked?.();
        } else if (options.requestError) {
          request.error = options.requestError;
          request.onerror?.();
        } else {
          request.onsuccess?.();
        }
      });
      return request;
    },
  };
}

test("uses IndexedDB defaults and supports CRUD, merge, and subscriptions", async () => {
  const indexedDB = createIndexedDB();
  const adapter = new IndexedDBAdapter({ indexedDB });
  assert.equal(adapter.storageKey, `${DEFAULT_INDEXEDDB_DATABASE}:${DEFAULT_INDEXEDDB_STORE}`);
  assert.deepEqual(await adapter.getAll(), []);

  await adapter.setMany([itemA, itemB, itemA]);
  assert.deepEqual(await adapter.getAll(), [itemA, itemB]);
  await adapter.removeMany([itemA.id, itemA.id]);
  assert.deepEqual(await adapter.getAll(), [itemB]);

  const merged = await adapter.merge([
    { ...itemB, updatedAt: 1, meta: { title: "old" } },
    { ...itemA, updatedAt: 3, meta: { title: "new" } },
  ]);
  assert.deepEqual(merged, [{ ...itemA, updatedAt: 3, meta: { title: "new" } }, itemB]);

  let messages = 0;
  const originalBroadcastChannel = globalThis.BroadcastChannel;
  const channels = [];
  globalThis.BroadcastChannel = class {
    onmessage = null;
    constructor(name) {
      this.name = name;
      this.closed = false;
      channels.push(this);
    }
    postMessage() {
      this.onmessage?.();
    }
    close() {
      this.closed = true;
    }
  };
  try {
    const unsubscribe = adapter.subscribe(() => messages++);
    assert.equal(channels[0]?.name, `keepkit:${adapter.storageKey}`);
    channels[0].onmessage?.({});
    assert.equal(messages, 1);
    unsubscribe();
    assert.equal(channels[0].closed, true);
  } finally {
    globalThis.BroadcastChannel = originalBroadcastChannel;
  }

  await adapter.clear();
  assert.deepEqual(await adapter.getAll(), []);
});

test("returns empty results when IndexedDB is unavailable", async () => {
  const adapter = new IndexedDBAdapter({ indexedDB: undefined });
  assert.deepEqual(await adapter.getAll(), []);
  await adapter.set(itemA);
  await adapter.remove(itemA.id);
  await adapter.clear();
  assert.deepEqual(await adapter.merge([itemA]), [itemA]);
  assert.equal(typeof adapter.subscribe(() => undefined), "function");
});

test("persists collections separately from items without changing the item database version", async () => {
  const indexedDB = createIndexedDB();
  const adapter = new IndexedDBAdapter({ indexedDB, databaseName: "collections-test", version: 3 });
  await adapter.set(itemA);
  await adapter.setCollection({ id: "empty", name: "Empty" });
  await adapter.setCollection({ id: "reading", name: "Reading" });
  await adapter.setCollection({ id: "reading", name: "Read later" });

  const reopened = new IndexedDBAdapter({ indexedDB, databaseName: "collections-test", version: 3 });
  assert.deepEqual(await reopened.getCollections(), [
    { id: "empty", name: "Empty" },
    { id: "reading", name: "Read later" },
  ]);
  assert.deepEqual(await reopened.getAll(), [itemA]);
  await reopened.setCollectionMembership({ collectionId: "reading", itemId: "a", order: 2 });
  assert.deepEqual(await reopened.getCollectionMemberships(), [{ collectionId: "reading", itemId: "a", order: 2 }]);
  await reopened.clear();
  assert.deepEqual(await reopened.getCollections(), [
    { id: "empty", name: "Empty" },
    { id: "reading", name: "Read later" },
  ]);
  await reopened.removeCollection("reading");
  assert.deepEqual(await adapter.getCollections(), [{ id: "empty", name: "Empty" }]);
  assert.deepEqual(await adapter.getCollectionMemberships(), []);
});

test("wraps IndexedDB open failures and retries after a failed open", async () => {
  const cause = new Error("open failed");
  const indexedDB = createIndexedDB({ openError: cause });
  const adapter = new IndexedDBAdapter({
    databaseName: "custom-db",
    dbName: "ignored-db",
    key: "ignored-key",
    storeName: "custom-store",
    version: 3,
    indexedDB,
  });
  assert.equal(adapter.storageKey, "custom-db:custom-store");

  await assert.rejects(adapter.getAll(), (error) => {
    assert.equal(error instanceof KeepStorageAccessError, true);
    assert.equal(error.operation, "getAll");
    assert.equal(error.cause, cause);
    return true;
  });
  await assert.rejects(adapter.getAll(), KeepStorageAccessError);
});

test("wraps IndexedDB request, transaction, parse, and quota failures", async () => {
  const requestCause = new Error("request failed");
  const requestErrorDB = createIndexedDB({ requestError: requestCause });
  const requestAdapter = new IndexedDBAdapter({ indexedDB: requestErrorDB });
  await assert.rejects(requestAdapter.getAll(), (error) => {
    assert.equal(error instanceof KeepStorageAccessError, true);
    assert.equal(error.cause, requestCause);
    return true;
  });

  const invalidDB = createIndexedDB();
  const invalidAdapter = new IndexedDBAdapter({ indexedDB: invalidDB });
  const database = await invalidAdapter.getAll();
  assert.deepEqual(database, []);

  const originalTransaction = FakeDatabase.prototype.transaction;
  FakeDatabase.prototype.transaction = function transaction() {
    const transaction = new FakeTransaction();
    transaction.error = new Error("transaction failed");
    transaction.objectStore = () => ({
      getAll: () => {
        const request = new FakeRequest();
        queueMicrotask(() => {
          request.result = [];
          request.onsuccess?.();
        });
        return request;
      },
      put: () => undefined,
      delete: () => undefined,
      clear: () => undefined,
    });
    queueMicrotask(() => transaction.onerror?.());
    return transaction;
  };
  try {
    const transactionAdapter = new IndexedDBAdapter({ indexedDB: createIndexedDB() });
    await assert.rejects(transactionAdapter.set(itemA), KeepStorageAccessError);
  } finally {
    FakeDatabase.prototype.transaction = originalTransaction;
  }

  const quotaCause = Object.assign(new Error("full"), { name: "QuotaExceededError" });
  const quotaDB = createIndexedDB();
  const quotaDatabase = new FakeDatabase("quota");
  quotaDatabase.transaction = () => {
    const transaction = new FakeTransaction();
    transaction.objectStore = () => ({
      put: () => {
        throw quotaCause;
      },
    });
    return transaction;
  };
  const originalOpen = quotaDB.open;
  quotaDB.open = () => {
    const request = new FakeRequest();
    queueMicrotask(() => {
      request.result = quotaDatabase;
      request.onsuccess?.();
    });
    return request;
  };
  try {
    const quotaAdapter = new IndexedDBAdapter({ indexedDB: quotaDB });
    await assert.rejects(quotaAdapter.set(itemA), (error) => {
      assert.equal(error instanceof KeepStorageQuotaError, true);
      assert.equal(error.cause, quotaCause);
      return true;
    });
  } finally {
    quotaDB.open = originalOpen;
  }

  const parseDB = createIndexedDB();
  const parseAdapter = new IndexedDBAdapter({ indexedDB: parseDB });
  const parseDatabase = await parseAdapter.getAll();
  assert.deepEqual(parseDatabase, []);
  // The fake store is intentionally replaced with an invalid result for the parser branch.
  const invalidStoreDB = new FakeDatabase("invalid");
  invalidStoreDB.transaction = () => ({
    objectStore: () => ({
      getAll: () => {
        const request = new FakeRequest();
        queueMicrotask(() => {
          request.result = [{ id: "invalid" }];
          request.onsuccess?.();
        });
        return request;
      },
    }),
  });
  const invalidFactory = {
    open() {
      const request = new FakeRequest();
      queueMicrotask(() => {
        request.result = invalidStoreDB;
        request.onsuccess?.();
      });
      return request;
    },
  };
  await assert.rejects(new IndexedDBAdapter({ indexedDB: invalidFactory }).getAll(), (error) => {
    assert.equal(error instanceof KeepStorageParseError, true);
    return true;
  });
});
