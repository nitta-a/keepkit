import { type BrowserStorageAdapterOptions, createBrowserStorageAdapter } from "../../../storage";
import type { KeepStorageRecovery } from "../../../storage/recovery-journal";
import { SyncStorageAdapter, type SyncStorageAdapterOptions } from "../../../storage/sync";
import type {
  KeepCollectionDefinition,
  KeepCollectionMembership,
  KeepCollectionSyncOperation,
  KeepCollectionSyncResult,
  KeepItem,
  KeepMembershipSyncOperation,
  KeepSyncAuthError,
  KeepSyncAuthStatus,
  KeepSyncQueueOperation,
  KeepSyncState,
  RemoteSyncDriver,
  RemoteSyncResult,
  StorageAdapter,
  SyncCapableStorageAdapter,
  SyncOperation,
  SyncQueueAdapter,
  SyncScope,
} from "../../items/types";
import { KeepSyncAuthError as KeepSyncAuthErrorClass } from "../../items/types";
import { exportItems } from "../../persistence/backup";
import { mergeKeepItemLists } from "../../persistence/helpers";
import {
  createScopedStorageAdapter,
  getKeepScopeKey,
  isSameKeepScope,
  ScopedSyncQueueAdapter,
} from "../../persistence/scope";

export type AuthenticatedSyncRequestContext<TMeta = Record<string, unknown>> = {
  token: string | null;
  scope?: SyncScope;
  operation?: SyncOperation<TMeta>;
  collectionOperation?: KeepCollectionSyncOperation;
  membershipOperation?: KeepMembershipSyncOperation;
};

/** Transport boundary for auth-aware requests; cookies and bearer tokens remain host concerns. */
export type AuthenticatedSyncTransport<TMeta = Record<string, unknown>> = {
  push: (
    operation: SyncOperation<TMeta>,
    context: AuthenticatedSyncRequestContext<TMeta>,
  ) => Promise<RemoteSyncResult<TMeta>>;
  pull?: (context: AuthenticatedSyncRequestContext<TMeta>) => Promise<KeepItem<TMeta>[]>;
  /** Return the server result so collection revisions and conflicts reach the sync queue. */
  pushCollection?: (
    operation: KeepCollectionSyncOperation,
    context: AuthenticatedSyncRequestContext<TMeta>,
    // biome-ignore lint/suspicious/noConfusingVoidType: Existing transports may return void; new ones can return results.
  ) => Promise<void | KeepCollectionSyncResult>;
  pullCollections?: (context: AuthenticatedSyncRequestContext<TMeta>) => Promise<KeepCollectionDefinition[]>;
  pushMembership?: (
    operation: KeepMembershipSyncOperation,
    context: AuthenticatedSyncRequestContext<TMeta>,
  ) => Promise<void>;
  pullMemberships?: (context: AuthenticatedSyncRequestContext<TMeta>) => Promise<KeepCollectionMembership[]>;
};

export type AuthenticatedSyncAuthContext<TMeta = Record<string, unknown>> = {
  operation?: SyncOperation<TMeta>;
  collectionOperation?: KeepCollectionSyncOperation;
  membershipOperation?: KeepMembershipSyncOperation;
  scope?: SyncScope;
};

export type AuthenticatedSyncKitOptions<TMeta = Record<string, unknown>> = Omit<
  SyncStorageAdapterOptions<TMeta>,
  "local" | "remote" | "scope"
> & {
  /** Optional custom local adapter. Browser storage is used when omitted. */
  local?: StorageAdapter<TMeta>;
  key?: BrowserStorageAdapterOptions["key"];
  databaseName?: BrowserStorageAdapterOptions["databaseName"];
  scope?: SyncScope;
  /** Resolve the active account or tenant before storage operations. */
  getScope?: () => SyncScope | undefined | Promise<SyncScope | undefined>;
  getAuthToken: () => Promise<string | null>;
  transport: AuthenticatedSyncTransport<TMeta>;
  onAuthError?: (error: KeepSyncAuthError<TMeta>, context: AuthenticatedSyncAuthContext<TMeta>) => void | Promise<void>;
  onReauthenticate?: (
    error: KeepSyncAuthError<TMeta>,
    context: AuthenticatedSyncAuthContext<TMeta>,
  ) => void | Promise<void>;
  onScopeChange?: (next: SyncScope | undefined, previous: SyncScope | undefined) => void | Promise<void>;
};

