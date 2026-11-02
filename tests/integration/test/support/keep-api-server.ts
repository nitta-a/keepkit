import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type {
  KeepCollectionDefinition,
  KeepCollectionMembership,
  KeepCollectionSyncOperation,
  KeepItem,
  KeepMembershipSyncOperation,
  SyncOperation,
  SyncScope,
} from "@keepkit/core/core";

export type KeepApiAccount = { tenantId: string; userId: string };

export type KeepApiRoute =
  | "items:pull"
  | "items:push"
  | "collections:pull"
  | "collections:push"
  | "memberships:pull"
  | "memberships:push";

/** A failure injected before the server handles the next request on a route. */
export type KeepApiFault = { status: number } | "disconnect" | "lose-acknowledgement";

export type KeepApiOutcome =
  | "ok"
  | "replayed"
  | "conflict"
  | "rejected"
  | "unauthorized"
  | "forbidden"
  | "injected-status"
  | "disconnected"
  | "acknowledgement-lost"
  | "offline";

export type RecordedOperation = {
  operationId: string;
  type: "upsert" | "remove";
  id: string;
  attempts?: number;
  baseRevision?: string;
  scope?: SyncScope;
};

export type RecordedRequest = {
  route: KeepApiRoute;
  token?: string;
  operation?: RecordedOperation;
  status?: number;
  outcome: KeepApiOutcome;
};

export type KeepApiServer = {
  readonly url: string;
  readonly requests: readonly RecordedRequest[];
  issueToken(account: KeepApiAccount): string;
  revokeToken(token: string): void;
  failNext(route: KeepApiRoute, fault: KeepApiFault, times?: number): void;
  setOffline(offline: boolean): void;
  items(account: KeepApiAccount): KeepItem[];
  collections(account: KeepApiAccount): KeepCollectionDefinition[];
  memberships(account: KeepApiAccount): KeepCollectionMembership[];
  close(): Promise<void>;
};

type AccountData = {
  items: Map<string, KeepItem>;
  collections: Map<string, KeepCollectionDefinition>;
  memberships: Map<string, KeepCollectionMembership>;
  acknowledgements: Map<string, ApiResponse>;
};

type ApiResponse = { status: number; body?: unknown };

type ApiResult = ApiResponse & { outcome: KeepApiOutcome };

const routes: Record<string, KeepApiRoute> = {
  "GET /v1/items": "items:pull",
  "POST /v1/items/operations": "items:push",
  "GET /v1/collections": "collections:pull",
  "POST /v1/collections/operations": "collections:push",
  "GET /v1/memberships": "memberships:pull",
  "POST /v1/memberships/operations": "memberships:push",
};

/**
 * Starts an in-process reference implementation of a Keep sync API. It applies bearer-token
 * accounts, optimistic revisions, and idempotent operation IDs the way a production backend should,
 * and can inject network or HTTP failures for resilience tests.
 */
