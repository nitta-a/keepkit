import {
  type KeepCollectionDefinition,
  type KeepCollectionMembership,
  type KeepItem,
  KeepStorageAccessError,
  KeepStorageError,
  type KeepStorageOperation,
  KeepStorageParseError,
  KeepStorageQuotaError,
  type StorageAdapter,
} from "../features/items/types";
import {
  isKeepCollectionDefinition,
  isKeepCollectionMembership,
  isKeepItemArray,
  isRecord,
  mergeKeepItemLists,
  persistKeepItems,
} from "../features/persistence/helpers";
import {
  createScopedStorageAdapter,
  getKeepScopeKey,
  isSameKeepScope,
  type KeepScope,
} from "../features/persistence/scope";
import { serializeKeepStorage } from "../features/persistence/serialization";
import {
  type FallbackRecoveryJournal,
  type KeepStorageRecovery,
  LocalStorageRecoveryJournal,
  RecoveryJournalController,
} from "./recovery-journal";

export type {
  FallbackRecoveryJournal,
  FallbackRecoveryJournalState,
  FallbackRecoveryJournalV2,
  FallbackRecoveryOperation,
  FallbackRecoverySnapshot,
  KeepRecoveryInspection,
  KeepRecoveryResult,
  KeepRecoveryRow,
  KeepRecoveryState,
  KeepStorageRecovery,
} from "./recovery-journal";
export { LocalStorageRecoveryJournal } from "./recovery-journal";

export const DEFAULT_STORAGE_KEY = "keepkit:items";

export type LocalStorageAdapterOptions = {
  key?: string;
  storage?: Storage;
};

export type IndexedDBAdapterOptions = {
  databaseName?: string;
  dbName?: string;
  /** Alias for databaseName, useful when switching from LocalStorageAdapter. */
  key?: string;
  storeName?: string;
  version?: number;
  indexedDB?: IDBFactory;
};

export const DEFAULT_INDEXEDDB_DATABASE = "keepkit";
export const DEFAULT_INDEXEDDB_STORE = "items";

export type StorageAdapterFactoryOptions<TMeta = Record<string, unknown>> = {
  getAll: () => KeepItem<TMeta>[] | Promise<KeepItem<TMeta>[]>;
  getCollections?: () => KeepCollectionDefinition[] | Promise<KeepCollectionDefinition[]>;
  setCollection?: (collection: KeepCollectionDefinition) => void | Promise<void>;
  removeCollection?: (id: string, scope?: KeepScope) => void | Promise<void>;
  getCollectionMemberships?: () => KeepCollectionMembership[] | Promise<KeepCollectionMembership[]>;
  setCollectionMembership?: (membership: KeepCollectionMembership) => void | Promise<void>;
  removeCollectionMembership?: (collectionId: string, itemId: string, scope?: KeepScope) => void | Promise<void>;
  set: (item: KeepItem<TMeta>) => void | Promise<void>;
  setMany?: (items: KeepItem<TMeta>[]) => void | Promise<void>;
  remove: (id: string, scope?: KeepScope) => void | Promise<void>;
  removeMany?: (ids: string[], scope?: KeepScope) => void | Promise<void>;
  clear: () => void | Promise<void>;
  merge?: (localItems: KeepItem<TMeta>[]) => KeepItem<TMeta>[] | Promise<KeepItem<TMeta>[]>;
  subscribe?: (listener: () => void) => undefined | (() => void);
  storageKey?: string;
};

export type FallbackStorageAdapterOptions<TMeta = Record<string, unknown>> = {
  primary?: StorageAdapter<TMeta>;
  scope?: KeepScope;
  fallback: StorageAdapter<TMeta>;
  /** Persist fallback-only operations and replay them before returning to the primary. */
  recoveryJournal?: FallbackRecoveryJournal<TMeta>;
  /** Decide which primary adapter failures should activate the fallback. */
  shouldFallback?: (error: unknown) => boolean;
  onFallback?: (error: unknown) => void;
  /** Copy fallback data into an empty primary on the first read. */
  migrateFallbackOnEmpty?: boolean;
  /** Keep the fallback current while the primary is healthy. */
  mirrorWrites?: boolean;
};

/**
 * A storage adapter that switches to a fallback after an availability failure.
 * Parse errors remain visible so corrupt data is never silently hidden.
 */
export class FallbackStorageAdapter<TMeta = Record<string, unknown>> implements StorageAdapter<TMeta> {
  public readonly storageKey: string | undefined;
  public readonly scope: KeepScope | undefined;
  readonly getCollections?: () => Promise<KeepCollectionDefinition[]>;
  readonly setCollection?: (collection: KeepCollectionDefinition) => Promise<void>;
  readonly removeCollection?: (id: string, scope?: KeepScope) => Promise<void>;
  readonly getCollectionMemberships?: () => Promise<KeepCollectionMembership[]>;
  readonly setCollectionMembership?: (membership: KeepCollectionMembership) => Promise<void>;
  readonly removeCollectionMembership?: (collectionId: string, itemId: string, scope?: KeepScope) => Promise<void>;
  private readonly primary: StorageAdapter<TMeta>;
  private readonly fallback: StorageAdapter<TMeta>;
  private readonly shouldFallback: (error: unknown) => boolean;
  private readonly onFallback?: (error: unknown) => void;
  private readonly migrateFallbackOnEmpty: boolean;
  private readonly mirrorWrites: boolean;
  readonly recovery?: KeepStorageRecovery<TMeta>;
  private readonly journalController: RecoveryJournalController<TMeta> | undefined;
  private active: "primary" | "fallback" = "primary";
  private readonly listeners = new Set<() => void>();