export type AuthenticatedSyncKit<TMeta = Record<string, unknown>> = {
  readonly mode: "sync";
  readonly storage: SyncCapableStorageAdapter<TMeta>;
  readonly scope?: SyncScope;
  readonly scopeKey: string;
  getScope(): SyncScope | undefined;
  setScope(scope?: SyncScope): Promise<void>;
  subscribeScope(listener: () => void): () => void;
  exportBackup(): Promise<string>;
  dispose(): void;
};

/** Creates auth-independent sync wiring with per-request tokens and isolated account scopes. */
export function createAuthenticatedSyncKit<TMeta = Record<string, unknown>>(
  options: AuthenticatedSyncKitOptions<TMeta>,
): AuthenticatedSyncKit<TMeta> {
  const controller = new AuthenticatedSyncStorageController(options);
  return {
    mode: "sync",
    storage: controller,
    get scope() {
      return controller.scope;
    },
    get scopeKey() {
      return controller.scopeKey;
    },
    getScope: () => controller.scope,
    setScope: (scope) => controller.setScope(scope),
    subscribeScope: (listener) => controller.subscribeScope(listener),
    exportBackup: () => controller.exportBackup(),
    dispose: () => controller.dispose(),
  };
}

class AuthenticatedSyncStorageController<TMeta = Record<string, unknown>> implements SyncCapableStorageAdapter<TMeta> {
  readonly getCollections?: () => Promise<KeepCollectionDefinition[]>;
  readonly setCollection?: (collection: KeepCollectionDefinition) => Promise<void>;
  readonly removeCollection?: (id: string, scope?: SyncScope) => Promise<void>;
  readonly getCollectionMemberships?: () => Promise<KeepCollectionMembership[]>;
  readonly setCollectionMembership?: (membership: KeepCollectionMembership) => Promise<void>;
  readonly removeCollectionMembership?: (collectionId: string, itemId: string, scope?: SyncScope) => Promise<void>;
  private readonly options: AuthenticatedSyncKitOptions<TMeta>;
  private currentScope: SyncScope | undefined;
  private scopeResolved: boolean;
  private accountAware: boolean;
  private current: SyncStorageAdapter<TMeta>;
  private readonly scopeListeners = new Set<() => void>();
  private readonly dataListeners = new Set<() => void>();
  private readonly syncListeners = new Set<() => void>();
  private unsubscribeData: () => void = () => undefined;
  private unsubscribeSync: () => void = () => undefined;
  private transition = Promise.resolve();
  private disposed = false;

  constructor(options: AuthenticatedSyncKitOptions<TMeta>) {
    this.options = options;
    this.currentScope = options.scope;
    // Without a static scope the active account is unknown until getScope resolves, so the queue must not be
    // resumed or sent with whichever token happens to be current.
    this.scopeResolved = options.scope !== undefined || !options.getScope;
    // Kits that know about accounts must not expose account records while signed out over shared host storage.
    this.accountAware = options.scope !== undefined || options.getScope !== undefined;
    this.current = this.scopeResolved ? this.createAdapter(this.currentScope) : this.createPendingAdapter();
    this.attach(this.current);
    if (this.current.getCollections && this.current.setCollection && this.current.removeCollection) {
      this.getCollections = async () => {
        await this.ensureScope();
        return this.current.getCollections?.() ?? [];
      };
      this.setCollection = async (collection) => {
        await this.ensureScope();
        await this.current.setCollection?.(collection);
      };
      this.removeCollection = async (id) => {
        await this.ensureScope();
        await this.current.removeCollection?.(id);
      };
    }
    if (
      this.current.getCollectionMemberships &&
      this.current.setCollectionMembership &&
      this.current.removeCollectionMembership
    ) {
      this.getCollectionMemberships = async () => {
        await this.ensureScope();
        return this.current.getCollectionMemberships?.() ?? [];
      };
      this.setCollectionMembership = async (membership) => {
        await this.ensureScope();
        await this.current.setCollectionMembership?.(membership);
      };
      this.removeCollectionMembership = async (collectionId, itemId) => {
        await this.ensureScope();
        await this.current.removeCollectionMembership?.(collectionId, itemId);
      };
    }
  }

