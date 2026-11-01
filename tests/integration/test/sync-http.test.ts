import assert from "node:assert/strict";
import { type TestContext, test } from "node:test";
import { createAuthenticatedSyncKit, isKeepSyncAuthError, type SyncScope } from "@keepkit/core/core";
import { LocalStorageAdapter, LocalStorageSyncQueueAdapter } from "@keepkit/core/storage";
import {
  type ArticleMeta,
  article,
  createClock,
  createDevice,
  type Device,
  type DeviceOptions,
  editArticle,
  ITEMS_KEY,
  QUEUE_KEY,
  summarize,
  waitForSyncState,
} from "./support/devices.ts";
import {
  createAuthenticatedTransport,
  createKeepApiClient,
  createRemoteSyncDriver,
  KeepApiError,
} from "./support/http-transport.ts";
import {
  type KeepApiAccount,
  type KeepApiRoute,
  type KeepApiServer,
  startKeepApiServer,
} from "./support/keep-api-server.ts";
import { createMemoryStorage } from "./support/memory-storage.ts";

const ALICE: KeepApiAccount = { tenantId: "acme", userId: "alice" };
const BOB: KeepApiAccount = { tenantId: "acme", userId: "bob" };

async function startScenario(t: TestContext) {
  const server = await startKeepApiServer();
  const devices: Device[] = [];
  t.after(async () => {
    for (const { adapter } of devices) adapter.dispose();
    await server.close();
  });
  const token = server.issueToken(ALICE);
  const remote = createRemoteSyncDriver(createKeepApiClient<ArticleMeta>(server.url), () => token);
  const device = (clientId: string, options: Omit<DeviceOptions, "clientId" | "remote"> = {}) => {
    const created = createDevice({ clientId, remote, ...options });
    devices.push(created);
    return created;
  };
  return { server, token, device };
}

function requestsFor(server: KeepApiServer, route: KeepApiRoute) {
  return server.requests.filter((request) => request.route === route);
}

function statusOf(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("status" in error)) return undefined;
  return typeof error.status === "number" ? error.status : undefined;
}

/** Leaves the laptop holding an unsynced edit based on a revision that the phone already replaced. */
async function createRevisionConflict(t: TestContext) {
  const scenario = await startScenario(t);
  const laptop = scenario.device("laptop");
  const phone = scenario.device("phone");
  await laptop.adapter.set(article("article-1", "Draft", 1_000));
  await laptop.adapter.flushSync();
  await phone.adapter.flushSync();
  await editArticle(phone.adapter, "article-1", "Phone edit", 2_000);
  await phone.adapter.flushSync();
  await editArticle(laptop.adapter, "article-1", "Laptop edit", 3_000);
  await laptop.adapter.flushSync();
  return { ...scenario, laptop, phone };
}

test("replicates saves, edits, and removals between devices through the HTTP API", async (t) => {
  const { server, token, device } = await startScenario(t);
  const laptop = device("laptop");
  const phone = device("phone");

  await laptop.adapter.set(article("article-1", "Draft", 1_000));
  assert.equal(laptop.adapter.getSyncState().status, "pending");
  assert.deepEqual(server.items(ALICE), [], "writes are queued locally until the host flushes");

  await laptop.adapter.flushSync();
  assert.equal(laptop.adapter.getSyncState().status, "synced");
  assert.equal(laptop.adapter.getSyncState().pendingCount, 0);
  assert.deepEqual(summarize(server.items(ALICE)), [["article-1", "Draft", "rev-1"]]);
  assert.deepEqual(summarize(await laptop.adapter.getAll()), [["article-1", "Draft", "rev-1"]]);

  await phone.adapter.flushSync();
  assert.deepEqual(summarize(await phone.adapter.getAll()), [["article-1", "Draft", "rev-1"]]);

  await editArticle(phone.adapter, "article-1", "Final", 2_000);
  await phone.adapter.flushSync();
  assert.equal(requestsFor(server, "items:push").at(-1)?.operation?.baseRevision, "rev-1");
  assert.deepEqual(summarize(server.items(ALICE)), [["article-1", "Final", "rev-2"]]);

  await laptop.adapter.flushSync();
  assert.deepEqual(summarize(await laptop.adapter.getAll()), [["article-1", "Final", "rev-2"]]);

  await laptop.adapter.remove("article-1");
  await laptop.adapter.flushSync();
  assert.deepEqual(server.items(ALICE), []);
  assert.deepEqual(await laptop.adapter.getAll(), []);

  assert.ok(server.requests.length > 0);
  for (const request of server.requests) {
    assert.equal(request.token, token, `${request.route} must carry the bearer token`);
    assert.equal(request.outcome, "ok", `${request.route} must succeed`);
  }
});