  constructor(options: FallbackStorageAdapterOptions<TMeta>) {
    const scope = options.scope ?? options.primary?.scope ?? options.fallback.scope;
    const primary = options.primary && scope ? createScopedStorageAdapter(options.primary, scope) : options.primary;
    this.fallback = scope ? createScopedStorageAdapter(options.fallback, scope) : options.fallback;
    this.primary = primary ?? this.fallback;
    this.shouldFallback = options.shouldFallback ?? isRecoverableStorageError;
    this.onFallback = options.onFallback;
    this.migrateFallbackOnEmpty = options.migrateFallbackOnEmpty ?? false;
    this.mirrorWrites = options.mirrorWrites ?? false;
    this.storageKey = options.fallback.storageKey ?? options.primary?.storageKey;
    this.scope = scope;
    if (!options.primary) this.active = "fallback";
    if (options.recoveryJournal) {
      this.journalController = new RecoveryJournalController({
        primary,
        fallback: this.fallback,
        scope: this.scope,
        migrateFallbackOnEmpty: this.migrateFallbackOnEmpty,
        journal: options.recoveryJournal,
        shouldFallback: this.shouldFallback,
        mirrorWrites: this.mirrorWrites,
        onSourceChange: (source, error) => {
          this.active = source;
          if (source === "fallback" && error !== undefined) this.reportFallbackError(error);
          this.notifyListeners();
        },
        onError: (error) => this.reportFallbackError(error),
      });
      this.recovery = this.journalController;
    }
    if (
      this.primary.getCollections &&
      this.primary.setCollection &&
      this.primary.removeCollection &&
      this.fallback.getCollections &&
      this.fallback.setCollection &&
      this.fallback.removeCollection
    ) {
      const fallbackGetCollections = this.fallback.getCollections.bind(this.fallback);
      this.getCollections = async () => {
        if (this.journalController) return this.journalController.readCollections();
        const collections = await this.execute((adapter) => {
          if (!adapter.getCollections) throw new Error("Collection storage is unavailable.");
          return adapter.getCollections();
        });
        if (this.active === "primary" && this.migrateFallbackOnEmpty && collections.length === 0) {
          const fallbackCollections = await fallbackGetCollections();
          for (const collection of fallbackCollections) await this.setCollection?.(collection);
          return fallbackCollections;
        }
        return collections;
      };
      this.setCollection = (collection) => {
        const value = this.scope ? { ...collection, scope: this.scope } : collection;
        return (
          this.journalController?.write({ type: "setCollection", collection: value }) ??
          this.executeWrite((adapter) => {
            if (!adapter.setCollection) throw new Error("Collection storage is unavailable.");
            return adapter.setCollection(value);
          })
        );
      };
      this.removeCollection = (id, scope = this.scope) =>
        this.journalController?.write({ type: "removeCollection", id, scope }) ??
        this.executeWrite((adapter) => {
          if (!adapter.removeCollection) throw new Error("Collection storage is unavailable.");
          return adapter.removeCollection(id, scope);
        });
    }
    if (
      this.primary.getCollectionMemberships &&
      this.primary.setCollectionMembership &&
      this.primary.removeCollectionMembership &&
      this.fallback.getCollectionMemberships &&
      this.fallback.setCollectionMembership &&
      this.fallback.removeCollectionMembership
    ) {
      const fallbackGetMemberships = this.fallback.getCollectionMemberships.bind(this.fallback);
      this.getCollectionMemberships = async () => {
        if (this.journalController) return this.journalController.readMemberships();
        const memberships = await this.execute(
          (adapter) => adapter.getCollectionMemberships?.() ?? Promise.resolve([]),
        );
        if (this.active !== "primary" || !this.migrateFallbackOnEmpty || memberships.length > 0) return memberships;
        const fallbackMemberships = await fallbackGetMemberships();
        for (const membership of fallbackMemberships) await this.setCollectionMembership?.(membership);
        return fallbackMemberships;
      };
      this.setCollectionMembership = (membership) => {
        const value = this.scope ? { ...membership, scope: this.scope } : membership;
        return (
          this.journalController?.write({ type: "setMembership", membership: value }) ??
          this.executeWrite((adapter) => adapter.setCollectionMembership?.(value) ?? Promise.resolve())
        );
      };
      this.removeCollectionMembership = (collectionId, itemId, scope = this.scope) =>
        this.journalController?.write({ type: "removeMembership", collectionId, itemId, scope }) ??
        this.executeWrite(
          (adapter) => adapter.removeCollectionMembership?.(collectionId, itemId, scope) ?? Promise.resolve(),
        );
    }
  }

  get isUsingFallback(): boolean {
    return this.active === "fallback";
  }

  getAll(): Promise<KeepItem<TMeta>[]> {
    return this.readAll();
  }

  set(item: KeepItem<TMeta>): Promise<void> {
    if (this.scope) item = { ...item, scope: this.scope };
    if (this.journalController)
      return this.journalController.write({ type: "setItems", items: [item] }, (adapter) => adapter.set(item));
    return this.executeWrite((adapter) => adapter.set(item));
  }

  setMany(items: KeepItem<TMeta>[]): Promise<void> {
    if (this.scope) items = items.map((item) => ({ ...item, scope: this.scope }));
    if (this.journalController) return this.journalController.write({ type: "setItems", items });
    return this.executeWrite((adapter) =>
      adapter.setMany
        ? adapter.setMany(items)
        : Promise.all(items.map((item) => adapter.set(item))).then(() => undefined),
    );
  }

  remove(id: string, scope: KeepScope | undefined = this.scope): Promise<void> {
    if (this.journalController)
      return this.journalController.write({ type: "removeItems", ids: [id], scope }, (adapter) =>
        adapter.remove(id, scope),
      );
    return this.executeWrite((adapter) => adapter.remove(id, scope));
  }

  removeMany(ids: string[], scope: KeepScope | undefined = this.scope): Promise<void> {
    if (this.journalController) return this.journalController.write({ type: "removeItems", ids, scope });
    return this.executeWrite((adapter) =>
      adapter.removeMany
        ? adapter.removeMany(ids, scope)
        : Promise.all(ids.map((id) => adapter.remove(id, scope))).then(() => undefined),
    );
  }

