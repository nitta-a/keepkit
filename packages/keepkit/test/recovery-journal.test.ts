import assert from "node:assert/strict";
import test from "node:test";
import type { KeepItem, StorageAdapter } from "../dist/core.js";
import {
  KeepStorageAccessError,
  KeepStorageParseError,
  KeepStorageQuotaError,
  KeepStorageSerializationError,
} from "../dist/core.js";
import {
  createStorageAdapter,
  FallbackStorageAdapter,
  LocalStorageAdapter,
  LocalStorageRecoveryJournal,
} from "../dist/storage.js";

type Meta = { title: string };
const itemA: KeepItem<Meta> = { id: "a", savedAt: 1, updatedAt: 1, meta: { title: "A" } };
const itemB: KeepItem<Meta> = { id: "b", savedAt: 2, updatedAt: 2, meta: { title: "B" } };

function createStorage() {
  const values = new Map<string, string>();
  const control = { failJournal: false, failCleanup: false };
  const storage: Storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      if (
        key === "journal" &&
        (control.failJournal || (control.failCleanup && JSON.parse(value).operations.length === 0))
      ) {
        throw Object.assign(new Error("Full"), { name: "QuotaExceededError" });
      }
      values.set(key, value);
    },
    removeItem: (key) => void values.delete(key),
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
  };
  return { storage, values, control };
}

function withFailures<TMeta>(base: LocalStorageAdapter<TMeta>) {
  const control = { reads: false, writes: false, operation: "" };
  const calls: string[] = [];
  const run = async <T>(operation: string, read: boolean, execute: () => Promise<T>) => {
    calls.push(operation);
    if ((read ? control.reads : control.writes) || operation === control.operation) {
      throw new KeepStorageAccessError({ operation: read ? "getAll" : "set" });
    }
    return execute();
  };
  const adapter = createStorageAdapter<TMeta>({
    getAll: () => run("getAll", true, () => base.getAll()),
    set: (item) => run("set", false, () => base.set(item)),
    setMany: (items) => run("setMany", false, () => base.setMany(items)),
    remove: (id, scope) => run("remove", false, () => base.remove(id, scope)),
    removeMany: (ids, scope) => run("removeMany", false, () => base.removeMany(ids, scope)),
    clear: () => run("clear", false, () => base.clear()),
    getCollections: () => run("getCollections", true, () => base.getCollections()),
    setCollection: (collection) => run("setCollection", false, () => base.setCollection(collection)),
    removeCollection: (id, scope) => run("removeCollection", false, () => base.removeCollection(id, scope)),
    getCollectionMemberships: () => run("getMemberships", true, () => base.getCollectionMemberships()),
    setCollectionMembership: (membership) =>
      run("setMembership", false, () => base.setCollectionMembership(membership)),
    removeCollectionMembership: (collectionId, itemId, scope) =>
      run("removeMembership", false, () => base.removeCollectionMembership(collectionId, itemId, scope)),
  });
  return { adapter, control, calls };
}

function setup() {
  const { storage, values, control } = createStorage();
  const primary = new LocalStorageAdapter<Meta>({ key: "primary", storage });
  const fallback = new LocalStorageAdapter<Meta>({ key: "fallback", storage });
  const primaryFaults = withFailures(primary);
  const fallbackFaults = withFailures(fallback);
  const errors: unknown[] = [];
  const journal = new LocalStorageRecoveryJournal<Meta>("journal", storage);
  const reopen = () =>
    new FallbackStorageAdapter({
      primary: primaryFaults.adapter,
      fallback: fallbackFaults.adapter,
      recoveryJournal: journal,
      mirrorWrites: true,
      migrateFallbackOnEmpty: true,
      onFallback: (error) => errors.push(error),
    });
  return { primary, fallback, primaryFaults, fallbackFaults, journal, storage, values, control, errors, reopen };
}

test("replays additions, edits, and deletions after restart without replacing primary-only data", async () => {
  const state = setup();
  await state.primary.setMany([itemA, { ...itemB, id: "primary-only" }]);
  await state.fallback.set(itemA);
  state.primaryFaults.control.writes = true;
  const adapter = state.reopen();
  await adapter.set({ ...itemA, updatedAt: 3, meta: { title: "Edited" } });
  await adapter.set(itemB);
  await adapter.remove(itemA.id);
  assert.deepEqual(
    (await state.journal.read())?.operations.map((operation) => operation.type),
    ["setItems", "setItems", "removeItems"],
  );
  state.primaryFaults.control.writes = false;
  const reopened = state.reopen();
  assert.deepEqual(
    (await reopened.getAll()).map((item) => item.id),
    ["primary-only", "b"],
  );
  assert.equal(reopened.isUsingFallback, false);
  assert.deepEqual((await state.journal.read())?.operations, []);
});