  get storageKey(): string | undefined {
    return this.current.storageKey;
  }

  get scope(): SyncScope | undefined {
    return this.currentScope;
  }

  get scopeKey(): string {
    return getKeepScopeKey(this.currentScope);
  }

  async getAll(): Promise<KeepItem<TMeta>[]> {
    await this.ensureScope();
    return this.current.getAll();
  }

  async set(item: KeepItem<TMeta>): Promise<void> {
    await this.ensureScope();
    return this.current.set(item);
  }

  async setMany(items: KeepItem<TMeta>[]): Promise<void> {
    await this.ensureScope();
    return this.current.setMany(items);
  }

  async remove(id: string): Promise<void> {
    await this.ensureScope();
    return this.current.remove(id);
  }

  async removeMany(ids: string[]): Promise<void> {
    await this.ensureScope();
    return this.current.removeMany(ids);
  }

  async clear(): Promise<void> {
    await this.ensureScope();
    return this.current.clear();
  }

  async merge(items: KeepItem<TMeta>[]): Promise<KeepItem<TMeta>[]> {
    await this.ensureScope();
    return this.current.merge(items);
  }

  subscribe(listener: () => void): () => void {
    this.dataListeners.add(listener);
    return () => this.dataListeners.delete(listener);
  }

  getSyncState(): KeepSyncState<TMeta> {
    return this.current.getSyncState();
  }

  subscribeSync(listener: () => void): () => void {
    this.syncListeners.add(listener);
    return () => this.syncListeners.delete(listener);
  }

  async flushSync(): Promise<void> {
    await this.ensureScope();
    return this.current.flushSync();
  }

  async retrySync(): Promise<void> {
    await this.ensureScope();
    return this.current.retrySync?.() ?? this.current.flushSync();
  }

  async resolveSyncConflict(
    id: string,
    resolution: "local" | "remote" | "manual",
    item?: KeepItem<TMeta>,
  ): Promise<void> {
    await this.ensureScope();
    if (!this.current.resolveSyncConflict) {
      throw new Error("The authenticated sync adapter does not support conflict resolution.");
    }
    return this.current.resolveSyncConflict(id, resolution, item);
  }

  async resolveRejectedSyncOperation(operationId: string, resolution: "retry" | "discard"): Promise<void> {
    await this.ensureScope();
    if (!this.current.resolveRejectedSyncOperation) {
      throw new Error("The authenticated sync adapter does not support resolving rejected operations.");
    }
    return this.current.resolveRejectedSyncOperation(operationId, resolution);
  }

  async resolveCollectionSyncConflict(
    id: string,
    resolution: "local" | "remote",
    collection?: KeepCollectionDefinition,
  ): Promise<void> {
    await this.ensureScope();
    if (!this.current.resolveCollectionSyncConflict) {
      throw new Error("The authenticated sync adapter does not support collection conflict resolution.");
    }
    return this.current.resolveCollectionSyncConflict(id, resolution, collection);
  }

  async setScope(nextScope?: SyncScope): Promise<void> {
    const run = this.transition.then(async () => {
      if (this.scopeResolved && isSameKeepScope(this.currentScope, nextScope)) return;
      if (this.disposed) throw new Error("AuthenticatedSyncKit has been disposed.");
      const previousScope = this.currentScope;
      const scopeChanged = !isSameKeepScope(previousScope, nextScope);
      this.unsubscribeData();
      this.unsubscribeSync();
      this.current.dispose?.();
      this.scopeResolved = true;
      if (nextScope) this.accountAware = true;
      this.currentScope = nextScope;
      this.current = this.createAdapter(nextScope);
      this.attach(this.current);
      if (scopeChanged) {
        await this.options.onScopeChange?.(nextScope, previousScope);
        this.notify(this.scopeListeners);
      }
      this.notify(this.dataListeners);
      this.notify(this.syncListeners);
    });
    this.transition = run.catch(() => undefined);
    return run;
  }