  clear(): Promise<void> {
    if (this.journalController) return this.journalController.write({ type: "clearItems" });
    return this.executeWrite((adapter) => adapter.clear());
  }

  merge(localItems: KeepItem<TMeta>[]): Promise<KeepItem<TMeta>[]> {
    if (this.scope) localItems = localItems.map((item) => ({ ...item, scope: this.scope }));
    if (this.journalController) return this.journalController.merge(localItems);
    return this.execute(async (adapter) => {
      const merged = adapter.merge
        ? await adapter.merge(localItems)
        : mergeKeepItemLists(await adapter.getAll(), localItems);
      if (!adapter.merge) await persistKeepItems(adapter, merged);
      if (this.active === "primary" && this.mirrorWrites) {
        try {
          await persistKeepItems(this.fallback, merged);
        } catch {
          // The fallback is best-effort while the primary is healthy.
        }
      }
      return merged;
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    const notify = (source: "primary" | "fallback") => {
      if (source === this.active) listener();
    };
    const unsubscribePrimary = this.primary.subscribe?.(() => notify("primary"));
    const unsubscribeFallback = this.fallback.subscribe?.(() => notify("fallback"));
    const unsubscribeJournal = this.journalController?.subscribeJournalChanges(listener);
    return () => {
      this.listeners.delete(listener);
      unsubscribePrimary?.();
      unsubscribeFallback?.();
      unsubscribeJournal?.();
    };
  }

  private async readAll(): Promise<KeepItem<TMeta>[]> {
    if (this.journalController) return this.journalController.readItems();
    if (this.active === "fallback") return this.fallback.getAll();
    let items: KeepItem<TMeta>[];
    try {
      items = await this.primary.getAll();
    } catch (error) {
      if (!this.shouldFallback(error)) throw error;
      this.activateFallback(error);
      return this.fallback.getAll();
    }
    if (!this.migrateFallbackOnEmpty || items.length > 0) return items;

    const fallbackItems = await this.fallback.getAll();
    if (fallbackItems.length === 0) return items;
    try {
      await persistKeepItems(this.primary, fallbackItems);
      return fallbackItems;
    } catch (error) {
      if (!this.shouldFallback(error)) throw error;
      this.activateFallback(error);
      return fallbackItems;
    }
  }

  private activateFallback(error: unknown): void {
    this.active = "fallback";
    this.reportFallbackError(error);
    this.notifyListeners();
  }

  private reportFallbackError(error: unknown): void {
    try {
      this.onFallback?.(error);
    } catch {
      // Reporting cannot interrupt an accepted storage operation or later observers.
    }
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // Each observer receives the source change even if another observer fails.
      }
    }
  }

  private async executeWrite<TResult>(
    operation: (adapter: StorageAdapter<TMeta>) => Promise<TResult>,
  ): Promise<TResult> {
    const result = await this.execute(operation);
    if (this.active === "primary" && this.mirrorWrites) {
      try {
        await operation(this.fallback);
      } catch {
        // The fallback is best-effort while the primary is healthy.
      }
    }
    return result;
  }

  private async execute<TResult>(operation: (adapter: StorageAdapter<TMeta>) => Promise<TResult>): Promise<TResult> {
    const adapter = this.active === "primary" ? this.primary : this.fallback;
    try {
      return await operation(adapter);
    } catch (error) {
      if (this.active !== "primary" || !this.shouldFallback(error)) throw error;
      this.activateFallback(error);
      return operation(this.fallback);
    }
  }
}

export type RecoveryJournalFactoryContext = {
  storageKey: string;
  lockKey: string;
  scope?: KeepScope;
};
export type BrowserStorageAdapterOptions<TMeta = Record<string, unknown>> = {
  key?: string;
  databaseName?: string;
  storeName?: string;
  version?: number;
  indexedDB?: IDBFactory;
  storage?: Storage;
  scope?: KeepScope;
  createRecoveryJournal?: (context: RecoveryJournalFactoryContext) => FallbackRecoveryJournal<TMeta>;
};

/** IndexedDB-first browser storage with a scoped durable recovery checkpoint. */
export function createBrowserStorageAdapter<TMeta = Record<string, unknown>>(
  options: BrowserStorageAdapterOptions<TMeta> = {},
): StorageAdapter<TMeta> {
  const browserIndexedDB = options.indexedDB ?? getBrowserIndexedDB();
  const scopeKey = getKeepScopeKey(options.scope);
  const storageKey = `${options.key ?? DEFAULT_STORAGE_KEY}${scopeKey}`;
  const fallback = new LocalStorageAdapter<TMeta>({ key: storageKey, storage: options.storage });
  const databaseName = options.databaseName ? `${options.databaseName}${scopeKey}` : DEFAULT_INDEXEDDB_DATABASE;
  const storeName = options.storeName ?? DEFAULT_INDEXEDDB_STORE;
  const primaryKey = JSON.stringify([databaseName, storeName]);
  const scopeIdentity = JSON.stringify([options.scope?.tenantId ?? null, options.scope?.userId ?? null]);
  const journalKey = `${fallback.storageKey}:recovery:${encodeURIComponent(primaryKey)}:${encodeURIComponent(scopeIdentity)}`;
  const lockKey = `recovery:${primaryKey}`;
  const legacyBackendKey = `${databaseName}:${storeName}`;
  const legacyJournalKey = `${fallback.storageKey}:recovery:${encodeURIComponent(legacyBackendKey)}`;
  const recoveryJournal =
    options.createRecoveryJournal?.({ storageKey: journalKey, lockKey, scope: options.scope }) ??
    createBrowserRecoveryJournal<TMeta>(
      journalKey,
      legacyJournalKey,
      lockKey,
      options.storage ?? getBrowserStorage(),
      options.scope,
      isAmbiguousLegacyBackend(legacyBackendKey, scopeKey),
    );
  const adapter = new FallbackStorageAdapter<TMeta>({
    primary: browserIndexedDB
      ? new IndexedDBAdapter<TMeta>({
          databaseName,
          storeName: options.storeName,
          version: options.version,
          indexedDB: browserIndexedDB,
        })
      : undefined,
    fallback,
    scope: options.scope,
    recoveryJournal,
    migrateFallbackOnEmpty: true,
    mirrorWrites: true,
  });
  return options.scope ? createScopedStorageAdapter(adapter, options.scope) : adapter;
}