test("retries transient server errors with the same operation ID", async (t) => {
  const { server, device } = await startScenario(t);
  const laptop = device("laptop");
  server.failNext("items:push", { status: 503 }, 2);

  await laptop.adapter.set(article("article-1", "Draft", 1_000));
  await laptop.adapter.flushSync();

  const pushes = requestsFor(server, "items:push");
  assert.deepEqual(
    pushes.map((request) => request.outcome),
    ["injected-status", "injected-status", "ok"],
  );
  assert.deepEqual(
    pushes.map((request) => request.operation?.attempts),
    [0, 1, 2],
  );
  assert.equal(new Set(pushes.map((request) => request.operation?.operationId)).size, 1);
  assert.equal(laptop.adapter.getSyncState().status, "synced");
  assert.deepEqual(summarize(server.items(ALICE)), [["article-1", "Draft", "rev-1"]]);
});

test("keeps the durable queue and surfaces the HTTP error when retries are exhausted", async (t) => {
  const { server, device } = await startScenario(t);
  const laptop = device("laptop", { maxRetries: 1 });
  server.failNext("items:push", { status: 503 }, 2);

  await laptop.adapter.set(article("article-1", "Draft", 1_000));
  await laptop.adapter.flushSync();

  const failed = laptop.adapter.getSyncState();
  assert.equal(failed.status, "error");
  assert.equal(failed.pendingCount, 1);
  assert.ok(failed.error instanceof KeepApiError);
  assert.equal(failed.error.status, 503);
  assert.deepEqual(server.items(ALICE), []);
  const queue = new LocalStorageSyncQueueAdapter<ArticleMeta>({ key: QUEUE_KEY, storage: laptop.storage });
  assert.deepEqual(
    (await queue.getAll()).map(({ type, id }) => [type, id]),
    [["upsert", "article-1"]],
  );

  await laptop.adapter.retrySync();
  assert.equal(laptop.adapter.getSyncState().status, "synced");
  assert.deepEqual(summarize(server.items(ALICE)), [["article-1", "Draft", "rev-1"]]);
  assert.deepEqual(await queue.getAll(), []);
});

test("replays a lost acknowledgement idempotently instead of reporting a conflict", async (t) => {
  const { server, device } = await startScenario(t);
  const laptop = device("laptop");
  server.failNext("items:push", "lose-acknowledgement");

  await laptop.adapter.set(article("article-1", "Draft", 1_000));
  await laptop.adapter.flushSync();

  const pushes = requestsFor(server, "items:push");
  assert.deepEqual(
    pushes.map((request) => request.outcome),
    ["acknowledgement-lost", "replayed"],
  );
  assert.equal(new Set(pushes.map((request) => request.operation?.operationId)).size, 1);
  const state = laptop.adapter.getSyncState();
  assert.equal(state.status, "synced");
  assert.deepEqual(state.conflictIds, []);
  assert.deepEqual(summarize(server.items(ALICE)), [["article-1", "Draft", "rev-1"]]);
  assert.deepEqual(summarize(await laptop.adapter.getAll()), [["article-1", "Draft", "rev-1"]]);
});

test("replays offline writes in order after the application restarts", async (t) => {
  const { server, device } = await startScenario(t);
  const laptop = device("laptop");
  server.setOffline(true);

  await laptop.adapter.set(article("a", "A v1", 1_000));
  await laptop.adapter.set(article("b", "B", 1_001));
  await laptop.adapter.set(article("a", "A v2", 1_002));
  await laptop.adapter.flushSync();
  assert.equal(laptop.adapter.getSyncState().status, "error");
  assert.equal(laptop.adapter.getSyncState().pendingCount, 2, "the newer write replaces the queued one");
  assert.deepEqual(requestsFor(server, "items:push"), [], "a failed pull stops the flush before any push");
  laptop.adapter.dispose();

  server.setOffline(false);
  const restarted = device("laptop", { storage: laptop.storage });
  await waitForSyncState(restarted.adapter, (state) => state.status === "synced");

  assert.deepEqual(
    requestsFor(server, "items:push").map((request) => [request.operation?.id, request.outcome]),
    [
      ["b", "ok"],
      ["a", "ok"],
    ],
  );
  assert.deepEqual(summarize(server.items(ALICE)), [
    ["a", "A v2", "rev-2"],
    ["b", "B", "rev-1"],
  ]);
  assert.deepEqual(summarize(await restarted.adapter.getAll()), [
    ["a", "A v2", "rev-2"],
    ["b", "B", "rev-1"],
  ]);
});