  subscribeScope(listener: () => void): () => void {
    this.scopeListeners.add(listener);
    return () => this.scopeListeners.delete(listener);
  }

  async exportBackup(): Promise<string> {
    await this.ensureScope();
    return exportItems(this.current);
  }

  dispose(): void {
    this.disposed = true;
    this.unsubscribeData();
    this.unsubscribeSync();
    this.current.dispose?.();
    this.scopeListeners.clear();
    this.dataListeners.clear();
    this.syncListeners.clear();
  }

  private createAdapter(scope: SyncScope | undefined): SyncStorageAdapter<TMeta> {
    return new SyncStorageAdapter<TMeta>({
      ...this.options,
      local: this.createLocal(scope),
      remote: createAuthenticatedRemote(this.options, scope),
      queue: this.createQueue(scope),
      scope,
    });
  }

  private createPendingAdapter(): SyncStorageAdapter<TMeta> {
    return new PendingScopeSyncStorageAdapter<TMeta>({
      ...this.options,
      local: this.createLocal(undefined),
      remote: {
        push: async () => {
          throw new Error("KeepKit cannot sync before the authenticated scope is resolved.");
        },
      },
      queue: new EmptySyncQueueAdapter<TMeta>(),
      scope: undefined,
    });
  }

  private createLocal(scope: SyncScope | undefined): StorageAdapter<TMeta> {
    const { local, key, databaseName, userId, tenantId } = this.options;
    if (!local) return createBrowserStorageAdapter<TMeta>({ key, databaseName, scope });
    if (scope) return createScopedStorageAdapter(local, scope);
    // SyncStorageAdapter scopes records itself when userId or tenantId is set; single-account kits keep the shared view.
    if (userId || tenantId || !this.accountAware) return local;
    // A host-supplied adapter is shared by every account, so a signed-out session only owns unscoped records.
    return new UnscopedStorageAdapter(local);
  }

  private createQueue(scope: SyncScope | undefined): SyncQueueAdapter<TMeta> | undefined {
    const { queue, userId, tenantId } = this.options;
    if (!queue) return undefined;
    if (scope) return new ScopedSyncQueueAdapter(queue, scope);
    // SyncStorageAdapter scopes the queue itself when userId or tenantId is configured.
    if (userId || tenantId) return queue;
    // A host-supplied queue is shared by every account, so an unscoped session only owns unscoped operations.
    return new UnscopedSyncQueueAdapter(queue);
  }

  private attach(adapter: SyncStorageAdapter<TMeta>): void {
    this.unsubscribeData = adapter.subscribe?.(() => this.notify(this.dataListeners)) ?? (() => undefined);
    this.unsubscribeSync = adapter.subscribeSync(() => this.notify(this.syncListeners));
  }

  private async ensureScope(): Promise<void> {
    if (!this.options.getScope) return;
    await this.setScope(await this.options.getScope());
  }

  private notify(listeners: Set<() => void>): void {
    for (const listener of listeners) listener();
  }
}

/** Stands in until getScope resolves; it never reads the durable queue or contacts the remote. */
class PendingScopeSyncStorageAdapter<TMeta = Record<string, unknown>> extends SyncStorageAdapter<TMeta> {
  override async flushSync(): Promise<void> {}

  override async retrySync(): Promise<void> {}
}

class EmptySyncQueueAdapter<TMeta = Record<string, unknown>> implements SyncQueueAdapter<TMeta> {
  async getAll(): Promise<KeepSyncQueueOperation<TMeta>[]> {
    return [];
  }

  async setMany(): Promise<void> {
    throw new Error("KeepKit cannot queue operations before the authenticated scope is resolved.");
  }

  async remove(): Promise<void> {}

  async clear(): Promise<void> {}
}

/** Limits an unscoped session to operations without an account scope, mirroring the separate default queues. */
class UnscopedSyncQueueAdapter<TMeta = Record<string, unknown>> implements SyncQueueAdapter<TMeta> {
  private readonly base: SyncQueueAdapter<TMeta>;