function createBrowserRecoveryJournal<TMeta>(
  storageKey: string,
  legacyStorageKey: string,
  lockKey: string,
  storage: Storage | undefined,
  scope: KeepScope | undefined,
  ambiguousBackend: boolean,
): FallbackRecoveryJournal<TMeta> {
  const journal = new LocalStorageRecoveryJournal<TMeta>(storageKey, storage, lockKey);
  const legacy = new LocalStorageRecoveryJournal<TMeta>(legacyStorageKey, storage, lockKey);
  return {
    read: async () => {
      const current = await journal.read();
      if (current !== undefined) return current;
      const previous = await legacy.read();
      if (previous && ambiguousBackend)
        throw new KeepStorageParseError({ operation: "getAll", storageKey: legacyStorageKey });
      // Scoped v1 factories never produced clearItems; the old key cannot identify its scope safely.
      if (scope && previous?.operations.some((operation) => operation.type === "clearItems"))
        throw new KeepStorageParseError({ operation: "getAll", storageKey: legacyStorageKey });
      return previous;
    },
    write: async (state) => {
      await journal.write(state);
      try {
        storage?.removeItem(legacyStorageKey);
      } catch {
        // The canonical journal is already durable and takes precedence over the retained legacy copy.
      }
    },
    runExclusive: (operation) => journal.runExclusive(operation),
    subscribe: (listener) => {
      if (typeof window === "undefined") return () => undefined;
      const onStorage = (event: StorageEvent) => {
        if (event.key === null || event.key === storageKey || event.key === legacyStorageKey) listener();
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    },
  };
}

function isAmbiguousLegacyBackend(backendKey: string, scopeKey: string): boolean {
  let candidates = 0;
  for (let index = 1; index < backendKey.length - 1; index += 1) {
    if (backendKey[index] !== ":") continue;
    const databaseName = backendKey.slice(0, index);
    if (databaseName === DEFAULT_INDEXEDDB_DATABASE || !scopeKey || databaseName.endsWith(scopeKey)) candidates += 1;
  }
  return candidates !== 1;
}

/** Adapt sync or async persistence functions to the StorageAdapter contract. */
export function createStorageAdapter<TMeta = Record<string, unknown>>(
  options: StorageAdapterFactoryOptions<TMeta>,
): StorageAdapter<TMeta> {
  const merge = options.merge;
  const subscribe = options.subscribe;
  const setMany = options.setMany;
  const removeMany = options.removeMany;
  const getCollections = options.getCollections;
  const setCollection = options.setCollection;
  const removeCollection = options.removeCollection;
  const getCollectionMemberships = options.getCollectionMemberships;
  const setCollectionMembership = options.setCollectionMembership;
  const removeCollectionMembership = options.removeCollectionMembership;
  return {
    getAll: async () => options.getAll(),
    ...(getCollections && setCollection && removeCollection
      ? {
          getCollections: async () => getCollections(),
          setCollection: async (collection: KeepCollectionDefinition) => setCollection(collection),
          removeCollection: async (id: string, scope?: KeepScope) => removeCollection(id, scope),
        }
      : {}),
    ...(getCollectionMemberships && setCollectionMembership && removeCollectionMembership
      ? {
          getCollectionMemberships: async () => getCollectionMemberships(),
          setCollectionMembership: async (membership: KeepCollectionMembership) => setCollectionMembership(membership),
          removeCollectionMembership: async (collectionId: string, itemId: string, scope?: KeepScope) =>
            removeCollectionMembership(collectionId, itemId, scope),
        }
      : {}),
    set: async (item) => options.set(item),
    ...(setMany ? { setMany: async (items: KeepItem<TMeta>[]) => setMany(items) } : {}),
    remove: async (id, scope) => options.remove(id, scope),
    ...(removeMany ? { removeMany: async (ids: string[], scope?: KeepScope) => removeMany(ids, scope) } : {}),
    clear: async () => options.clear(),
    ...(merge ? { merge: async (items: KeepItem<TMeta>[]) => merge(items) } : {}),
    ...(subscribe
      ? {
          subscribe: (listener: () => void) => subscribe(listener) ?? (() => undefined),
        }
      : {}),
    ...(options.storageKey ? { storageKey: options.storageKey } : {}),
  };
}

export type { KeepScope } from "../features/persistence/scope";
export { createScopedStorageAdapter, ScopedStorageAdapter } from "../features/persistence/scope";

/** An async StorageAdapter backed by browser localStorage. */
export class LocalStorageAdapter<TMeta = Record<string, unknown>> implements StorageAdapter<TMeta> {
  public readonly storageKey: string;
  private readonly storage: Storage | undefined;

  constructor(options: LocalStorageAdapterOptions = {}) {
    this.storageKey = options.key ?? DEFAULT_STORAGE_KEY;
    this.storage = options.storage ?? getBrowserStorage();
  }

  async getAll(): Promise<KeepItem<TMeta>[]> {
    if (!this.storage) return [];

    let raw: string | null;
    try {
      raw = this.storage.getItem(this.storageKey);
    } catch (cause) {
      throw new KeepStorageAccessError({
        operation: "getAll",
        storageKey: this.storageKey,
        cause,
      });
    }

    if (!raw) return [];

    try {
      const value: unknown = JSON.parse(raw);
      if (!isKeepItemArray(value)) {
        throw new KeepStorageParseError({
          operation: "getAll",
          storageKey: this.storageKey,
        });
      }
      return value as KeepItem<TMeta>[];
    } catch (cause) {
      if (cause instanceof KeepStorageParseError) throw cause;
      throw new KeepStorageParseError({
        operation: "getAll",
        storageKey: this.storageKey,
        cause,
      });
    }
  }

  async getCollections(): Promise<KeepCollectionDefinition[]> {
    if (!this.storage) return [];
    const storageKey = `${this.storageKey}:collections`;
    let raw: string | null;
    try {
      raw = this.storage.getItem(storageKey);
    } catch (cause) {
      throw new KeepStorageAccessError({ operation: "getAll", storageKey, cause });
    }
    if (!raw) return [];
    try {
      const value: unknown = JSON.parse(raw);
      if (!Array.isArray(value) || !value.every(isKeepCollectionDefinition)) {
        throw new KeepStorageParseError({ operation: "getAll", storageKey });
      }
      return value;
    } catch (cause) {
      if (cause instanceof KeepStorageParseError) throw cause;
      throw new KeepStorageParseError({ operation: "getAll", storageKey, cause });
    }
  }

  async setCollection(collection: KeepCollectionDefinition): Promise<void> {
    if (!isKeepCollectionDefinition(collection)) throw new Error("Collection id and name are required.");
    const current = await this.getCollections();
    await this.writeCollections(
      [
        ...current.filter((entry) => entry.id !== collection.id || !isSameKeepScope(entry.scope, collection.scope)),
        collection,
      ],
      "set",
    );
  }

  async removeCollection(id: string, scope?: KeepScope): Promise<void> {
    const current = await this.getCollections();
    await this.writeCollections(
      current.filter((entry) => entry.id !== id || !isSameKeepScope(entry.scope, scope)),
      "remove",
    );
    const memberships = await this.getCollectionMemberships();
    await this.writeMemberships(
      memberships.filter((membership) => membership.collectionId !== id || !isSameKeepScope(membership.scope, scope)),
      "remove",
    );
  }

  async getCollectionMemberships(): Promise<KeepCollectionMembership[]> {
    return this.readMemberships();
  }

  private readMemberships(): KeepCollectionMembership[] {
    if (!this.storage) return [];
    const storageKey = `${this.storageKey}:memberships`;
    let raw: string | null;
    try {
      raw = this.storage.getItem(storageKey);
    } catch (cause) {
      throw new KeepStorageAccessError({ operation: "getAll", storageKey, cause });
    }
    if (!raw) return [];
    try {
      const value: unknown = JSON.parse(raw);
      if (!Array.isArray(value) || !value.every(isKeepCollectionMembership)) {
        throw new KeepStorageParseError({ operation: "getAll", storageKey });
      }
      return value;
    } catch (cause) {
      if (cause instanceof KeepStorageParseError) throw cause;
      throw new KeepStorageParseError({ operation: "getAll", storageKey, cause });
    }
  }

  async setCollectionMembership(membership: KeepCollectionMembership): Promise<void> {
    if (!isKeepCollectionMembership(membership)) throw new Error("Collection membership is invalid.");
    const current = this.readMemberships();
    const sameMembership = (entry: KeepCollectionMembership) =>
      entry.collectionId === membership.collectionId &&
      entry.itemId === membership.itemId &&
      isSameKeepScope(entry.scope, membership.scope);
    await this.writeMemberships([...current.filter((entry) => !sameMembership(entry)), membership], "set");
  }

  async removeCollectionMembership(collectionId: string, itemId: string, scope?: KeepScope): Promise<void> {
    const current = this.readMemberships();
    await this.writeMemberships(
      current.filter(
        (entry) =>
          entry.collectionId !== collectionId || entry.itemId !== itemId || !isSameKeepScope(entry.scope, scope),
      ),
      "remove",
    );
  }

  async set(item: KeepItem<TMeta>): Promise<void> {
    await this.setMany([item]);
  }

  async setMany(items: KeepItem<TMeta>[]): Promise<void> {
    const current = await this.getAll();
    const byScopeAndId = new Map(current.map((item) => [getItemStorageKey(item), item]));
    for (const item of items) byScopeAndId.set(getItemStorageKey(item), item);
    this.write([...byScopeAndId.values()], "set");
  }

  async remove(id: string, scope?: KeepScope): Promise<void> {
    await this.removeMany([id], scope);
  }

  async removeMany(ids: string[], scope?: KeepScope): Promise<void> {
    const idSet = new Set(ids);
    const items = await this.getAll();
    this.write(
      items.filter((item) => !idSet.has(item.id) || (scope !== undefined && !isSameKeepScope(item.scope, scope))),
      "remove",
    );
    const memberships = await this.getCollectionMemberships();
    const membershipIds = memberships.filter(
      (membership) => idSet.has(membership.itemId) && (scope === undefined || isSameKeepScope(membership.scope, scope)),
    );
    for (const membership of membershipIds) {
      await this.removeCollectionMembership(membership.collectionId, membership.itemId, membership.scope);
    }
  }

  async clear(): Promise<void> {
    if (!this.storage) return;
    try {
      const items = await this.getAll();
      if (items.length > 0) await this.removeMany(items.map((item) => item.id));
      const memberships = await this.getCollectionMemberships();
      for (const membership of memberships) {
        await this.removeCollectionMembership(membership.collectionId, membership.itemId, membership.scope);
      }
      this.storage.removeItem(this.storageKey);
    } catch (cause) {
      throw new KeepStorageAccessError({
        operation: "clear",
        storageKey: this.storageKey,
        cause,
      });
    }
  }

  async merge(localItems: KeepItem<TMeta>[]): Promise<KeepItem<TMeta>[]> {
    const merged = mergeKeepItemLists(await this.getAll(), localItems);
    this.write(merged, "merge");
    return merged;
  }

  subscribe(listener: () => void): () => void {
    if (typeof window === "undefined") return () => undefined;

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key !== null &&
        event.key !== this.storageKey &&
        event.key !== `${this.storageKey}:collections` &&
        event.key !== `${this.storageKey}:memberships`
      )
        return;
      listener();
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }

  private write(items: KeepItem<TMeta>[], operation: KeepStorageOperation): void {
    if (!this.storage) return;
    const serialized = serializeKeepStorage(items, { operation, storageKey: this.storageKey });
    try {
      this.storage.setItem(this.storageKey, serialized);
    } catch (cause) {
      if (isQuotaExceededError(cause)) {
        throw new KeepStorageQuotaError({
          operation,
          storageKey: this.storageKey,
          cause,
        });
      }
      throw new KeepStorageAccessError({
        operation,
        storageKey: this.storageKey,
        cause,
      });
    }
  }

  private async writeCollections(
    collections: KeepCollectionDefinition[],
    operation: KeepStorageOperation,
  ): Promise<void> {
    if (!this.storage) return;
    const storageKey = `${this.storageKey}:collections`;
    const serialized = serializeKeepStorage(collections, { operation, storageKey });
    try {
      this.storage.setItem(storageKey, serialized);
    } catch (cause) {
      if (isQuotaExceededError(cause)) throw new KeepStorageQuotaError({ operation, storageKey, cause });
      throw new KeepStorageAccessError({ operation, storageKey, cause });
    }
  }

  private async writeMemberships(
    memberships: KeepCollectionMembership[],
    operation: KeepStorageOperation,
  ): Promise<void> {
    if (!this.storage) return;
    const storageKey = `${this.storageKey}:memberships`;
    const serialized = serializeKeepStorage(memberships, { operation, storageKey });
    try {
      this.storage.setItem(storageKey, serialized);
    } catch (cause) {
      if (isQuotaExceededError(cause)) throw new KeepStorageQuotaError({ operation, storageKey, cause });
      throw new KeepStorageAccessError({ operation, storageKey, cause });
    }
  }
}