test("overlays committed operations when the fallback projection cannot write", async () => {
  const state = setup();
  await state.fallback.set(itemA);
  state.primaryFaults.control.writes = true;
  state.fallbackFaults.control.writes = true;
  const adapter = state.reopen();
  await adapter.remove(itemA.id);
  await adapter.set(itemB);
  assert.deepEqual(await state.fallback.getAll(), [itemA]);
  assert.deepEqual(await adapter.getAll(), [itemB]);
  assert.deepEqual(await state.reopen().getAll(), [itemB]);
  assert.ok(state.errors.length > 0);
});

test("retains the whole log after partial recovery so failed clear projections cannot revive deleted items", async () => {
  const state = setup();
  await state.primary.set(itemA);
  await state.fallback.set(itemA);
  state.primaryFaults.control.writes = true;
  state.fallbackFaults.control.writes = true;
  const adapter = state.reopen();
  await adapter.clear();
  await adapter.set(itemB);
  state.primaryFaults.control.writes = false;
  state.primaryFaults.control.operation = "setMany";
  assert.deepEqual(await state.reopen().getAll(), [itemB]);
  assert.deepEqual(await state.primary.getAll(), []);
  assert.equal((await state.journal.read())?.operations.length, 2);
  state.primaryFaults.control.operation = "";
  assert.deepEqual(await state.reopen().getAll(), [itemB]);
  assert.deepEqual((await state.journal.read())?.operations, []);
});

test("retains acknowledged changes while primary writes recover before reads", async () => {
  const state = setup();
  await state.primary.set(itemA);
  await state.fallback.set(itemA);
  state.primaryFaults.control.writes = true;
  state.fallbackFaults.control.writes = true;
  await state.reopen().set(itemB);
  state.primaryFaults.control.writes = false;
  state.primaryFaults.control.reads = true;
  const reopened = state.reopen();
  assert.deepEqual(await reopened.getAll(), [itemA, itemB]);
  assert.equal((await state.journal.read())?.operations.length, 1);
  const itemC = { ...itemB, id: "c" };
  await reopened.set(itemC);
  assert.deepEqual(await state.primary.getAll(), [itemA, itemB]);
  assert.deepEqual(await state.reopen().getAll(), [itemA, itemB, itemC]);
  assert.deepEqual(await state.primary.getAll(), [itemA, itemB, itemC]);
  assert.equal((await state.journal.read())?.operations.length, 2);
  state.primaryFaults.control.reads = false;
  assert.deepEqual(await state.reopen().getAll(), [itemA, itemB, itemC]);
  assert.deepEqual((await state.journal.read())?.operations, []);
});

for (const failedRead of ["getCollections", "getMemberships"]) {
  test(`retains metadata recovery until ${failedRead} succeeds`, async () => {
    const state = setup();
    state.primaryFaults.control.writes = true;
    state.fallbackFaults.control.writes = true;
    const collection = { id: "reading", name: "New" };
    const membership = { collectionId: "reading", itemId: "b", order: 0 };
    const adapter = state.reopen();
    await adapter.setCollection?.(collection);
    await adapter.setCollectionMembership?.(membership);
    state.primaryFaults.control.writes = false;
    state.primaryFaults.control.operation = failedRead;
    const reopened = state.reopen();
    assert.deepEqual(await reopened.getCollections?.(), [collection]);
    assert.deepEqual(await reopened.getCollectionMemberships?.(), [membership]);
    assert.equal((await state.journal.read())?.operations.length, 2);
    state.primaryFaults.control.operation = "";
    assert.deepEqual(await state.reopen().getCollections?.(), [collection]);
    assert.deepEqual((await state.journal.read())?.operations, []);
  });
}

test("returns the verified recovery snapshot without a second primary read", async () => {
  const state = setup();
  state.primaryFaults.control.writes = true;
  state.fallbackFaults.control.writes = true;
  await state.reopen().set(itemB);
  state.primaryFaults.control.writes = false;
  let reads = 0;
  const primary: StorageAdapter<Meta> = {
    ...state.primaryFaults.adapter,
    getAll: async () => {
      reads += 1;
      if (reads > 1) throw new KeepStorageAccessError({ operation: "getAll" });
      return state.primary.getAll();
    },
  };
  const reopened = new FallbackStorageAdapter({
    primary,
    fallback: state.fallbackFaults.adapter,
    recoveryJournal: state.journal,
  });
  assert.deepEqual(await reopened.getAll(), [itemB]);
  assert.equal(reads, 1);
  assert.deepEqual((await state.journal.read())?.operations, []);
});

