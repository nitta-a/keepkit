import { exportItems } from "../backup";
import { createScopedStorageAdapter, getKeepScopeKey, isSameKeepScope, ScopedSyncQueueAdapter } from "../scope";
import { type BrowserStorageAdapterOptions, createBrowserStorageAdapter } from "../storage";
import { SyncStorageAdapter, type SyncStorageAdapterOptions } from "../storage/sync";
import type {
  KeepItem,
  KeepSyncAuthError,
  KeepSyncAuthStatus,
  KeepSyncState,
  RemoteSyncDriver,
  RemoteSyncResult,
  StorageAdapter,
  SyncCapableStorageAdapter,
  SyncOperation,
  SyncScope,
} from "../types";
import { KeepSyncAuthError as KeepSyncAuthErrorClass } from "../types";

export type AuthenticatedSyncRequestContext<TMeta = Record<string, unknown>> = {
  token: string | null;
  scope?: SyncScope;
  operation?: SyncOperation<TMeta>;
};

/** Transport boundary for auth-aware requests; cookies and bearer tokens remain host concerns. */
export type AuthenticatedSyncTransport<TMeta = Record<string, unknown>> = {
  push: (
    operation: SyncOperation<TMeta>,
    context: AuthenticatedSyncRequestContext<TMeta>,
  ) => Promise<RemoteSyncResult<TMeta>>;
  pull?: (context: AuthenticatedSyncRequestContext<TMeta>) => Promise<KeepItem<TMeta>[]>;
};

export type AuthenticatedSyncAuthContext<TMeta = Record<string, unknown>> = {
  operation?: SyncOperation<TMeta>;
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
  private readonly options: AuthenticatedSyncKitOptions<TMeta>;
  private currentScope: SyncScope | undefined;
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
    this.current = this.createAdapter(this.currentScope);
    this.attach(this.current);
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

  async setScope(nextScope?: SyncScope): Promise<void> {
    const run = this.transition.then(async () => {
      if (isSameKeepScope(this.currentScope, nextScope)) return;
      if (this.disposed) throw new Error("AuthenticatedSyncKit has been disposed.");
      const previousScope = this.currentScope;
      this.unsubscribeData();
      this.unsubscribeSync();
      this.current.dispose?.();
      this.currentScope = nextScope;
      this.current = this.createAdapter(nextScope);
      this.attach(this.current);
      await this.options.onScopeChange?.(nextScope, previousScope);
      this.notify(this.scopeListeners);
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
    const local = this.options.local
      ? scope
        ? createScopedStorageAdapter(this.options.local, scope)
        : this.options.local
      : createBrowserStorageAdapter<TMeta>({ key: this.options.key, databaseName: this.options.databaseName, scope });
    const queue =
      this.options.queue && scope ? new ScopedSyncQueueAdapter(this.options.queue, scope) : this.options.queue;
    const remote = createAuthenticatedRemote(this.options, scope);
    return new SyncStorageAdapter<TMeta>({
      ...this.options,
      local,
      remote,
      queue,
      scope,
    });
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

function createAuthenticatedRemote<TMeta>(
  options: AuthenticatedSyncKitOptions<TMeta>,
  scope: SyncScope | undefined,
): RemoteSyncDriver<TMeta> {
  const pull = options.transport.pull;
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