test("preserves offline writes from multiple tabs sharing a localStorage queue", async (t) => {
  const { server, device } = await startScenario(t);
  const storage = createMemoryStorage();
  const firstTab = device("first-tab", { storage });
  const secondTab = device("second-tab", { storage });
  server.setOffline(true);

  await firstTab.adapter.set(article("first-item", "First tab", 1_000));
  await secondTab.adapter.set(article("second-item", "Second tab", 2_000));
  await firstTab.adapter.flushSync();
  await secondTab.adapter.flushSync();
  firstTab.adapter.dispose();
  secondTab.adapter.dispose();

  server.setOffline(false);
  const restarted = device("restarted", { storage });
  await restarted.adapter.flushSync();

  assert.deepEqual(summarize(server.items(ALICE)), [
    ["first-item", "First tab", "rev-1"],
    ["second-item", "Second tab", "rev-2"],
  ]);
  assert.deepEqual(
    requestsFor(server, "items:push")
      .slice(-2)
      .map((request) => request.operation?.id)
      .sort(),
    ["first-item", "second-item"],
    "restarting with a shared queue must replay every tab's pending operation",
  );
  assert.equal(restarted.adapter.getSyncState().pendingCount, 0);
});

test("retains a permanently rejected operation while syncing later independent writes", async (t) => {
  const { server, device } = await startScenario(t);
  const laptop = device("laptop");
  const phone = device("phone");
  await laptop.adapter.set(article("article-1", "Draft", 1_000));
  await laptop.adapter.setCollection?.({ id: "reading", name: "Reading" });
  await laptop.adapter.flushSync();
  await phone.adapter.flushSync();

  await phone.adapter.removeCollection?.("reading");
  await phone.adapter.flushSync();
  await laptop.adapter.setCollectionMembership?.({ collectionId: "reading", itemId: "article-1", order: 0 });
  await editArticle(laptop.adapter, "article-1", "Laptop follow-up", 2_000);
  await laptop.adapter.set(article("article-2", "Independent write", 3_000));
  await laptop.adapter.flushSync();

  const state = laptop.adapter.getSyncState();
  const [rejected] = state.rejectedOperations ?? [];
  assert.equal(state.status, "error");
  assert.equal(state.pendingCount, 2, "the failed operation and writes that depend on it remain queued");
  assert.equal(rejected?.operation.entity, "membership");
  assert.equal(rejected?.operation.entity === "membership" ? rejected.operation.collectionId : undefined, "reading");
  assert.equal(rejected?.operation.entity === "membership" ? rejected.operation.itemId : undefined, "article-1");
  assert.equal(statusOf(rejected?.error), 409);
  assert.equal(requestsFor(server, "memberships:push").length, 1, "permanent client errors are not retried");
  assert.deepEqual(summarize(server.items(ALICE)), [
    ["article-1", "Draft", "rev-1"],
    ["article-2", "Independent write", "rev-3"],
  ]);
  assert.equal(requestsFor(server, "memberships:push").at(-1)?.outcome, "rejected");

  const storage = laptop.storage;
  laptop.adapter.dispose();
  const restarted = device("restarted", { storage });
  await restarted.adapter.flushSync();
  const restartedState = restarted.adapter.getSyncState();
  const [restartedRejection] = restartedState.rejectedOperations ?? [];
  assert.equal(restartedState.status, "error");
  assert.equal(restartedState.pendingCount, 2);
  assert.equal(restartedRejection?.operation.operationId, rejected?.operation.operationId);

  assert.ok(restarted.adapter.resolveRejectedSyncOperation);
  const operationId = rejected?.operation.operationId;
  assert.ok(operationId);
  await restarted.adapter.resolveRejectedSyncOperation(operationId, "discard");
  assert.equal(restarted.adapter.getSyncState().status, "synced");
  assert.equal(restarted.adapter.getSyncState().pendingCount, 0);
  assert.deepEqual(restarted.adapter.getSyncState().rejectedOperations, undefined);
  assert.deepEqual(summarize(server.items(ALICE)), [
    ["article-1", "Laptop follow-up", "rev-4"],
    ["article-2", "Independent write", "rev-3"],
  ]);
});