  constructor(base: SyncQueueAdapter<TMeta>) {
    this.base = base;
  }

  async getAll(): Promise<KeepSyncQueueOperation<TMeta>[]> {
    return (await this.base.getAll()).filter(isUnscopedOperation);
  }

  async setMany(operations: KeepSyncQueueOperation<TMeta>[]): Promise<void> {
    const ids = new Set(operations.map((operation) => operation.operationId));
    const current = await this.base.getAll();
    const preserved = current.filter((operation) => !ids.has(operation.operationId) || !isUnscopedOperation(operation));
    await this.base.setMany([...preserved, ...operations]);
  }

  async remove(operationIds: string[]): Promise<void> {
    const ids = new Set(operationIds);
    const unscopedIds = (await this.getAll())
      .filter((operation) => ids.has(operation.operationId))
      .map((operation) => operation.operationId);
    await this.base.remove(unscopedIds);
  }

  async clear(): Promise<void> {
    const unscopedIds = (await this.getAll()).map((operation) => operation.operationId);
    await this.base.remove(unscopedIds);
  }
}

function isUnscopedOperation<TMeta>(operation: KeepSyncQueueOperation<TMeta>): boolean {
  return isSameKeepScope(operation.scope, undefined);
}

/** An explicit empty scope makes built-in adapters remove unscoped records only, not every record with the ID. */
const UNSCOPED: SyncScope = {};

function isUnscoped(value: { scope?: SyncScope }): boolean {
  return isSameKeepScope(value.scope, undefined);
}

/** Limits a signed-out session over shared host storage to records without an account scope. */
class UnscopedStorageAdapter<TMeta = Record<string, unknown>> implements StorageAdapter<TMeta> {
  readonly storageKey?: string;
  readonly recovery?: KeepStorageRecovery<TMeta>;
  readonly getCollections?: () => Promise<KeepCollectionDefinition[]>;
  readonly setCollection?: (collection: KeepCollectionDefinition) => Promise<void>;
  readonly removeCollection?: (id: string) => Promise<void>;
  readonly getCollectionMemberships?: () => Promise<KeepCollectionMembership[]>;
  readonly setCollectionMembership?: (membership: KeepCollectionMembership) => Promise<void>;
  readonly removeCollectionMembership?: (collectionId: string, itemId: string) => Promise<void>;
  private readonly base: StorageAdapter<TMeta>;

  constructor(base: StorageAdapter<TMeta>) {
    this.base = base;
    this.storageKey = base.storageKey;
    if (isSameKeepScope(base.scope, undefined)) this.recovery = base.recovery;
    if (base.getCollections && base.setCollection && base.removeCollection) {
      const getCollections = base.getCollections.bind(base);
      const removeCollection = base.removeCollection.bind(base);
      this.getCollections = async () => (await getCollections()).filter(isUnscoped);
      this.setCollection = base.setCollection.bind(base);
      this.removeCollection = (id) => removeCollection(id, UNSCOPED);
    }
    if (base.getCollectionMemberships && base.setCollectionMembership && base.removeCollectionMembership) {
      const getMemberships = base.getCollectionMemberships.bind(base);
      const removeMembership = base.removeCollectionMembership.bind(base);
      this.getCollectionMemberships = async () => (await getMemberships()).filter(isUnscoped);
      this.setCollectionMembership = base.setCollectionMembership.bind(base);
      this.removeCollectionMembership = (collectionId, itemId) => removeMembership(collectionId, itemId, UNSCOPED);
    }
  }

  async getAll(): Promise<KeepItem<TMeta>[]> {
    return (await this.base.getAll()).filter(isUnscoped);
  }

  async set(item: KeepItem<TMeta>): Promise<void> {
    await this.base.set(item);
  }

  async setMany(items: KeepItem<TMeta>[]): Promise<void> {
    if (this.base.setMany) await this.base.setMany(items);
    else for (const item of items) await this.base.set(item);
  }

  async remove(id: string): Promise<void> {
    await this.removeMany([id]);
  }