test("keeps collection definitions on clear and replays collection names and membership removals", async () => {
  const state = setup();
  const adapter = state.reopen();
  await adapter.setMany([itemA, itemB]);
  await adapter.setCollection?.({ id: "reading", name: "Old" });
  await adapter.setCollectionMembership?.({ collectionId: "reading", itemId: "a", order: 0 });
  state.primaryFaults.control.writes = true;
  state.fallbackFaults.control.writes = true;
  await adapter.setCollection?.({ id: "reading", name: "New" });
  await adapter.removeCollectionMembership?.("reading", "a");
  await adapter.setCollection?.({ id: "empty", name: "Empty" });
  await adapter.clear();
  await adapter.set(itemB);
  await adapter.setCollectionMembership?.({ collectionId: "reading", itemId: "b", order: 4 });
  assert.deepEqual(await adapter.getCollections?.(), [
    { id: "reading", name: "New" },
    { id: "empty", name: "Empty" },
  ]);
  assert.deepEqual(await adapter.getCollectionMemberships?.(), [{ collectionId: "reading", itemId: "b", order: 4 }]);
  state.primaryFaults.control.writes = false;
  const reopened = state.reopen();
  assert.deepEqual(await reopened.getAll(), [itemB]);
  assert.deepEqual(await reopened.getCollections?.(), [
    { id: "reading", name: "New" },
    { id: "empty", name: "Empty" },
  ]);
  assert.deepEqual(await reopened.getCollectionMemberships?.(), [{ collectionId: "reading", itemId: "b", order: 4 }]);
});

test("removing a collection or item also removes its membership from the overlay", async () => {
  const state = setup();
  const adapter = state.reopen();
  await adapter.setMany([itemA, itemB]);
  await adapter.setCollection?.({ id: "reading", name: "Reading" });
  await adapter.setCollectionMembership?.({ collectionId: "reading", itemId: "a", order: 0 });
  await adapter.setCollectionMembership?.({ collectionId: "reading", itemId: "b", order: 1 });
  state.primaryFaults.control.writes = true;
  state.fallbackFaults.control.writes = true;
  await adapter.remove(itemA.id);
  assert.deepEqual(await adapter.getCollectionMemberships?.(), [{ collectionId: "reading", itemId: "b", order: 1 }]);
  await adapter.removeCollection?.("reading");
  assert.deepEqual(await adapter.getCollections?.(), []);
  assert.deepEqual(await adapter.getCollectionMemberships?.(), []);
  state.primaryFaults.control.writes = false;
  assert.deepEqual(await state.reopen().getCollections?.(), []);
  assert.deepEqual(await state.primary.getCollectionMemberships(), []);
});

test("preserves scoped identities when replaying same-ID items and definitions", async () => {
  const state = setup();
  const alice = { userId: "alice" };
  const bob = { userId: "bob" };
  const adapter = state.reopen();
  await adapter.setMany([
    { ...itemA, scope: alice },
    { ...itemA, scope: bob },
  ]);
  await adapter.setCollection?.({ id: "reading", name: "Alice", scope: alice });
  await adapter.setCollection?.({ id: "reading", name: "Bob", scope: bob });
  state.primaryFaults.control.writes = true;
  state.fallbackFaults.control.writes = true;
  await adapter.remove("a", alice);
  await adapter.removeCollection?.("reading", alice);
  state.primaryFaults.control.writes = false;
  const reopened = state.reopen();
  assert.deepEqual(await reopened.getAll(), [{ ...itemA, scope: bob }]);
  assert.deepEqual(await reopened.getCollections?.(), [{ id: "reading", name: "Bob", scope: bob }]);
});

test("a journal quota error rejects before changing fallback data", async () => {
  const state = setup();
  state.primaryFaults.control.writes = true;
  state.control.failJournal = true;
  await assert.rejects(state.reopen().set(itemA), KeepStorageQuotaError);
  assert.deepEqual(await state.fallback.getAll(), []);
  assert.deepEqual(
    state.fallbackFaults.calls.filter((operation) => !operation.startsWith("get")),
    [],
  );
  assert.equal(await state.journal.read(), undefined);
});