test("surfaces revision conflicts and pushes the local version when the host keeps it", async (t) => {
  const { server, laptop, phone } = await createRevisionConflict(t);

  const state = laptop.adapter.getSyncState();
  assert.equal(state.status, "conflict");
  assert.deepEqual(state.conflictIds, ["article-1"]);
  const [conflict] = state.conflicts ?? [];
  assert.equal(conflict?.revision, "rev-2");
  assert.equal(conflict?.remote.meta.title, "Phone edit");
  assert.deepEqual(summarize(server.items(ALICE)), [["article-1", "Phone edit", "rev-2"]]);

  await laptop.adapter.resolveSyncConflict("article-1", "local");
  assert.equal(laptop.adapter.getSyncState().status, "synced");
  assert.deepEqual(laptop.adapter.getSyncState().conflictIds, []);
  const resolution = requestsFor(server, "items:push").at(-1);
  assert.equal(resolution?.operation?.baseRevision, "rev-2");
  assert.equal(resolution?.outcome, "ok");
  assert.deepEqual(summarize(server.items(ALICE)), [["article-1", "Laptop edit", "rev-3"]]);

  await phone.adapter.flushSync();
  assert.deepEqual(summarize(await phone.adapter.getAll()), [["article-1", "Laptop edit", "rev-3"]]);
});

test("adopts the server version without another write when the host chooses remote", async (t) => {
  const { server, laptop } = await createRevisionConflict(t);
  const pushCount = requestsFor(server, "items:push").length;

  await laptop.adapter.resolveSyncConflict("article-1", "remote");
  const state = laptop.adapter.getSyncState();
  assert.equal(state.status, "synced");
  assert.equal(state.pendingCount, 0);
  assert.deepEqual(state.conflictIds, []);
  assert.deepEqual(summarize(await laptop.adapter.getAll()), [["article-1", "Phone edit", "rev-2"]]);

  await laptop.adapter.flushSync();
  assert.equal(requestsFor(server, "items:push").length, pushCount);
  assert.deepEqual(summarize(server.items(ALICE)), [["article-1", "Phone edit", "rev-2"]]);
});

test("devices converge on the server revision when the kept local edit has an older timestamp", async (t) => {
  const { server, device } = await startScenario(t);
  const laptop = device("laptop");
  const phone = device("phone");
  await laptop.adapter.set(article("article-1", "Draft", 1_000));
  await laptop.adapter.flushSync();
  await phone.adapter.flushSync();

  // The laptop edits first while offline; the phone edits later but reaches the server first.
  await editArticle(laptop.adapter, "article-1", "Laptop offline edit", 2_000);
  await editArticle(phone.adapter, "article-1", "Phone edit", 3_000);
  await phone.adapter.flushSync();
  await laptop.adapter.flushSync();
  assert.equal(laptop.adapter.getSyncState().status, "conflict");
  await laptop.adapter.resolveSyncConflict("article-1", "local");
  assert.deepEqual(summarize(server.items(ALICE)), [["article-1", "Laptop offline edit", "rev-3"]]);

  await phone.adapter.flushSync();
  assert.deepEqual(summarize(await phone.adapter.getAll()), [["article-1", "Laptop offline edit", "rev-3"]]);

  await editArticle(phone.adapter, "article-1", "Phone follow-up", 4_000);
  await phone.adapter.flushSync();
  assert.equal(phone.adapter.getSyncState().status, "synced", "the next edit is based on the current revision");
  assert.equal(requestsFor(server, "items:push").at(-1)?.operation?.baseRevision, "rev-3");
  assert.deepEqual(summarize(server.items(ALICE)), [["article-1", "Phone follow-up", "rev-4"]]);
});