  async removeMany(ids: string[]): Promise<void> {
    const uniqueIds = [...new Set(ids)];
    if (this.base.removeMany) await this.base.removeMany(uniqueIds, UNSCOPED);
    else for (const id of uniqueIds) await this.base.remove(id, UNSCOPED);
  }

  async clear(): Promise<void> {
    await this.removeMany((await this.getAll()).map((item) => item.id));
    const memberships = (await this.getCollectionMemberships?.()) ?? [];
    for (const { collectionId, itemId } of memberships) await this.removeCollectionMembership?.(collectionId, itemId);
  }

  async merge(items: KeepItem<TMeta>[]): Promise<KeepItem<TMeta>[]> {
    const merged = mergeKeepItemLists(await this.getAll(), items);
    await this.setMany(merged);
    return merged;
  }

  subscribe(listener: () => void): () => void {
    return this.base.subscribe?.(listener) ?? (() => undefined);
  }
}

function createAuthenticatedRemote<TMeta>(
  options: AuthenticatedSyncKitOptions<TMeta>,
  scope: SyncScope | undefined,
): RemoteSyncDriver<TMeta> {
  const pull = options.transport.pull;
  const pullCollections = options.transport.pullCollections;
  const pullMemberships = options.transport.pullMemberships;
  return {
    push: async (operation) => {
      try {
        const token = await options.getAuthToken();
        return await options.transport.push(operation, { token, scope, operation });
      } catch (cause) {
        return handleAuthFailure(cause, options, { operation, scope });
      }
    },
    pull: pull
      ? async () => {
          try {
            const token = await options.getAuthToken();
            return await pull({ token, scope });
          } catch (cause) {
            return handleAuthFailure(cause, options, { scope });
          }
        }
      : undefined,
    pushCollection: options.transport.pushCollection
      ? async (collectionOperation) => {
          try {
            const token = await options.getAuthToken();
            return await options.transport.pushCollection?.(collectionOperation, {
              token,
              scope,
              collectionOperation,
            });
          } catch (cause) {
            return handleAuthFailure(cause, options, { collectionOperation, scope });
          }
        }
      : undefined,
    pullCollections: pullCollections
      ? async () => {
          try {
            const token = await options.getAuthToken();
            return await pullCollections({ token, scope });
          } catch (cause) {
            return handleAuthFailure(cause, options, { scope });
          }
        }
      : undefined,
    pushMembership: options.transport.pushMembership
      ? async (membershipOperation) => {
          try {
            const token = await options.getAuthToken();
            await options.transport.pushMembership?.(membershipOperation, { token, scope, membershipOperation });
          } catch (cause) {
            return handleAuthFailure(cause, options, { membershipOperation, scope });
          }
        }
      : undefined,
    pullMemberships: pullMemberships
      ? async () => {
          try {
            const token = await options.getAuthToken();
            return await pullMemberships({ token, scope });
          } catch (cause) {
            return handleAuthFailure(cause, options, { scope });
          }
        }
      : undefined,
  };
}

async function handleAuthFailure<TMeta>(
  cause: unknown,
  options: AuthenticatedSyncKitOptions<TMeta>,
  context: AuthenticatedSyncAuthContext<TMeta>,
): Promise<never> {
  const status = getAuthStatus(cause);
  if (!status) throw cause;
  const error =
    cause instanceof KeepSyncAuthErrorClass
      ? cause
      : new KeepSyncAuthErrorClass(status, { operation: context.operation, scope: context.scope, cause });
  await options.onAuthError?.(error, context);
  await options.onReauthenticate?.(error, context);
  throw error;
}

function getAuthStatus(error: unknown): KeepSyncAuthStatus | undefined {
  if (error instanceof KeepSyncAuthErrorClass) return error.status;
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { status?: unknown; response?: { status?: unknown }; cause?: unknown };
  if (candidate.status === 401 || candidate.status === 403) return candidate.status;
  if (candidate.response?.status === 401 || candidate.response?.status === 403) return candidate.response.status;
  return candidate.cause ? getAuthStatus(candidate.cause) : undefined;
}