/** An async StorageAdapter backed by IndexedDB, with one object store per adapter. */
export class IndexedDBAdapter<TMeta = Record<string, unknown>> implements StorageAdapter<TMeta> {
  public readonly storageKey: string;
  private readonly databaseName: string;
  private readonly storeName: string;
  private readonly version: number;
  private readonly indexedDB: IDBFactory | undefined;
  private databasePromise: Promise<IDBDatabase | undefined> | undefined;
  private collectionDatabasePromise: Promise<IDBDatabase | undefined> | undefined;

  constructor(options: IndexedDBAdapterOptions = {}) {
    this.databaseName = options.databaseName ?? options.dbName ?? options.key ?? DEFAULT_INDEXEDDB_DATABASE;
    this.storeName = options.storeName ?? DEFAULT_INDEXEDDB_STORE;
    this.version = options.version ?? 1;
    this.indexedDB = options.indexedDB ?? getBrowserIndexedDB();
    this.storageKey = `${this.databaseName}:${this.storeName}`;
  }

  async getAll(): Promise<KeepItem<TMeta>[]> {
    const database = await this.open("getAll");
    if (!database) return [];
    try {
      const transaction = database.transaction(this.storeName, "readonly");
      const value: unknown = await requestToPromise(transaction.objectStore(this.storeName).getAll());
      if (!isKeepItemArray(value)) {
        throw new KeepStorageParseError({ operation: "getAll", storageKey: this.storageKey });
      }
      return (value as KeepItem<TMeta>[]).map(decodeIndexedDBItem);
    } catch (cause) {
      if (cause instanceof KeepStorageParseError) throw cause;
      throw new KeepStorageAccessError({ operation: "getAll", storageKey: this.storageKey, cause });
    }
  }