test("snapshot item pulls propagate removals instead of resurrecting removed items", async (t) => {
  const { server, device } = await startScenario(t);
  const laptop = device("laptop", { itemPullMode: "snapshot" });
  const phone = device("phone", { itemPullMode: "snapshot" });
  const tablet = device("tablet");
  await laptop.adapter.set(article("article-1", "Draft", 1_000));
  await laptop.adapter.set(article("article-2", "Kept", 1_000));
  await laptop.adapter.flushSync();
  await phone.adapter.flushSync();
  await tablet.adapter.flushSync();
  assert.equal((await phone.adapter.getAll()).length, 2);

  await laptop.adapter.remove("article-1");
  await laptop.adapter.flushSync();
  assert.deepEqual(summarize(server.items(ALICE)), [["article-2", "Kept", "rev-2"]]);

  await phone.adapter.flushSync();
  assert.deepEqual(summarize(await phone.adapter.getAll()), [["article-2", "Kept", "rev-2"]]);
  await tablet.adapter.flushSync();
  assert.deepEqual(
    summarize(await tablet.adapter.getAll()),
    [
      ["article-1", "Draft", "rev-1"],
      ["article-2", "Kept", "rev-2"],
    ],
    "the default merge mode treats pulls as partial results",
  );

  await editArticle(phone.adapter, "article-2", "Phone edit", 2_000);
  await phone.adapter.flushSync();
  await laptop.adapter.flushSync();
  assert.deepEqual(summarize(server.items(ALICE)), [["article-2", "Phone edit", "rev-3"]]);
  assert.deepEqual(summarize(await laptop.adapter.getAll()), [["article-2", "Phone edit", "rev-3"]]);
});

test("replicates collections and memberships, including cascading removals", async (t) => {
  const { server, device } = await startScenario(t);
  const laptop = device("laptop");
  const phone = device("phone");
  assert.ok(laptop.adapter.setCollection && laptop.adapter.setCollectionMembership && laptop.adapter.removeCollection);
  assert.ok(phone.adapter.getCollections && phone.adapter.getCollectionMemberships);

  await laptop.adapter.set(article("article-1", "Draft", 1_000));
  await laptop.adapter.setCollection({ id: "reading", name: "Reading list" });
  await laptop.adapter.setCollectionMembership({ collectionId: "reading", itemId: "article-1", order: 0 });
  await laptop.adapter.flushSync();

  assert.equal(laptop.adapter.getSyncState().status, "synced");
  assert.deepEqual(
    server.collections(ALICE).map(({ id, name }) => [id, name]),
    [["reading", "Reading list"]],
  );
  assert.deepEqual(
    server.memberships(ALICE).map(({ collectionId, itemId, order }) => [collectionId, itemId, order]),
    [["reading", "article-1", 0]],
  );

  await phone.adapter.flushSync();
  assert.deepEqual(
    (await phone.adapter.getCollections()).map(({ id, name }) => [id, name]),
    [["reading", "Reading list"]],
  );
  assert.deepEqual(
    (await phone.adapter.getCollectionMemberships()).map(({ collectionId, itemId }) => [collectionId, itemId]),
    [["reading", "article-1"]],
  );

  await laptop.adapter.removeCollection("reading");
  await laptop.adapter.flushSync();
  assert.deepEqual(
    requestsFor(server, "memberships:push").map((request) => request.operation?.type),
    ["upsert", "remove"],
    "membership removals are pushed before the collection removal",
  );
  assert.deepEqual(server.collections(ALICE), []);
  assert.deepEqual(server.memberships(ALICE), []);

  await phone.adapter.flushSync();
  assert.deepEqual(await phone.adapter.getCollections(), []);
  assert.deepEqual(await phone.adapter.getCollectionMemberships(), []);
  assert.ok(server.requests.every((request) => request.outcome === "ok"));
});

