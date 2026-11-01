import type {
  AuthenticatedSyncTransport,
  KeepCollectionDefinition,
  KeepCollectionMembership,
  KeepCollectionSyncOperation,
  KeepItem,
  KeepMembershipSyncOperation,
  RemoteSyncDriver,
  RemoteSyncResult,
  SyncOperation,
} from "@keepkit/core/core";

type CollectionPushResult = Awaited<ReturnType<NonNullable<RemoteSyncDriver["pushCollection"]>>>;

/** Carries the HTTP status so KeepKit can map 401/403 responses to re-authentication. */
export class KeepApiError extends Error {
  readonly status: number;

  constructor(status: number, path: string) {
    super(`Keep API request to ${path} failed with HTTP ${status}.`);
    this.name = "KeepApiError";
    this.status = status;
  }
}

export type KeepApiClient<TMeta> = {
  pullItems(token: string | null): Promise<KeepItem<TMeta>[]>;
  pushItem(operation: SyncOperation<TMeta>, token: string | null): Promise<RemoteSyncResult<TMeta>>;
  pullCollections(token: string | null): Promise<KeepCollectionDefinition[]>;
  pushCollection(operation: KeepCollectionSyncOperation, token: string | null): Promise<CollectionPushResult>;
  pullMemberships(token: string | null): Promise<KeepCollectionMembership[]>;
  pushMembership(operation: KeepMembershipSyncOperation, token: string | null): Promise<void>;
};

/** A minimal fetch client for the reference Keep API, written the way a host application would. */
export function createKeepApiClient<TMeta = Record<string, unknown>>(baseUrl: string): KeepApiClient<TMeta> {
  const request = async (path: string, token: string | null, body?: unknown): Promise<unknown> => {
    const headers: Record<string, string> = { accept: "application/json" };
    if (token) headers.authorization = `Bearer ${token}`;
    const init: RequestInit =
      body === undefined
        ? { method: "GET", headers }
        : { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(body) };
    const response = await fetch(new URL(path, baseUrl), init);
    if (!response.ok) {
      await response.body?.cancel();
      throw new KeepApiError(response.status, path);
    }
    if (response.status === 204) return undefined;
    return response.json();
  };

  // Response bodies come from the reference server, so the JSON boundary is trusted after an envelope check.
  const readList = async <T>(path: string, field: string, token: string | null): Promise<T[]> => {
    const payload = await request(path, token);
    const list = isRecord(payload) ? payload[field] : undefined;
    if (!Array.isArray(list)) throw new TypeError(`Keep API response from ${path} is missing "${field}".`);
    return list as T[];
  };

  return {
    pullItems: (token) => readList<KeepItem<TMeta>>("/v1/items", "items", token),
    pushItem: async (operation, token) => {
      const payload = await request("/v1/items/operations", token, operation);
      if (!isRecord(payload) || (payload.type !== "synced" && payload.type !== "conflict")) {
        throw new TypeError("Keep API returned an invalid item sync result.");
      }
      return payload as RemoteSyncResult<TMeta>;
    },
    pullCollections: (token) => readList<KeepCollectionDefinition>("/v1/collections", "collections", token),
    pushCollection: async (operation, token) => {
      const payload = await request("/v1/collections/operations", token, operation);
      if (!isRecord(payload) || payload.type !== "synced") {
        throw new TypeError("Keep API returned an invalid collection sync result.");
      }
      return payload as CollectionPushResult;
    },
    pullMemberships: (token) => readList<KeepCollectionMembership>("/v1/memberships", "memberships", token),
    pushMembership: async (operation, token) => {
      await request("/v1/memberships/operations", token, operation);
    },
  };
}

/** Adapts the client to `createAuthenticatedSyncKit`, which supplies a fresh token per request. */
export function createAuthenticatedTransport<TMeta>(client: KeepApiClient<TMeta>): AuthenticatedSyncTransport<TMeta> {
  return {
    push: (operation, { token }) => client.pushItem(operation, token),
    pull: ({ token }) => client.pullItems(token),
    pushCollection: (operation, { token }) => client.pushCollection(operation, token),
    pullCollections: ({ token }) => client.pullCollections(token),
    pushMembership: (operation, { token }) => client.pushMembership(operation, token),
    pullMemberships: ({ token }) => client.pullMemberships(token),
  };
}

/** Adapts the client to a plain `RemoteSyncDriver` for `SyncStorageAdapter`. */
export function createRemoteSyncDriver<TMeta>(
  client: KeepApiClient<TMeta>,
  getToken: () => string | null,
): RemoteSyncDriver<TMeta> {
  return {
    push: (operation) => client.pushItem(operation, getToken()),
    pull: () => client.pullItems(getToken()),
    pushCollection: (operation) => client.pushCollection(operation, getToken()),
    pullCollections: () => client.pullCollections(getToken()),
    pushMembership: (operation) => client.pushMembership(operation, getToken()),
    pullMemberships: () => client.pullMemberships(getToken()),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