export async function startKeepApiServer(): Promise<KeepApiServer> {
  const tokens = new Map<string, KeepApiAccount>();
  const accounts = new Map<string, AccountData>();
  const faults = new Map<KeepApiRoute, KeepApiFault[]>();
  const requests: RecordedRequest[] = [];
  let offline = false;
  let revisionCounter = 0;
  let tokenCounter = 0;

  const getData = (account: KeepApiAccount): AccountData => {
    const key = `${account.tenantId}/${account.userId}`;
    const existing = accounts.get(key);
    if (existing) return existing;
    const created: AccountData = {
      items: new Map(),
      collections: new Map(),
      memberships: new Map(),
      acknowledgements: new Map(),
    };
    accounts.set(key, created);
    return created;
  };

  const nextRevision = () => {
    revisionCounter += 1;
    return `rev-${revisionCounter}`;
  };

  const applyItemOperation = (data: AccountData, operation: SyncOperation): ApiResult => {
    const current = data.items.get(operation.id);
    if (operation.type === "remove") {
      data.items.delete(operation.id);
      for (const [key, membership] of data.memberships) {
        if (membership.itemId === operation.id) data.memberships.delete(key);
      }
      return { status: 200, outcome: "ok", body: { type: "synced" } };
    }
    if (current && operation.baseRevision !== current.revision) {
      return {
        status: 200,
        outcome: "conflict",
        body: { type: "conflict", remote: current, revision: current.revision },
      };
    }
    if (!operation.item) return { status: 400, outcome: "rejected", body: { error: "missing_item" } };
    const revision = nextRevision();
    const item = { ...operation.item, revision };
    data.items.set(operation.id, item);
    return { status: 200, outcome: "ok", body: { type: "synced", item, revision } };
  };

  const applyCollectionOperation = (data: AccountData, operation: KeepCollectionSyncOperation): ApiResult => {
    if (operation.type === "remove") {
      data.collections.delete(operation.id);
      for (const [key, membership] of data.memberships) {
        if (membership.collectionId === operation.id) data.memberships.delete(key);
      }
      return { status: 200, outcome: "ok", body: { type: "synced", deleted: true } };
    }
    if (!operation.collection) return { status: 400, outcome: "rejected", body: { error: "missing_collection" } };
    const revision = nextRevision();
    const collection = { ...operation.collection, revision };
    data.collections.set(operation.id, collection);
    return { status: 200, outcome: "ok", body: { type: "synced", collection, revision } };
  };

  const applyMembershipOperation = (data: AccountData, operation: KeepMembershipSyncOperation): ApiResult => {
    const key = `${operation.collectionId}:${operation.itemId}`;
    if (operation.type === "remove") {
      data.memberships.delete(key);
      return { status: 204, outcome: "ok" };
    }
    const { membership } = operation;
    if (!membership) return { status: 400, outcome: "rejected", body: { error: "missing_membership" } };
    if (!data.items.has(membership.itemId) || !data.collections.has(membership.collectionId)) {
      return { status: 409, outcome: "rejected", body: { error: "unknown_item_or_collection" } };
    }
    data.memberships.set(key, membership);
    return { status: 204, outcome: "ok" };
  };

  const applyOperation = (route: KeepApiRoute, data: AccountData, body: Record<string, unknown>): ApiResult => {
    if (route === "items:push" && isItemOperation(body)) return applyItemOperation(data, body);
    if (route === "collections:push" && isCollectionOperation(body)) return applyCollectionOperation(data, body);
    if (route === "memberships:push" && isMembershipOperation(body)) return applyMembershipOperation(data, body);
    return { status: 400, outcome: "rejected", body: { error: "invalid_operation" } };
  };

  const readSnapshot = (route: KeepApiRoute, data: AccountData): ApiResult => {
    if (route === "items:pull") return { status: 200, outcome: "ok", body: { items: [...data.items.values()] } };
    if (route === "collections:pull") {
      return { status: 200, outcome: "ok", body: { collections: [...data.collections.values()] } };
    }
    return { status: 200, outcome: "ok", body: { memberships: [...data.memberships.values()] } };
  };

  const takeFault = (route: KeepApiRoute): KeepApiFault | undefined => faults.get(route)?.shift();

  const handle = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const route = routes[`${request.method} ${request.url}`];
    if (!route) {
      send(response, { status: 404, body: { error: "not_found" } });
      return;
    }
    const body = request.method === "POST" ? await readJson(request) : undefined;
    const token = parseBearerToken(request.headers.authorization);
    const operation = toRecordedOperation(body);
    const record = (outcome: KeepApiOutcome, status?: number) => {
      requests.push({
        route,
        ...(token ? { token } : {}),
        ...(operation ? { operation } : {}),
        ...(status ? { status } : {}),
        outcome,
      });
    };

    if (offline) {
      record("offline");
      request.socket.destroy();
      return;
    }
    const fault = takeFault(route);
    if (fault === "disconnect") {
      record("disconnected");
      request.socket.destroy();
      return;
    }
    if (typeof fault === "object") {
      record("injected-status", fault.status);
      send(response, { status: fault.status, body: { error: "injected_failure" } });
      return;
    }

    const account = token ? tokens.get(token) : undefined;
    if (!account) {
      record("unauthorized", 401);
      send(response, { status: 401, body: { error: "unauthorized" } });
      return;
    }
    if (operation?.scope && !isSameAccount(operation.scope, account)) {
      record("forbidden", 403);
      send(response, { status: 403, body: { error: "scope_mismatch" } });
      return;
    }

    const data = getData(account);
    if (request.method === "GET") {
      const result = readSnapshot(route, data);
      record(result.outcome, result.status);
      send(response, result);
      return;
    }
    if (!isRecord(body) || !operation) {
      record("rejected", 400);
      send(response, { status: 400, body: { error: "invalid_operation" } });
      return;
    }

    const acknowledged = data.acknowledgements.get(operation.operationId);
    if (acknowledged) {
      record("replayed", acknowledged.status);
      send(response, acknowledged);
      return;
    }
    const result = applyOperation(route, data, body);
    if (result.outcome === "ok") data.acknowledgements.set(operation.operationId, result);
    if (fault === "lose-acknowledgement") {
      record("acknowledgement-lost", result.status);
      request.socket.destroy();
      return;
    }
    record(result.outcome, result.status);
    send(response, result);
  };

  const server = createServer((request, response) => {
    handle(request, response).catch((error: unknown) => {
      if (!response.headersSent) send(response, { status: 500, body: { error: String(error) } });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("The Keep API server did not bind to a TCP port.");

  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    issueToken: (account) => {
      tokenCounter += 1;
      const token = `token-${tokenCounter}-${account.userId}`;
      tokens.set(token, { ...account });
      return token;
    },
    revokeToken: (token) => {
      tokens.delete(token);
    },
    failNext: (route, fault, times = 1) => {
      const queued = faults.get(route) ?? [];
      for (let index = 0; index < times; index += 1) queued.push(fault);
      faults.set(route, queued);
    },
    setOffline: (value) => {
      offline = value;
    },
    items: (account) => structuredClone([...getData(account).items.values()]),
    collections: (account) => structuredClone([...getData(account).collections.values()]),
    memberships: (account) => structuredClone([...getData(account).memberships.values()]),
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    },
  };
}

function send(response: ServerResponse, { status, body }: ApiResponse): void {
  if (body === undefined) {
    response.writeHead(status).end();
    return;
  }
  const payload = JSON.stringify(body);
  response
    .writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(payload) })
    .end(payload);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function parseBearerToken(header: string | undefined): string | undefined {
  const match = header?.match(/^Bearer (.+)$/);
  return match?.[1];
}