  async getCollections(): Promise<KeepCollectionDefinition[]> {
    const database = await this.openCollections("getAll");
    if (!database) return [];
    const storageKey = `${this.storageKey}:collections`;
    try {
      const transaction = database.transaction("collections", "readonly");
      const value: unknown = await requestToPromise(transaction.objectStore("collections").getAll());
      if (
        !Array.isArray(value) ||
        !value.every((entry) => isRecord(entry) && typeof entry.key === "string" && isKeepCollectionDefinition(entry))
      ) {
        throw new KeepStorageParseError({ operation: "getAll", storageKey });
      }
      return value.map(({ key: _key, ...collection }) => collection);
    } catch (cause) {
      if (cause instanceof KeepStorageParseError) throw cause;
      throw new KeepStorageAccessError({ operation: "getAll", storageKey, cause });
    }
  }

  async setCollection(collection: KeepCollectionDefinition): Promise<void> {
    if (!isKeepCollectionDefinition(collection)) throw new Error("Collection id and name are required.");
    await this.writeCollection("set", (store) =>
      store.put({ ...collection, key: collectionKey(collection.id, collection.scope) }),
    );
  }

  async removeCollection(id: string, scope?: KeepScope): Promise<void> {
    await this.writeCollection("remove", (store) => store.delete(collectionKey(id, scope)));
    const memberships = await this.getCollectionMemberships();
    for (const membership of memberships) {
      if (membership.collectionId === id && isSameKeepScope(membership.scope, scope)) {
        await this.removeCollectionMembership(id, membership.itemId, scope);
      }
    }
  }

