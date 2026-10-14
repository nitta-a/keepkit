import assert from "node:assert/strict";
import test from "node:test";
import {
  type KeepItem,
  KeepStorageAccessError,
  KeepStorageQuotaError,
  KeepStorageSerializationError,
  type StorageAdapter,
} from "../dist/core.js";
import {
  createBrowserStorageAdapter,
  createStorageAdapter,
  type FallbackRecoveryJournal,
  type FallbackRecoveryJournalState,
  FallbackStorageAdapter,
  LocalStorageAdapter,
  LocalStorageRecoveryJournal,
} from "../dist/storage.js";

type Meta = { title: string };
const a: KeepItem<Meta> = { id: "a", savedAt: 1, updatedAt: 1, meta: { title: "A" } };
const b: KeepItem<Meta> = { ...a, id: "b", meta: { title: "B" } };

function fixture() {
  const values = new Map<string, string>();
  const controls = { primaryRead: false, primaryWrite: false, journal: false, fallbackWrite: false };
  let journalWrites = 0;
  const storage: Storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      if (key === "journal") {
        if (controls.journal) throw Object.assign(new Error("Quota"), { name: "QuotaExceededError" });
        journalWrites += 1;
      } else if (key.startsWith("fallback") && controls.fallbackWrite) {
        throw Object.assign(new Error("Quota"), { name: "QuotaExceededError" });
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
  const primary = new LocalStorageAdapter<Meta>({ key: "primary", storage });
  const fallback = new LocalStorageAdapter<Meta>({ key: "fallback", storage });
  const access = async <T>(read: boolean, execute: () => Promise<T>): Promise<T> => {
    if (read ? controls.primaryRead : controls.primaryWrite)
      throw new KeepStorageAccessError({ operation: read ? "getAll" : "set" });
    return execute();
  };
  const faulted = createStorageAdapter<Meta>({
    getAll: () => access(true, () => primary.getAll()),
    set: (item) => access(false, () => primary.set(item)),
    setMany: (items) => access(false, () => primary.setMany(items)),
    remove: (id, scope) => access(false, () => primary.remove(id, scope)),
    removeMany: (ids, scope) => access(false, () => primary.removeMany(ids, scope)),
    clear: () => access(false, () => primary.clear()),
    getCollections: () => access(true, () => primary.getCollections()),
    setCollection: (collection) => access(false, () => primary.setCollection(collection)),
    removeCollection: (id, scope) => access(false, () => primary.removeCollection(id, scope)),
    getCollectionMemberships: () => access(true, () => primary.getCollectionMemberships()),
    setCollectionMembership: (membership) => access(false, () => primary.setCollectionMembership(membership)),
    removeCollectionMembership: (collectionId, itemId, scope) =>
      access(false, () => primary.removeCollectionMembership(collectionId, itemId, scope)),
  });
  const journal = new LocalStorageRecoveryJournal<Meta>("journal", storage);
  const errors: unknown[] = [];
  const reopen = () =>
    new FallbackStorageAdapter({
      primary: faulted,
      fallback,
      recoveryJournal: journal,
      mirrorWrites: true,
      migrateFallbackOnEmpty: true,
      onFallback: (error) => errors.push(error),
    });
  return {
    values,
    controls,
    storage,
    primary,
    fallback,
    faulted,
    journal,
    errors,
    reopen,
    journalWrites: () => journalWrites,
  };
}

test("complete checkpoints preserve primary-only items, collections and memberships during outages", async () => {
  const f = fixture();
  await f.primary.setMany([a, b]);
  await f.primary.setCollection({ id: "c", name: "Reading" });
  await f.primary.setCollectionMembership({ collectionId: "c", itemId: "a", order: 0 });
  f.controls.fallbackWrite = true;
  const adapter = f.reopen();
  assert.deepEqual(await adapter.getAll(), [a, b]);
  const state = await f.journal.read();
  assert.equal(state?.version, 2);
  if (state?.version !== 2) throw new Error("Expected v2");
  assert.equal(state.snapshot?.capabilities.collections, true);
  assert.deepEqual(state.snapshot?.memberships, [{ collectionId: "c", itemId: "a", order: 0 }]);
  f.controls.primaryRead = true;
  f.controls.primaryWrite = true;
  const offline = f.reopen();
  assert.deepEqual(await offline.getAll(), [a, b]);
  assert.deepEqual(await offline.getCollections?.(), [{ id: "c", name: "Reading" }]);
  assert.deepEqual(await offline.getCollectionMemberships?.(), [{ collectionId: "c", itemId: "a", order: 0 }]);
  await offline.remove("a");
  await offline.set({ ...b, meta: { title: "Edited" } });
  assert.deepEqual(await f.reopen().getAll(), [{ ...b, meta: { title: "Edited" } }]);
});

test("same-content reads do not rewrite the journal or generate storage-event loops", async () => {
  const f = fixture();
  await f.primary.set(a);
  const adapter = f.reopen();
  await adapter.getAll();
  const initial = f.journalWrites();
  const capturedAt = adapter.recovery?.getState().capturedAt;
  await adapter.getAll();
  await adapter.getCollections?.();
  await f.reopen().getAll();
  assert.equal(f.journalWrites(), initial);
  assert.equal(adapter.recovery?.getState().capturedAt, capturedAt);
});

test("checkpoint failure preserves a primary commit and retries on the next healthy read", async () => {
  const f = fixture();
  const adapter = f.reopen();
  await adapter.set(a);
  f.controls.journal = true;
  await adapter.set(b);
  assert.deepEqual(await f.primary.getAll(), [a, b]);
  assert.equal(adapter.recovery?.getState().snapshotStale, true);
  assert.ok(adapter.recovery?.getState().issue);
  f.controls.journal = false;
  await adapter.getAll();
  assert.equal(adapter.recovery?.getState().snapshotStale, false);
  f.controls.primaryRead = true;
  assert.deepEqual(await f.reopen().getAll(), [a, b]);
});

test("journaled changes mark reserve snapshots stale until primary recovery completes", async () => {
  const f = fixture();
  const adapter = f.reopen();
  await adapter.set(a);
  assert.equal(adapter.recovery?.getState().snapshotStale, false);
  f.controls.primaryWrite = true;
  await adapter.set(b);
  assert.equal(adapter.recovery?.getState().source, "fallback");
  assert.equal(adapter.recovery?.getState().pendingOperations, 1);
  assert.equal(adapter.recovery?.getState().snapshotStale, true);
  f.controls.primaryWrite = false;
  assert.equal((await adapter.recovery?.retry?.())?.status, "applied");
  assert.equal(adapter.recovery?.getState().snapshotStale, false);
});

test("a failing recovery observer cannot hide state updates from subsequent observers", async () => {
  const f = fixture();
  const adapter = f.reopen();
  let notifications = 0;
  const unsubscribeFailure = adapter.recovery?.subscribe(() => {
    throw new Error("Observer failed");
  });
  const unsubscribeSuccess = adapter.recovery?.subscribe(() => {
    notifications += 1;
  });
  await adapter.set(a);
  assert.ok(notifications > 0);
  const initial = notifications;
  f.controls.primaryWrite = true;
  await adapter.set(b);
  assert.ok(notifications > initial);
  assert.equal(adapter.recovery?.getState().pendingOperations, 1);
  assert.deepEqual(await f.fallback.getAll(), [a, b]);
  unsubscribeFailure?.();
  unsubscribeSuccess?.();
});

test("migrates every empty primary facet before creating the first checkpoint", async () => {
  const f = fixture();
  await f.fallback.set(a);
  await f.fallback.setCollection({ id: "c", name: "Legacy" });
  await f.fallback.setCollectionMembership({ collectionId: "c", itemId: "a", order: 2 });
  const adapter = f.reopen();
  assert.deepEqual(await adapter.getAll(), [a]);
  assert.deepEqual(await f.primary.getCollections(), [{ id: "c", name: "Legacy" }]);
  assert.deepEqual(await f.primary.getCollectionMemberships(), [{ collectionId: "c", itemId: "a", order: 2 }]);
  const state = await f.journal.read();
  assert.equal(state?.version, 2);
  if (state?.version !== 2) throw new Error("Expected v2");
  assert.deepEqual(state.snapshot?.items, [a]);
  assert.deepEqual(state.archives?.[0]?.items, [a]);
});

for (const firstOperation of ["set", "merge"] as const) {
  test(`migrates legacy data when ${firstOperation} is the first adapter operation`, async () => {
    const f = fixture();
    await f.fallback.set(a);
    await f.fallback.setCollection({ id: "c", name: "Legacy" });
    await f.fallback.setCollectionMembership({ collectionId: "c", itemId: "a", order: 2 });
    const adapter = f.reopen();
    if (firstOperation === "set") await adapter.set(b);
    else assert.deepEqual(await adapter.merge([b]), [a, b]);
    assert.deepEqual(await adapter.getAll(), [a, b]);
    assert.deepEqual(await f.primary.getCollections(), [{ id: "c", name: "Legacy" }]);
    assert.deepEqual(await f.primary.getCollectionMemberships(), [{ collectionId: "c", itemId: "a", order: 2 }]);
    const state = await f.journal.read();
    if (state?.version !== 2) throw new Error("Expected v2");
    assert.deepEqual(state.snapshot?.items, [a, b]);
    assert.deepEqual(state.archives?.[0]?.items, [a]);
    f.controls.primaryRead = true;
    assert.deepEqual(await f.reopen().getAll(), [a, b]);
  });
}

test("a failed initial migration journal write leaves both branches intact for retry", async () => {
  const f = fixture();
  await f.fallback.set(a);
  f.controls.journal = true;
  const adapter = f.reopen();
  await assert.rejects(adapter.set(b), KeepStorageQuotaError);
  assert.deepEqual(await f.primary.getAll(), []);
  assert.deepEqual(await f.fallback.getAll(), [a]);
  f.controls.journal = false;
  await adapter.set(b);
  assert.deepEqual(await adapter.getAll(), [a, b]);
});

test("v1 pending operations survive migration and established deletion history blocks old fallback imports", async () => {
  const f = fixture();
  await f.primary.set(a);
  await f.fallback.setMany([a, b]);
  await f.journal.write({ version: 1, operations: [{ type: "removeItems", ids: ["a"] }] });
  assert.deepEqual(await f.reopen().getAll(), []);
  const migrated = await f.journal.read();
  assert.equal(migrated?.version, 2);
  assert.deepEqual(migrated?.operations, []);
  assert.deepEqual(await f.reopen().getAll(), []);
});

test("archives a divergent old fallback before the first healthy mirror overwrites it", async () => {
  const f = fixture();
  await f.primary.set(a);
  const old = { ...a, meta: { title: "Old branch" } };
  await f.fallback.set(old);
  await f.reopen().set({ ...a, meta: { title: "New primary" } });
  assert.deepEqual(await f.fallback.getAll(), [{ ...a, meta: { title: "New primary" } }]);
  const inspection = await f.reopen().recovery?.inspect?.();
  assert.deepEqual(inspection?.sources.find((source) => source.id === "legacy:0")?.snapshot.items, [old]);
  assert.equal(inspection?.rows[0]?.conflict, true);
});

test("inspect is read-only; distinct records default to preservation and conflicts require a source", async () => {
  const f = fixture();
  await f.primary.set(a);
  await f.fallback.setMany([{ ...a, meta: { title: "Other" } }, b]);
  const adapter = f.reopen();
  const before = [...f.values];
  const inspection = await adapter.recovery?.inspect?.();
  assert.ok(inspection);
  assert.deepEqual([...f.values], before);
  assert.equal(inspection.rows.find((row) => row.id === "a")?.selectedSource, undefined);
  assert.equal(inspection.rows.find((row) => row.id === "b")?.selectedSource, "fallback");
  await assert.rejects(
    adapter.recovery?.apply?.({ token: inspection.token, selections: {} }) ?? Promise.resolve(),
    /Resolve recovery conflicts/,
  );
  assert.deepEqual([...f.values], before);
});

test("rejects a stale inspection before committing backups or any repair write", async () => {
  const f = fixture();
  await f.primary.set(a);
  await f.fallback.set(b);
  const adapter = f.reopen();
  const inspection = await adapter.recovery?.inspect?.();
  assert.ok(inspection);
  await f.primary.set({ ...a, meta: { title: "Changed after inspection" } });
  const before = [...f.values];
  await assert.rejects(
    adapter.recovery?.apply?.({ token: inspection.token, selections: {} }) ?? Promise.resolve(),
    /Recovery data changed/,
  );
  assert.deepEqual([...f.values], before);
});

test("an unchanged comparison has no repair operations and applying it writes nothing", async () => {
  const f = fixture();
  await f.primary.set(a);
  await f.fallback.set(a);
  const adapter = f.reopen();
  const inspection = await adapter.recovery?.inspect?.();
  assert.ok(inspection);
  assert.deepEqual(inspection.operations, []);
  const before = [...f.values];
  assert.deepEqual(await adapter.recovery?.apply?.({ token: inspection.token, selections: {} }), {
    status: "applied",
    pendingOperations: 0,
  });
  assert.deepEqual([...f.values], before);
});

test("choosing the existing primary also repairs a divergent fallback and records fallback-only removals", async () => {
  const f = fixture();
  await f.primary.set(a);
  await f.fallback.setMany([{ ...a, meta: { title: "Old branch" } }, b]);
  const adapter = f.reopen();
  const inspection = await adapter.recovery?.inspect?.();
  assert.ok(inspection);
  const first = inspection.rows.find((row) => row.id === "a");
  const second = inspection.rows.find((row) => row.id === "b");
  assert.ok(first && second);
  const selections = { [first.key]: "primary", [second.key]: "__remove__" };
  const result = await adapter.recovery?.apply?.({ token: inspection.token, selections });
  assert.equal(result?.status, "applied");
  assert.deepEqual(await f.primary.getAll(), [a]);
  assert.deepEqual(await f.fallback.getAll(), [a]);
  f.controls.primaryRead = true;
  assert.deepEqual(await f.reopen().getAll(), [a]);
});

test("repair commits backups and the full sequence before replay, survives restart, and forbids resubmission", async () => {
  const f = fixture();
  await f.primary.set(a);
  await f.fallback.set(b);
  const adapter = f.reopen();
  const inspection = await adapter.recovery?.inspect?.();
  assert.ok(inspection);
  f.controls.primaryWrite = true;
  const result = await adapter.recovery?.apply?.({ token: inspection.token, selections: {} });
  assert.equal(result?.status, "pending");
  const pending = await f.journal.read();
  assert.equal(pending?.version, 2);
  if (pending?.version !== 2) throw new Error("Expected v2");
  assert.ok(pending.operations.length > 0);
  assert.equal(pending.backups?.length, 2);
  assert.equal(pending.backups?.[0]?.version, 2);
  const saved = JSON.stringify(pending.backups);
  await assert.rejects(
    adapter.recovery?.apply?.({ token: inspection.token, selections: {} }) ?? Promise.resolve(),
    /Recovery is pending/,
  );
  f.controls.primaryWrite = false;
  const reopened = f.reopen();
  assert.equal((await reopened.recovery?.retry?.())?.status, "applied");
  assert.deepEqual(await f.primary.getAll(), [a, b]);
  const recovered = await f.journal.read();
  if (recovered?.version !== 2) throw new Error("Expected v2");
  assert.deepEqual(recovered.operations, []);
  assert.equal(JSON.stringify(recovered.backups), saved);
});

test("approved collection removal previews dependent membership removal and item unassignment", async () => {
  const f = fixture();
  await f.primary.set({ ...a, collectionId: "c" });
  await f.primary.setCollection({ id: "c", name: "Reading" });
  await f.primary.setCollectionMembership({ collectionId: "c", itemId: "a", order: 0 });
  const adapter = f.reopen();
  const initial = await adapter.recovery?.inspect?.();
  assert.ok(initial);
  const row = initial.rows.find((entry) => entry.kind === "collection");
  assert.ok(row);
  const selections = { [row.key]: "__remove__" };
  const preview = await adapter.recovery?.inspect?.({ selections });
  assert.ok(preview);
  assert.deepEqual(preview.issues, []);
  assert.ok(preview.operations.some((operation) => operation.type === "removeMembership"));
  const itemOperation = preview.operations.find((operation) => operation.type === "setItems");
  assert.ok(itemOperation?.type === "setItems");
  assert.equal(itemOperation.items[0]?.collectionId, undefined);
  assert.equal((await adapter.recovery?.apply?.({ token: preview.token, selections }))?.status, "applied");
  assert.deepEqual(await f.primary.getCollections(), []);
  assert.deepEqual(await f.primary.getCollectionMemberships(), []);
  assert.deepEqual(await f.primary.getAll(), [a]);
});

for (const kind of ["collection", "membership"] as const) {
  test(`unsupported ${kind} removals block repair before saving backups or operations`, async () => {
    const f = fixture();
    await f.primary.set(a);
    await f.primary.setCollection({ id: "c", name: "Reading" });
    if (kind === "membership") await f.primary.setCollectionMembership({ collectionId: "c", itemId: "a", order: 0 });
    const {
      removeCollection: _removeCollection,
      removeCollectionMembership: _removeMembership,
      ...readable
    } = f.faulted;
    const primary = {
      ...readable,
      ...(kind === "collection" ? { removeCollectionMembership: f.faulted.removeCollectionMembership } : {}),
      ...(kind === "membership" ? { removeCollection: f.faulted.removeCollection } : {}),
    };
    const adapter = new FallbackStorageAdapter({ primary, fallback: f.fallback, recoveryJournal: f.journal });
    const initial = await adapter.recovery?.inspect?.();
    assert.ok(initial);
    const row = initial.rows.find((entry) => entry.kind === kind);
    assert.ok(row);
    const selections = { [row.key]: "__remove__" };
    const preview = await adapter.recovery?.inspect?.({ selections });
    assert.ok(preview);
    assert.ok(preview.issues.includes(`primary-${kind === "collection" ? "collections" : "memberships"}-unavailable`));
    const before = [...f.values];
    await assert.rejects(
      adapter.recovery?.apply?.({ token: preview.token, selections }) ?? Promise.resolve(),
      /Resolve recovery conflicts and dependencies/,
    );
    assert.deepEqual([...f.values], before);
  });
}

test("read-only metadata does not block item repairs that leave metadata unchanged", async () => {
  const f = fixture();
  await f.primary.set(a);
  await f.fallback.set(b);
  const collection = { id: "c", name: "Reading" };
  await f.primary.setCollection(collection);
  await f.fallback.setCollection(collection);
  const { setCollection: _setCollection, removeCollection: _removeCollection, ...primary } = f.faulted;
  const adapter = new FallbackStorageAdapter({ primary, fallback: f.fallback, recoveryJournal: f.journal });
  const preview = await adapter.recovery?.inspect?.();
  assert.ok(preview);
  assert.deepEqual(preview.issues, []);
  assert.equal((await adapter.recovery?.apply?.({ token: preview.token, selections: {} }))?.status, "applied");
  assert.deepEqual(await f.primary.getAll(), [a, b]);
  assert.deepEqual(await f.primary.getCollections(), [collection]);
});

test("inconsistent memberships block apply and slash-containing identifiers have distinct rows", async () => {
  const f = fixture();
  await f.primary.setMany([
    { ...a, id: "b/c" },
    { ...a, id: "c" },
  ]);
  await f.primary.setCollection({ id: "a", name: "A" });
  await f.primary.setCollection({ id: "a/b", name: "AB" });
  await f.primary.setCollectionMembership({ collectionId: "a", itemId: "b/c", order: 0 });
  await f.primary.setCollectionMembership({ collectionId: "a/b", itemId: "c", order: 0 });
  await f.primary.setCollectionMembership({ collectionId: "missing", itemId: "c", order: 0 });
  const inspection = await f.reopen().recovery?.inspect?.();
  assert.ok(inspection);
  assert.equal(inspection.rows.filter((row) => row.kind === "membership").length, 3);
  assert.ok(inspection.issues.some((issue) => issue.startsWith("invalid-membership")));
});

for (const [name, value] of [
  ["Date", new Date(0)],
  ["Map", new Map()],
  ["Set", new Set()],
  ["NaN", Number.NaN],
  ["Infinity", Number.POSITIVE_INFINITY],
  ["undefined", undefined],
  ["function", () => 1],
  ["symbol", Symbol("value")],
  ["BigInt", BigInt(1)],
] as const) {
  test(`rejects ${name} metadata before localStorage or a fallback journal changes`, async () => {
    const f = fixture();
    const local = new LocalStorageAdapter<{ value: unknown }>({ key: "strict", storage: f.storage });
    await assert.rejects(local.set({ ...a, meta: { value } }), KeepStorageSerializationError);
    assert.equal(f.values.has("strict"), false);
    const fallback: StorageAdapter<{ value: unknown }> = local;
    const offline = new FallbackStorageAdapter({
      fallback,
      recoveryJournal: new LocalStorageRecoveryJournal<{ value: unknown }>("journal", f.storage),
    });
    await assert.rejects(offline.set({ ...a, meta: { value } }), KeepStorageSerializationError);
    assert.equal(await f.journal.read(), undefined);
  });
}

test("rejects cycles, extra array properties, symbol keys and non-enumerable metadata", async () => {
  const cycle: { self?: unknown } = {};
  cycle.self = cycle;
  const array: unknown[] = [];
  Object.defineProperty(array, "extra", { value: true, enumerable: true });
  const symbol = { [Symbol("key")]: "value" };
  const hidden = {};
  Object.defineProperty(hidden, "hidden", { value: 1 });
  for (const value of [cycle, array, symbol, hidden]) {
    const f = fixture();
    const adapter = new LocalStorageAdapter<{ value: unknown }>({ key: "strict", storage: f.storage });
    await assert.rejects(adapter.set({ ...a, meta: { value } }), KeepStorageSerializationError);
    assert.equal(f.values.has("strict"), false);
  }
});

test("known optional undefined fields are omitted without relaxing nested metadata", async () => {
  const f = fixture();
  const adapter = new LocalStorageAdapter<Meta>({ key: "strict", storage: f.storage });
  await adapter.set({ ...a, note: undefined, scope: undefined });
  await f.journal.write({
    version: 2,
    operations: [],
    initialized: undefined,
    backups: [
      { format: "keepkit", version: 2, exportedAt: 1, items: [], collections: [], memberships: [], scopes: undefined },
    ],
  });
  assert.deepEqual(await adapter.getAll(), [a]);
});

test("partial legacy migration survives restart with a nonempty primary", async () => {
  const f = fixture();
  const c = { ...a, id: "c" };
  await f.fallback.setMany([a, b, c]);
  let writes = 0;
  let fail = true;
  const primary = createStorageAdapter<Meta>({
    getAll: () => f.primary.getAll(),
    set: async (item) => {
      writes += 1;
      if (fail && writes === 2) throw new KeepStorageAccessError({ operation: "set" });
      await f.primary.set(item);
    },
    remove: (id, scope) => f.primary.remove(id, scope),
    clear: () => f.primary.clear(),
  });
  const reopen = () =>
    new FallbackStorageAdapter({
      primary,
      fallback: f.fallback,
      recoveryJournal: f.journal,
      migrateFallbackOnEmpty: true,
    });
  assert.deepEqual(await reopen().getAll(), [a, b, c]);
  assert.deepEqual(await f.primary.getAll(), [a]);
  assert.equal((await f.journal.read())?.operations.length, 1);
  fail = false;
  assert.deepEqual(await reopen().getAll(), [a, b, c]);
  assert.deepEqual(await f.primary.getAll(), [a, b, c]);
  assert.deepEqual((await f.journal.read())?.operations, []);
});

test("outage status notifications do not trigger repeated adapter data refreshes", async () => {
  const f = fixture();
  await f.primary.set(a);
  const adapter = f.reopen();
  await adapter.getAll();
  f.controls.primaryRead = true;
  let refreshes = 0;
  const unsubscribe = adapter.subscribe(() => {
    refreshes += 1;
  });
  await adapter.getAll();
  const initial = refreshes;
  for (let index = 0; index < 10; index += 1) await adapter.getAll();
  assert.equal(refreshes, initial);
  unsubscribe();
});

test("standalone recovery status loads external journal changes without replaying them", async () => {
  const f = fixture();
  let state: FallbackRecoveryJournalState<Meta> | undefined;
  const listeners = new Set<() => void>();
  const journal: FallbackRecoveryJournal<Meta> = {
    read: async () => state,
    write: async (next) => {
      state = next;
    },
    runExclusive: (operation) => operation(),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
  const first = new FallbackStorageAdapter({ fallback: f.fallback, recoveryJournal: journal });
  const second = new FallbackStorageAdapter({ primary: f.primary, fallback: f.fallback, recoveryJournal: journal });
  let notify: () => void = () => undefined;
  const published = new Promise<void>((resolve) => {
    notify = resolve;
  });
  const unsubscribe = second.recovery?.subscribe(notify);
  await first.set(a);
  for (const listener of listeners) listener();
  await published;
  assert.equal(second.recovery?.getState().pendingOperations, 1);
  assert.equal(second.recovery?.getState().source, "fallback");
  assert.deepEqual(await f.primary.getAll(), []);
  assert.equal(state?.operations.length, 1);
  unsubscribe?.();
  assert.equal(listeners.size, 0);
});

test("factory journal namespaces distinguish colliding legacy scope names and backend tuples", async () => {
  const f = fixture();
  const contexts: Array<{ storageKey: string; lockKey: string }> = [];
  const createRecoveryJournal = (context: { storageKey: string; lockKey: string }) => {
    contexts.push(context);
    return new LocalStorageRecoveryJournal<Meta>(context.storageKey, f.storage, context.lockKey);
  };
  const alice = createBrowserStorageAdapter<Meta>({
    key: "collision",
    storage: f.storage,
    scope: { userId: "_" },
    createRecoveryJournal,
  });
  const tenant = createBrowserStorageAdapter<Meta>({
    key: "collision",
    storage: f.storage,
    scope: { tenantId: "_" },
    createRecoveryJournal,
  });
  await alice.set(a);
  await tenant.set(b);
  assert.notEqual(contexts[0]?.storageKey, contexts[1]?.storageKey);
  assert.equal(contexts[0]?.lockKey, contexts[1]?.lockKey);
  assert.deepEqual(await alice.getAll(), [{ ...a, scope: { userId: "_" } }]);
  assert.deepEqual(await tenant.getAll(), [{ ...b, scope: { tenantId: "_" } }]);
  createBrowserStorageAdapter<Meta>({
    key: "backend",
    storage: f.storage,
    databaseName: "a:b",
    storeName: "c",
    createRecoveryJournal,
  });
  createBrowserStorageAdapter<Meta>({
    key: "backend",
    storage: f.storage,
    databaseName: "a",
    storeName: "b:c",
    createRecoveryJournal,
  });
  assert.notEqual(contexts[2]?.storageKey, contexts[3]?.storageKey);
  assert.notEqual(contexts[2]?.lockKey, contexts[3]?.lockKey);
});

test("scoped checkpoints, previews and repair backups never include another scope", async () => {
  const f = fixture();
  const alice = { userId: "alice" };
  const bob = { userId: "bob" };
  await f.primary.setMany([
    { ...a, scope: alice },
    { ...a, scope: bob },
  ]);
  await f.fallback.set({ ...b, scope: alice });
  const adapter = new FallbackStorageAdapter({
    primary: f.faulted,
    fallback: f.fallback,
    scope: alice,
    recoveryJournal: f.journal,
  });
  await adapter.getAll();
  const saved = await f.journal.read();
  assert.equal(saved?.version, 2);
  if (saved?.version !== 2) throw new Error("Expected v2");
  assert.deepEqual(saved.snapshot?.items, [{ ...a, scope: alice }]);
  const preview = await adapter.recovery?.inspect?.();
  assert.ok(preview);
  assert.ok(preview.sources.every((source) => source.snapshot.items.every((item) => item.scope?.userId === "alice")));
  assert.ok(preview.backups.every((backup) => backup.items.every((item) => item.scope?.userId === "alice")));
  const row = preview.rows.find((entry) => entry.id === "a");
  assert.ok(row);
  const selections = { [row.key]: "__remove__" };
  assert.equal((await adapter.recovery?.apply?.({ token: preview.token, selections }))?.status, "applied");
  assert.deepEqual(await f.primary.getAll(), [
    { ...a, scope: bob },
    { ...b, scope: alice },
  ]);
});