test("cleanup failure keeps the complete log and prevents newer unrecorded primary writes", async () => {
  const state = setup();
  state.primaryFaults.control.writes = true;
  const adapter = state.reopen();
  await adapter.set(itemA);
  state.primaryFaults.control.writes = false;
  state.control.failCleanup = true;
  assert.deepEqual(await adapter.getAll(), [itemA]);
  assert.equal(adapter.isUsingFallback, true);
  await adapter.set(itemB);
  assert.deepEqual(await state.primary.getAll(), [itemA]);
  assert.equal((await state.journal.read())?.operations.length, 2);
  state.control.failCleanup = false;
  assert.deepEqual(await state.reopen().getAll(), [itemA, itemB]);
});

test("rejects malformed or unsupported journals instead of choosing a stale store", async () => {
  for (const raw of [
    "{",
    '{"version":3,"operations":[]}',
    '{"version":1,"operations":[{"type":"setItems","items":[{}]}]}',
  ]) {
    const state = setup();
    await state.primary.set(itemA);
    state.values.set("journal", raw);
    await assert.rejects(state.reopen().getAll(), KeepStorageParseError);
    await assert.rejects(state.reopen().set(itemB), KeepStorageParseError);
    assert.deepEqual(await state.primary.getAll(), [itemA]);
  }
});

test("serializes wrappers sharing one journal without losing pending writes", async () => {
  const state = setup();
  state.primaryFaults.control.writes = true;
  const first = state.reopen();
  const second = state.reopen();
  await Promise.all([first.set(itemA), second.set(itemB)]);
  assert.equal((await state.journal.read())?.operations.length, 2);
  assert.deepEqual(await first.getAll(), [itemA, itemB]);
  state.primaryFaults.control.writes = false;
  assert.deepEqual(await second.getAll(), [itemA, itemB]);
});

test("materializes fallback merge once and replays its results as upserts", async () => {
  const state = setup();
  const adapter = state.reopen();
  await adapter.set(itemA);
  state.primaryFaults.control.writes = true;
  const merged = await adapter.merge([{ ...itemA, updatedAt: 3, meta: { title: "Merged" } }, itemB]);
  assert.deepEqual(
    merged.map((item) => item.meta.title),
    ["Merged", "B"],
  );
  assert.equal((await state.journal.read())?.operations[0]?.type, "setItems");
  state.primaryFaults.control.writes = false;
  assert.deepEqual(
    (await state.reopen().getAll()).map((item) => item.meta.title),
    ["Merged", "B"],
  );
});

test("healthy primary payloads can contain BigInt and cycles without entering the journal", async () => {
  const state = createStorage();
  let stored: KeepItem<{ value: unknown }>[] = [];
  const primary: StorageAdapter<{ value: unknown }> = createStorageAdapter({
    getAll: async () => structuredClone(stored),
    set: async (item) => {
      stored = structuredClone([...stored.filter((entry) => entry.id !== item.id), item]);
    },
    remove: async (id) => {
      stored = stored.filter((item) => item.id !== id);
    },
    clear: async () => {
      stored = [];
    },
  });
  const adapter = new FallbackStorageAdapter({
    primary,
    fallback: new LocalStorageAdapter<{ value: unknown }>({ key: "fallback", storage: state.storage }),
    recoveryJournal: new LocalStorageRecoveryJournal<{ value: unknown }>("journal", state.storage),
    mirrorWrites: true,
  });
  await adapter.set({ ...itemA, meta: { value: BigInt(3) } });
  const cycle: { self?: unknown } = {};
  cycle.self = cycle;
  await adapter.set({ ...itemB, meta: { value: cycle } });
  const items = await adapter.getAll();
  assert.equal(items[0]?.meta.value, BigInt(3));
  assert.deepEqual(items[1]?.meta.value, cycle);
  assert.equal(state.values.has("journal"), false);
});

async function withoutBrowserLocks(operation: () => Promise<void>) {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true });
  try {
    await operation();
  } finally {
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
    else Reflect.deleteProperty(globalThis, "window");
    if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
}

test("without browser locks healthy primary writes work but fallback commits fail closed", async () => {
  await withoutBrowserLocks(async () => {
    const state = setup();
    const adapter = state.reopen();
    await adapter.set(itemA);
    assert.deepEqual(await adapter.getAll(), [itemA]);
    state.primaryFaults.control.writes = true;
    await assert.rejects(adapter.set(itemB), KeepStorageAccessError);
    assert.equal(await state.journal.read(), undefined);
    assert.deepEqual(await state.fallback.getAll(), []);
  });
});