  async getCollectionMemberships(): Promise<KeepCollectionMembership[]> {
    const database = await this.openCollections("getAll");
    if (!database) return [];
    const storageKey = `${this.storageKey}:memberships`;
    try {
      const transaction = database.transaction("memberships", "readonly");
      const value: unknown = await requestToPromise(transaction.objectStore("memberships").getAll());
      if (
        !Array.isArray(value) ||
        !value.every((entry) => isRecord(entry) && typeof entry.key === "string" && isKeepCollectionMembership(entry))
      ) {
        throw new KeepStorageParseError({ operation: "getAll", storageKey });
      }
      return value.map(({ key: _key, ...membership }) => membership);
    } catch (cause) {
      if (cause instanceof KeepStorageParseError) throw cause;
      throw new KeepStorageAccessError({ operation: "getAll", storageKey, cause });
    }
  }

  async setCollectionMembership(membership: KeepCollectionMembership): Promise<void> {
    if (!isKeepCollectionMembership(membership)) throw new Error("Collection membership is invalid.");
    await this.writeCollectionMembership("set", (store) =>
      store.put({ ...membership, key: membershipKey(membership.collectionId, membership.itemId, membership.scope) }),
    );
  }

  async removeCollectionMembership(collectionId: string, itemId: string, scope?: KeepScope): Promise<void> {
    await this.writeCollectionMembership("remove", (store) => store.delete(membershipKey(collectionId, itemId, scope)));
  }

  async set(item: KeepItem<TMeta>): Promise<void> {
    return this.setMany([item]);
  }

  async setMany(items: KeepItem<TMeta>[]): Promise<void> {
    const database = await this.open("set");
    if (!database) return;
    try {
      const identities = new Set(items.map(getItemIdentity));
      const previous = (await this.getAll()).filter((item) => identities.has(getItemIdentity(item)));
      const transaction = database.transaction(this.storeName, "readwrite");
      const objectStore = transaction.objectStore(this.storeName);
      for (const item of previous) objectStore.delete(getStoredIndexedDBItemId(item));
      for (const item of items) objectStore.put(encodeIndexedDBItem(item));
      await transactionToPromise(transaction);
      this.notifySubscribers();
    } catch (cause) {
      if (isQuotaExceededError(cause)) {
        throw new KeepStorageQuotaError({ operation: "set", storageKey: this.storageKey, cause });
      }
      throw new KeepStorageAccessError({ operation: "set", storageKey: this.storageKey, cause });
    }
  }

  async remove(id: string, scope?: KeepScope): Promise<void> {
    return this.removeMany([id], scope);
  }

  async removeMany(ids: string[], scope?: KeepScope): Promise<void> {
    const database = await this.open("remove");
    if (!database) return;
    try {
      const idSet = new Set(ids);
      const removableIds = (await this.getAll())
        .filter((item) => idSet.has(item.id) && (scope === undefined || isSameKeepScope(item.scope, scope)))
        .map(getStoredIndexedDBItemId);
      const transaction = database.transaction(this.storeName, "readwrite");
      const objectStore = transaction.objectStore(this.storeName);
      for (const id of removableIds) objectStore.delete(id);
      await transactionToPromise(transaction);
      const memberships = await this.getCollectionMemberships();
      for (const membership of memberships) {
        if (idSet.has(membership.itemId) && (scope === undefined || isSameKeepScope(membership.scope, scope))) {
          await this.removeCollectionMembership(membership.collectionId, membership.itemId, membership.scope);
        }
      }
      this.notifySubscribers();
    } catch (cause) {
      throw new KeepStorageAccessError({ operation: "remove", storageKey: this.storageKey, cause });
    }
  }

  async clear(): Promise<void> {
    const database = await this.open("clear");
    if (!database) return;
    try {
      const items = await this.getAll();
      if (items.length > 0) await this.removeMany(items.map((item) => item.id));
      const memberships = await this.getCollectionMemberships();
      for (const membership of memberships) {
        await this.removeCollectionMembership(membership.collectionId, membership.itemId, membership.scope);
      }
      const transaction = database.transaction(this.storeName, "readwrite");
      transaction.objectStore(this.storeName).clear();
      await transactionToPromise(transaction);
      this.notifySubscribers();
    } catch (cause) {
      throw new KeepStorageAccessError({ operation: "clear", storageKey: this.storageKey, cause });
    }
  }

  async merge(localItems: KeepItem<TMeta>[]): Promise<KeepItem<TMeta>[]> {
    try {
      const merged = mergeKeepItemLists(await this.getAll(), localItems);
      await this.setMany(merged);
      return merged;
    } catch (cause) {
      if (cause instanceof KeepStorageError) throw cause;
      throw new KeepStorageAccessError({ operation: "merge", storageKey: this.storageKey, cause });
    }
  }

  subscribe(listener: () => void): () => void {
    if (!this.indexedDB || typeof BroadcastChannel === "undefined") return () => undefined;
    const channel = new BroadcastChannel(`keepkit:${this.storageKey}`);
    channel.onmessage = () => listener();
    return () => channel.close();
  }