function isSameAccount(scope: SyncScope, account: KeepApiAccount): boolean {
  return scope.tenantId === account.tenantId && scope.userId === account.userId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isScope(value: unknown): value is SyncScope {
  if (!isRecord(value)) return false;
  const { tenantId, userId } = value;
  return (
    (tenantId === undefined || typeof tenantId === "string") && (userId === undefined || typeof userId === "string")
  );
}

function toRecordedOperation(body: unknown): RecordedOperation | undefined {
  if (!isRecord(body)) return undefined;
  const { operationId, type, id, attempts, baseRevision, scope } = body;
  if (typeof operationId !== "string" || typeof id !== "string") return undefined;
  if (type !== "upsert" && type !== "remove") return undefined;
  return {
    operationId,
    type,
    id,
    ...(typeof attempts === "number" ? { attempts } : {}),
    ...(typeof baseRevision === "string" ? { baseRevision } : {}),
    ...(isScope(scope) ? { scope } : {}),
  };
}

function isItemOperation(body: Record<string, unknown>): body is SyncOperation {
  if (body.entity !== undefined && body.entity !== "item") return false;
  if (body.type === "remove") return true;
  return isRecord(body.item) && body.item.id === body.id;
}

function isCollectionOperation(body: Record<string, unknown>): body is KeepCollectionSyncOperation {
  if (body.entity !== "collection") return false;
  if (body.type === "remove") return true;
  return isRecord(body.collection) && body.collection.id === body.id && typeof body.collection.name === "string";
}

function isMembershipOperation(body: Record<string, unknown>): body is KeepMembershipSyncOperation {
  if (body.entity !== "membership" || typeof body.collectionId !== "string" || typeof body.itemId !== "string") {
    return false;
  }
  if (body.type === "remove") return true;
  return isRecord(body.membership) && body.membership.itemId === body.itemId;
}