test("authenticated kit asks the host to re-authenticate on 401 and resumes with a fresh token", async (t) => {
  const server = await startKeepApiServer();
  let token = server.issueToken(ALICE);
  const authErrors: { status: number; scope?: SyncScope }[] = [];
  let reauthenticationCount = 0;
  const storage = createMemoryStorage();
  const kit = createAuthenticatedSyncKit<ArticleMeta>({
    local: new LocalStorageAdapter<ArticleMeta>({ key: ITEMS_KEY, storage }),
    queue: new LocalStorageSyncQueueAdapter<ArticleMeta>({ key: QUEUE_KEY, storage }),
    scope: ALICE,
    clientId: "browser",
    now: createClock(),
    getAuthToken: async () => token,
    transport: createAuthenticatedTransport(createKeepApiClient<ArticleMeta>(server.url)),
    onAuthError: ({ status, scope }) => {
      authErrors.push({ status, scope });
    },
    onReauthenticate: () => {
      reauthenticationCount += 1;
    },
  });
  t.after(async () => {
    kit.dispose();
    await server.close();
  });

  await kit.storage.set(article("article-1", "Draft", 1_000));
  server.revokeToken(token);
  await kit.storage.flushSync();

  const failed = kit.storage.getSyncState();
  assert.equal(failed.status, "error");
  assert.ok(isKeepSyncAuthError(failed.error));
  assert.equal(failed.error.status, 401);
  assert.deepEqual(authErrors, [{ status: 401, scope: ALICE }]);
  assert.equal(reauthenticationCount, 1);
  assert.deepEqual(
    server.requests.map(({ route, outcome }) => [route, outcome]),
    [["items:pull", "unauthorized"]],
    "an expired session must not be retried or fall through to pushes",
  );

  token = server.issueToken(ALICE);
  const requestsBeforeRetry = server.requests.length;
  assert.ok(kit.storage.retrySync, "the authenticated kit exposes retrySync");
  await kit.storage.retrySync();
  assert.equal(kit.storage.getSyncState().status, "synced");
  assert.deepEqual(summarize(server.items(ALICE)), [["article-1", "Draft", "rev-1"]]);
  for (const request of server.requests.slice(requestsBeforeRetry)) {
    assert.equal(request.token, token);
    assert.deepEqual(request.operation?.scope ?? ALICE, ALICE);
  }
});

test("authenticated kit does not retry a forbidden push", async (t) => {
  const server = await startKeepApiServer();
  const token = server.issueToken(ALICE);
  const authStatuses: number[] = [];
  const storage = createMemoryStorage();
  const kit = createAuthenticatedSyncKit<ArticleMeta>({
    local: new LocalStorageAdapter<ArticleMeta>({ key: ITEMS_KEY, storage }),
    queue: new LocalStorageSyncQueueAdapter<ArticleMeta>({ key: QUEUE_KEY, storage }),
    scope: ALICE,
    clientId: "browser",
    now: createClock(),
    maxRetries: 3,
    getAuthToken: async () => token,
    transport: createAuthenticatedTransport(createKeepApiClient<ArticleMeta>(server.url)),
    onAuthError: ({ status }) => {
      authStatuses.push(status);
    },
  });
  t.after(async () => {
    kit.dispose();
    await server.close();
  });
  server.failNext("items:push", { status: 403 });

  await kit.storage.set(article("article-1", "Draft", 1_000));
  await kit.storage.flushSync();

  const state = kit.storage.getSyncState();
  assert.equal(state.status, "error");
  assert.ok(isKeepSyncAuthError(state.error));
  assert.equal(state.error.status, 403);
  assert.deepEqual(authStatuses, [403]);
  assert.deepEqual(
    requestsFor(server, "items:push").map((request) => [request.outcome, request.operation?.attempts]),
    [["injected-status", 0]],
  );
  assert.equal(state.pendingCount, 1, "the operation stays queued for after re-authentication");
});