  private notifySubscribers(): void {
    if (!this.indexedDB || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(`keepkit:${this.storageKey}`);
    channel.postMessage({ type: "keepkit:changed" });
    channel.close();
  }

  private async writeCollection(
    operation: KeepStorageOperation,
    write: (store: IDBObjectStore) => void,
  ): Promise<void> {
    const database = await this.openCollections(operation);
    if (!database) return;
    const storageKey = `${this.storageKey}:collections`;
    try {
      const transaction = database.transaction("collections", "readwrite");
      write(transaction.objectStore("collections"));
      await transactionToPromise(transaction);
      this.notifySubscribers();
    } catch (cause) {
      if (isQuotaExceededError(cause)) throw new KeepStorageQuotaError({ operation, storageKey, cause });
      throw new KeepStorageAccessError({ operation, storageKey, cause });
    }
  }

  private async writeCollectionMembership(
    operation: KeepStorageOperation,
    write: (store: IDBObjectStore) => void,
  ): Promise<void> {
    const database = await this.openCollections(operation);
    if (!database) return;
    const storageKey = `${this.storageKey}:memberships`;
    try {
      const transaction = database.transaction("memberships", "readwrite");
      write(transaction.objectStore("memberships"));
      await transactionToPromise(transaction);
      this.notifySubscribers();
    } catch (cause) {
      if (isQuotaExceededError(cause)) throw new KeepStorageQuotaError({ operation, storageKey, cause });
      throw new KeepStorageAccessError({ operation, storageKey, cause });
    }
  }

  private openCollections(operation: KeepStorageOperation): Promise<IDBDatabase | undefined> {
    if (!this.indexedDB) return Promise.resolve(undefined);
    const storageKey = `${this.storageKey}:collections`;
    if (!this.collectionDatabasePromise) {
      this.collectionDatabasePromise = new Promise((resolve, reject) => {
        let request: IDBOpenDBRequest;
        try {
          request = this.indexedDB?.open(storageKey, 2) as IDBOpenDBRequest;
        } catch (cause) {
          reject(cause);
          return;
        }
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains("collections")) {
            request.result.createObjectStore("collections", { keyPath: "key" });
          }
          if (!request.result.objectStoreNames.contains("memberships")) {
            request.result.createObjectStore("memberships", { keyPath: "key" });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(request.error ?? new Error("IndexedDB collection storage open was blocked."));
      });
    }
    return this.collectionDatabasePromise.catch((cause) => {
      this.collectionDatabasePromise = undefined;
      throw new KeepStorageAccessError({ operation, storageKey, cause });
    });
  }

  private open(operation: KeepStorageOperation): Promise<IDBDatabase | undefined> {
    if (!this.indexedDB) return Promise.resolve(undefined);
    if (!this.databasePromise) {
      this.databasePromise = new Promise((resolve, reject) => {
        let request: IDBOpenDBRequest;
        try {
          request = this.indexedDB?.open(this.databaseName, this.version) as IDBOpenDBRequest;
        } catch (cause) {
          reject(new KeepStorageAccessError({ operation, storageKey: this.storageKey, cause }));
          return;
        }
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(this.storeName)) {
            request.result.createObjectStore(this.storeName, { keyPath: "id" });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(request.error ?? new Error("IndexedDB open was blocked."));
      });
    }
    return this.databasePromise.catch((cause) => {
      this.databasePromise = undefined;
      if (cause instanceof KeepStorageError) throw cause;
      throw new KeepStorageAccessError({ operation, storageKey: this.storageKey, cause });
    });
  }
}

const indexedDBStoredItemIds = new WeakMap<object, string>();

function encodeIndexedDBItem<TMeta>(item: KeepItem<TMeta>): Record<string, unknown> {
  if (!item.scope) return item;
  return {
    ...item,
    id: createScopedIndexedDBItemId(item),
    __keepkitOriginalId: item.id,
  };
}

function decodeIndexedDBItem<TMeta>(item: KeepItem<TMeta>): KeepItem<TMeta> {
  const originalId = (item as KeepItem<TMeta> & { __keepkitOriginalId?: unknown }).__keepkitOriginalId;
  const isEncoded =
    typeof originalId === "string" &&
    item.scope !== undefined &&
    item.id === createScopedIndexedDBItemId({ ...item, id: originalId });
  const { __keepkitOriginalId: _encodedOriginalId, ...record } = item as KeepItem<TMeta> & {
    __keepkitOriginalId?: unknown;
  };
  const decoded = isEncoded ? { ...record, id: originalId as string } : item;
  indexedDBStoredItemIds.set(decoded, item.id);
  return decoded;
}

function getStoredIndexedDBItemId<TMeta>(item: KeepItem<TMeta>): string {
  return indexedDBStoredItemIds.get(item) ?? createScopedIndexedDBItemId(item);
}

function createScopedIndexedDBItemId(item: Pick<KeepItem, "id" | "scope">): string {
  if (!item.scope) return item.id;
  return `\u0000keepkit-scope:${JSON.stringify([item.scope.tenantId ?? null, item.scope.userId ?? null, item.id])}`;
}

function getItemIdentity(item: Pick<KeepItem, "id" | "scope">): string {
  return JSON.stringify([item.scope?.tenantId ?? null, item.scope?.userId ?? null, item.id]);
}

function collectionKey(id: string, scope?: KeepScope): string {
  return JSON.stringify([scope?.tenantId ?? null, scope?.userId ?? null, id]);
}

function getItemStorageKey(item: Pick<KeepItem, "id" | "scope">): string {
  return JSON.stringify([item.scope?.tenantId ?? null, item.scope?.userId ?? null, item.id]);
}

function membershipKey(collectionId: string, itemId: string, scope?: KeepScope): string {
  return JSON.stringify([scope?.tenantId ?? null, scope?.userId ?? null, collectionId, itemId]);
}

function getBrowserStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function getBrowserIndexedDB(): IDBFactory | undefined {
  if (typeof indexedDB === "undefined") return undefined;
  return indexedDB;
}

function isRecoverableStorageError(error: unknown): boolean {
  return error instanceof KeepStorageAccessError || error instanceof KeepStorageQuotaError;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
  });
}

function isQuotaExceededError(cause: unknown): boolean {
  if (!isRecord(cause)) return false;
  return (
    cause.name === "QuotaExceededError" ||
    cause.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    cause.code === 22 ||
    cause.code === 1014
  );
}

export { ScopedSyncQueueAdapter } from "../features/persistence/scope";
export {
  DEFAULT_SYNC_QUEUE_DATABASE,
  DEFAULT_SYNC_QUEUE_KEY,
  DEFAULT_SYNC_QUEUE_STORE,
  FallbackSyncQueueAdapter,
  type FallbackSyncQueueAdapterOptions,
  IndexedDBSyncQueueAdapter,
  type IndexedDBSyncQueueOptions,
  LocalStorageSyncQueueAdapter,
  type LocalStorageSyncQueueOptions,
  SyncStorageAdapter,
  type SyncStorageAdapterOptions,
} from "./sync";