test("pending recovery remains readable without browser locks and does not mutate primary", async () => {
  const state = setup();
  state.primaryFaults.control.writes = true;
  await state.reopen().set(itemA);
  state.primaryFaults.control.writes = false;
  await withoutBrowserLocks(async () => {
    const adapter = state.reopen();
    assert.deepEqual(await adapter.getAll(), [itemA]);
    await assert.rejects(adapter.set(itemB), KeepStorageAccessError);
    assert.deepEqual(await state.primary.getAll(), []);
    assert.equal((await state.journal.read())?.operations.length, 1);
  });
  assert.deepEqual(await state.reopen().getAll(), [itemA]);
});

test("observer exceptions cannot reject an already journaled mutation", async () => {
  const state = setup();
  state.primaryFaults.control.writes = true;
  const adapter = new FallbackStorageAdapter({
    primary: state.primaryFaults.adapter,
    fallback: state.fallbackFaults.adapter,
    recoveryJournal: state.journal,
    onFallback: () => {
      throw new Error("observer failed");
    },
  });
  await adapter.set(itemA);
  assert.deepEqual(await adapter.getAll(), [itemA]);
});

test("healthy writes participate in the same browser lock used for recovery", async () => {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const lockNames: string[] = [];
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  Object.defineProperty(globalThis, "navigator", {
    value: {
      locks: {
        request: async (name: string, operation: () => Promise<unknown>) => {
          lockNames.push(name);
          return operation();
        },
      },
    },
    configurable: true,
  });
  try {
    const state = setup();
    const adapter = state.reopen();
    await adapter.set(itemA);
    state.primaryFaults.control.writes = true;
    await adapter.set(itemB);
    state.primaryFaults.control.writes = false;
    assert.deepEqual(await adapter.getAll(), [itemA, itemB]);
    assert.deepEqual(lockNames, Array(3).fill("keepkit:local-storage:journal"));
  } finally {
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
    else Reflect.deleteProperty(globalThis, "window");
    if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
});

test("rejects non-JSON fallback payloads before committing or projecting", async () => {
  const state = createStorage();
  const fallback = new LocalStorageAdapter<{ value: unknown }>({ key: "fallback", storage: state.storage });
  const journal = new LocalStorageRecoveryJournal<{ value: unknown }>("journal", state.storage);
  const adapter = new FallbackStorageAdapter({ fallback, recoveryJournal: journal });
  await assert.rejects(adapter.set({ ...itemA, meta: { value: BigInt(3) } }), KeepStorageSerializationError);
  assert.equal(await journal.read(), undefined);
  assert.deepEqual(await fallback.getAll(), []);
});

test("subscribes to journal-only changes from another browser tab and unsubscribes cleanly", () => {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const storageListeners = new Set<(event: { key: string | null }) => void>();
  Object.defineProperty(globalThis, "window", {
    value: {
      addEventListener: (_type: string, listener: (event: { key: string | null }) => void) =>
        storageListeners.add(listener),
      removeEventListener: (_type: string, listener: (event: { key: string | null }) => void) =>
        storageListeners.delete(listener),
    },
    configurable: true,
  });
  try {
    const state = setup();
    let notifications = 0;
    const unsubscribe = state.reopen().subscribe(() => {
      notifications += 1;
    });
    for (const listener of storageListeners) listener({ key: "unrelated" });
    assert.equal(notifications, 0);
    for (const listener of storageListeners) listener({ key: "journal" });
    assert.equal(notifications, 1);
    for (const listener of storageListeners) listener({ key: null });
    assert.equal(notifications, 2);
    unsubscribe();
    assert.equal(storageListeners.size, 0);
  } finally {
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("does not expose collection operations when the primary cannot persist definitions", async () => {
  const state = setup();
  const primary = createStorageAdapter<Meta>({
    getAll: () => state.primary.getAll(),
    set: (item) => state.primary.set(item),
    remove: (id, scope) => state.primary.remove(id, scope),
    clear: () => state.primary.clear(),
  });
  const adapter = new FallbackStorageAdapter({ primary, fallback: state.fallback, recoveryJournal: state.journal });
  assert.equal(adapter.setCollection, undefined);
  assert.equal(adapter.removeCollection, undefined);
  assert.equal(adapter.setCollectionMembership, undefined);
  await state.journal.write({
    version: 1,
    operations: [{ type: "setCollection", collection: { id: "c", name: "C" } }],
  });
  assert.deepEqual(await adapter.getAll(), []);
  assert.equal((await state.journal.read())?.operations.length, 1);
  assert.deepEqual(await state.primary.getCollections(), []);
});