test("authenticated kit never sends one account's queued writes with another account's token", async (t) => {
  const server = await startKeepApiServer();
  const tokens = new Map([
    ["alice", server.issueToken(ALICE)],
    ["bob", server.issueToken(BOB)],
  ]);
  const accounts = new Map([
    ["alice", ALICE],
    ["bob", BOB],
  ]);
  let active = "alice";
  const storage = createMemoryStorage();
  const kit = createAuthenticatedSyncKit<ArticleMeta>({
    local: new LocalStorageAdapter<ArticleMeta>({ key: ITEMS_KEY, storage }),
    queue: new LocalStorageSyncQueueAdapter<ArticleMeta>({ key: QUEUE_KEY, storage }),
    getScope: () => accounts.get(active),
    getAuthToken: async () => tokens.get(active) ?? null,
    clientId: "shared-browser",
    now: createClock(),
    transport: createAuthenticatedTransport(createKeepApiClient<ArticleMeta>(server.url)),
  });
  t.after(async () => {
    kit.dispose();
    await server.close();
  });

  server.setOffline(true);
  await kit.storage.set(article("alice-note", "Alice offline note", 1_000));
  await kit.storage.flushSync();
  assert.equal(kit.storage.getSyncState().pendingCount, 1);
  server.setOffline(false);

  active = "bob";
  await kit.storage.set(article("bob-note", "Bob note", 2_000));
  await kit.storage.flushSync();
  assert.equal(kit.storage.getSyncState().status, "synced");
  assert.deepEqual(summarize(await kit.storage.getAll()), [["bob-note", "Bob note", "rev-1"]]);
  assert.deepEqual(summarize(server.items(BOB)), [["bob-note", "Bob note", "rev-1"]]);
  assert.deepEqual(server.items(ALICE), [], "Alice's queued write must wait for Alice's session");

  active = "alice";
  await kit.storage.flushSync();
  await waitForSyncState(kit.storage, (state) => state.status === "synced" && state.pendingCount === 0);
  assert.deepEqual(summarize(await kit.storage.getAll()), [["alice-note", "Alice offline note", "rev-2"]]);
  assert.deepEqual(summarize(server.items(ALICE)), [["alice-note", "Alice offline note", "rev-2"]]);
  assert.deepEqual(summarize(server.items(BOB)), [["bob-note", "Bob note", "rev-1"]]);

  for (const request of requestsFor(server, "items:push")) {
    const account = request.operation?.scope?.userId;
    assert.equal(request.token, account ? tokens.get(account) : undefined, "pushes use the owning account's token");
    assert.equal(request.outcome, "ok");
  }
});

test("authenticated kit restarted under another account waits for the scope before syncing", async (t) => {
  const server = await startKeepApiServer();
  const tokens = new Map([
    ["alice", server.issueToken(ALICE)],
    ["bob", server.issueToken(BOB)],
  ]);
  const accounts = new Map([
    ["alice", ALICE],
    ["bob", BOB],
  ]);
  let active = "alice";
  let profileLoaded = Promise.resolve();
  let scopeKnown = true;
  let tokenRequestsBeforeScope = 0;
  const storage = createMemoryStorage();
  const transport = createAuthenticatedTransport(createKeepApiClient<ArticleMeta>(server.url));
  const kits: { dispose(): void }[] = [];
  const startKit = () => {
    const kit = createAuthenticatedSyncKit<ArticleMeta>({
      local: new LocalStorageAdapter<ArticleMeta>({ key: ITEMS_KEY, storage }),
      queue: new LocalStorageSyncQueueAdapter<ArticleMeta>({ key: QUEUE_KEY, storage }),
      getScope: async () => {
        await profileLoaded;
        scopeKnown = true;
        return accounts.get(active);
      },
      getAuthToken: async () => {
        if (!scopeKnown) tokenRequestsBeforeScope += 1;
        return tokens.get(active) ?? null;
      },
      clientId: "shared-browser",
      now: createClock(),
      transport,
    });
    kits.push(kit);
    return kit;
  };
  t.after(async () => {
    for (const kit of kits) kit.dispose();
    await server.close();
  });

  const beforeRestart = startKit();
  server.setOffline(true);
  await beforeRestart.storage.set(article("alice-note", "Alice offline note", 1_000));
  await beforeRestart.storage.flushSync();
  beforeRestart.dispose();
  server.setOffline(false);
  const requestsBeforeRestart = server.requests.length;

  // The browser restarts with Bob's session cookie while the profile that identifies the account is still loading.
  active = "bob";
  scopeKnown = false;
  let finishProfileLoad = () => {};
  profileLoaded = new Promise((resolve) => {
    finishProfileLoad = resolve;
  });
  const afterRestart = startKit();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(tokenRequestsBeforeScope, 0, "no credentials may be used before the account is known");
  assert.equal(server.requests.length, requestsBeforeRestart);

  finishProfileLoad();
  await afterRestart.storage.set(article("bob-note", "Bob note", 2_000));
  await afterRestart.storage.flushSync();
  assert.deepEqual(summarize(server.items(BOB)), [["bob-note", "Bob note", "rev-1"]]);
  assert.deepEqual(server.items(ALICE), [], "Alice's queued write must wait for Alice's session");

  active = "alice";
  await afterRestart.storage.flushSync();
  await waitForSyncState(afterRestart.storage, (state) => state.status === "synced" && state.pendingCount === 0);
  assert.deepEqual(summarize(server.items(ALICE)), [["alice-note", "Alice offline note", "rev-2"]]);

  for (const request of server.requests.slice(requestsBeforeRestart)) {
    const account = request.operation?.scope?.userId;
    if (account) assert.equal(request.token, tokens.get(account), "pushes use the owning account's token");
    assert.equal(request.outcome, "ok");
  }
});

test("authenticated kit stores collection revisions returned by the server", async (t) => {
  const server = await startKeepApiServer();
  const token = server.issueToken(ALICE);
  const storage = createMemoryStorage();
  const kit = createAuthenticatedSyncKit<ArticleMeta>({
    local: new LocalStorageAdapter<ArticleMeta>({ key: ITEMS_KEY, storage }),
    queue: new LocalStorageSyncQueueAdapter<ArticleMeta>({ key: QUEUE_KEY, storage }),
    scope: ALICE,
    clientId: "browser",
    now: createClock(),
    getAuthToken: async () => token,
    transport: createAuthenticatedTransport(createKeepApiClient<ArticleMeta>(server.url)),
  });
  t.after(async () => {
    kit.dispose();
    await server.close();
  });
  assert.ok(kit.storage.setCollection && kit.storage.getCollections);

  await kit.storage.setCollection({ id: "reading", name: "Reading list" });
  await kit.storage.flushSync();
  const firstRevision = server.collections(ALICE)[0]?.revision;
  assert.ok(firstRevision);
  assert.deepEqual(
    (await kit.storage.getCollections()).map(({ id, revision }) => [id, revision]),
    [["reading", firstRevision]],
  );

  await kit.storage.setCollection({ id: "reading", name: "Renamed" });
  await kit.storage.flushSync();
  assert.equal(requestsFor(server, "collections:push").at(-1)?.operation?.baseRevision, firstRevision);
  const [renamed] = server.collections(ALICE);
  assert.equal(renamed?.name, "Renamed");
  assert.deepEqual(
    (await kit.storage.getCollections()).map(({ name, revision }) => [name, revision]),
    [["Renamed", renamed?.revision]],
  );
});

test("authenticated kit hides and preserves account data while signed out on a shared browser", async (t) => {
  const server = await startKeepApiServer();
  const token = server.issueToken(ALICE);
  let signedIn = true;
  const storage = createMemoryStorage();
  const kit = createAuthenticatedSyncKit<ArticleMeta>({
    local: new LocalStorageAdapter<ArticleMeta>({ key: ITEMS_KEY, storage }),
    queue: new LocalStorageSyncQueueAdapter<ArticleMeta>({ key: QUEUE_KEY, storage }),
    getScope: () => (signedIn ? ALICE : undefined),
    getAuthToken: async () => (signedIn ? token : null),
    clientId: "shared-browser",
    now: createClock(),
    transport: createAuthenticatedTransport(createKeepApiClient<ArticleMeta>(server.url)),
  });
  t.after(async () => {
    kit.dispose();
    await server.close();
  });

  await kit.storage.set(article("alice-note", "Alice note", 1_000));
  await kit.storage.flushSync();
  assert.deepEqual(summarize(server.items(ALICE)), [["alice-note", "Alice note", "rev-1"]]);

  signedIn = false;
  assert.deepEqual(await kit.storage.getAll(), [], "a signed-out session must not show account data");
  await kit.storage.set(article("guest-note", "Guest note", 2_000));
  assert.deepEqual(summarize(await kit.storage.getAll()), [["guest-note", "Guest note", undefined]]);
  await kit.storage.clear();
  assert.deepEqual(await kit.storage.getAll(), []);

  signedIn = true;
  assert.deepEqual(summarize(await kit.storage.getAll()), [["alice-note", "Alice note", "rev-1"]]);
  await kit.storage.flushSync();
  assert.equal(kit.storage.getSyncState().status, "synced");
  assert.deepEqual(summarize(server.items(ALICE)), [["alice-note", "Alice note", "rev-1"]]);
  for (const request of requestsFor(server, "items:push")) {
    assert.deepEqual(request.operation?.scope, ALICE, "signed-out writes are never sent with Alice's token");
  }
});
