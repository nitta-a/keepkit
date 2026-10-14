import {
  type KeepCollectionDefinition,
  type KeepCollectionMembership,
  type KeepItem,
  KeepStorageAccessError,
  KeepStorageParseError,
  KeepStorageQuotaError,
  type StorageAdapter,
} from "../features/items/types";
import { KEEP_BACKUP_FORMAT, KEEP_BACKUP_VERSION, type KeepBackupV2 } from "../features/persistence/backup";
import {
  isKeepCollectionDefinition,
  isKeepCollectionMembership,
  isKeepItem,
  isKeepItemArray,
  isRecord,
  mergeKeepItemLists,
  persistKeepItems,
} from "../features/persistence/helpers";
import { isSameKeepScope, type KeepScope } from "../features/persistence/scope";
import { serializeKeepStorage } from "../features/persistence/serialization";
import { withLocalStorageWriteLock } from "../features/persistence/write-lock";

export type FallbackRecoveryOperation<TMeta = Record<string, unknown>> =
  | { type: "setItems"; items: KeepItem<TMeta>[] }
  | { type: "removeItems"; ids: string[]; scope?: KeepScope }
  | { type: "clearItems" }
  | { type: "setCollection"; collection: KeepCollectionDefinition }
  | { type: "removeCollection"; id: string; scope?: KeepScope }
  | { type: "setMembership"; membership: KeepCollectionMembership }
  | { type: "removeMembership"; collectionId: string; itemId: string; scope?: KeepScope };

export type FallbackRecoverySnapshot<TMeta = Record<string, unknown>> = {
  items: KeepItem<TMeta>[];
  collections: KeepCollectionDefinition[];
  memberships: KeepCollectionMembership[];
  capabilities: { collections: boolean; memberships: boolean };
  capturedAt: number;
};

export type FallbackRecoveryJournalV2<TMeta = Record<string, unknown>> = {
  version: 2;
  operations: FallbackRecoveryOperation<TMeta>[];
  snapshot?: FallbackRecoverySnapshot<TMeta>;
  archives?: FallbackRecoverySnapshot<TMeta>[];
  backups?: KeepBackupV2<TMeta>[];
  /** An established primary history must never import old fallback deletions again. */
  initialized?: boolean;
};

export type FallbackRecoveryJournalState<TMeta = Record<string, unknown>> =
  | { version: 1; operations: FallbackRecoveryOperation<TMeta>[] }
  | FallbackRecoveryJournalV2<TMeta>;

export interface FallbackRecoveryJournal<TMeta = Record<string, unknown>> {
  read(): Promise<FallbackRecoveryJournalState<TMeta> | undefined>;
  write(state: FallbackRecoveryJournalState<TMeta>): Promise<void>;
  /** Use one backend-wide lock across every scope's journal and adapter operations. */
  runExclusive<T>(operation: () => Promise<T>): Promise<T>;
  subscribe?(listener: () => void): () => void;
}

export type KeepRecoveryState = {
  source: "primary" | "fallback";
  pendingOperations: number;
  snapshotStale: boolean;
  capturedAt?: number;
  issue?: unknown;
  repairSupported: boolean;
};
export type KeepRecoveryResult = { status: "applied" | "pending"; pendingOperations: number };
export type KeepRecoveryRow<TMeta = Record<string, unknown>> = {
  key: string;
  kind: "item" | "collection" | "membership";
  id: string;
  candidates: Array<{
    source: string;
    value: KeepItem<TMeta> | KeepCollectionDefinition | KeepCollectionMembership;
  }>;
  conflict: boolean;
  selectedSource?: string;
};
export type KeepRecoveryInspection<TMeta = Record<string, unknown>> = {
  token: string;
  sources: Array<{ id: string; label: string; snapshot: FallbackRecoverySnapshot<TMeta> }>;
  rows: KeepRecoveryRow<TMeta>[];
  issues: string[];
  operations: FallbackRecoveryOperation<TMeta>[];
  backups: KeepBackupV2<TMeta>[];
  retainedBackups?: KeepBackupV2<TMeta>[];
};
export interface KeepStorageRecovery<TMeta = Record<string, unknown>> {
  getState(): KeepRecoveryState;
  subscribe(listener: () => void): () => void;
  inspect?(options?: { selections?: Record<string, string> }): Promise<KeepRecoveryInspection<TMeta>>;
  apply?(options: { token: string; selections: Record<string, string> }): Promise<KeepRecoveryResult>;
  retry?(): Promise<KeepRecoveryResult>;
}

class RecoveryLockUnavailableError extends KeepStorageAccessError {}

/** A sidecar journal; storage and lock keys deliberately have separate scopes. */
export class LocalStorageRecoveryJournal<TMeta = Record<string, unknown>> implements FallbackRecoveryJournal<TMeta> {
  constructor(
    private readonly key: string,
    private readonly storage: Storage | undefined,
    private readonly lockKey: string = key,
  ) {}

  async read(): Promise<FallbackRecoveryJournalState<TMeta> | undefined> {
    let raw: string | null;
    try {
      raw = this.storage?.getItem(this.key) ?? null;
    } catch (cause) {
      throw new KeepStorageAccessError({ operation: "getAll", storageKey: this.key, cause });
    }
    if (raw === null) return undefined;
    try {
      return parseRecoveryState<TMeta>(JSON.parse(raw), this.key);
    } catch (cause) {
      if (cause instanceof KeepStorageParseError) throw cause;
      throw new KeepStorageParseError({ operation: "getAll", storageKey: this.key, cause });
    }
  }

  async write(state: FallbackRecoveryJournalState<TMeta>): Promise<void> {
    if (!this.storage) throw new KeepStorageAccessError({ operation: "set", storageKey: this.key });
    const serialized = serializeKeepStorage(state, { operation: "set", storageKey: this.key });
    try {
      this.storage.setItem(this.key, serialized);
    } catch (cause) {
      if (isRecord(cause) && (cause.name === "QuotaExceededError" || cause.code === 22)) {
        throw new KeepStorageQuotaError({ operation: "set", storageKey: this.key, cause });
      }
      throw new KeepStorageAccessError({ operation: "set", storageKey: this.key, cause });
    }
  }

  runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    return withLocalStorageWriteLock(
      this.lockKey,
      async () => {
        // Firefox commits localStorage snapshots at task boundaries, so keep the lock across both boundaries.
        if (typeof window !== "undefined") await nextStorageTask();
        try {
          return await operation();
        } finally {
          if (typeof window !== "undefined") await nextStorageTask();
        }
      },
      new RecoveryLockUnavailableError({ operation: "set", storageKey: this.key }),
    );
  }

  subscribe(listener: () => void): () => void {
    if (typeof window === "undefined") return () => undefined;
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === this.key) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }
}

function nextStorageTask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

type RecoveryOptions<TMeta> = {
  primary?: StorageAdapter<TMeta>;
  fallback: StorageAdapter<TMeta>;
  journal: FallbackRecoveryJournal<TMeta>;
  scope?: KeepScope;
  migrateFallbackOnEmpty: boolean;
  shouldFallback: (error: unknown) => boolean;
  mirrorWrites: boolean;
  onSourceChange: (source: "primary" | "fallback", error?: unknown) => void;
  onError: (error: unknown) => void;
};
type Notify = (notification: () => void) => void;
type RecoveryResult<TMeta> = { ready: false } | { ready: true; snapshot?: FallbackRecoverySnapshot<TMeta> };

export class RecoveryJournalController<TMeta> implements KeepStorageRecovery<TMeta> {
  hasJournal = false;
  private readonly listeners = new Set<() => void>();
  private unsubscribeExternal?: () => void;
  private state: KeepRecoveryState;

  constructor(private readonly options: RecoveryOptions<TMeta>) {
    this.state = {
      source: options.primary ? "primary" : "fallback",
      pendingOperations: 0,
      snapshotStale: true,
      repairSupported: true,
    };
  }

  getState(): KeepRecoveryState {
    return { ...this.state };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    this.unsubscribeExternal ??= this.options.journal.subscribe?.(() => {
      void this.refreshExternalState();
    });
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.unsubscribeExternal?.();
        this.unsubscribeExternal = undefined;
      }
    };
  }

  subscribeJournalChanges(listener: () => void): () => void {
    return this.options.journal.subscribe?.(listener) ?? (() => undefined);
  }

  private async refreshExternalState(): Promise<void> {
    try {
      const loaded = await this.options.journal.read();
      if (!loaded) return;
      const state = parseRecoveryState<TMeta>(loaded);
      const next: FallbackRecoveryJournalV2<TMeta> =
        state.version === 2 ? state : { version: 2, operations: state.operations, initialized: true };
      this.validateScope(next);
      this.hasJournal = true;
      const pending = next.operations.length > 0;
      this.state = {
        source: pending || !this.options.primary ? "fallback" : "primary",
        pendingOperations: next.operations.length,
        snapshotStale: pending || !next.snapshot,
        capturedAt: next.snapshot?.capturedAt,
        repairSupported: true,
      };
    } catch (issue) {
      this.state = { ...this.state, snapshotStale: true, issue };
    }
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        /* A status observer cannot break another observer. */
      }
    }
  }

  readItems(): Promise<KeepItem<TMeta>[]> {
    return this.read(
      (adapter) => adapter.getAll(),
      overlayItems,
      (snapshot) => snapshot.items,
    );
  }
  readCollections(): Promise<KeepCollectionDefinition[]> {
    return this.read(
      (adapter) => adapter.getCollections?.() ?? Promise.resolve([]),
      overlayCollections,
      (snapshot) => snapshot.collections,
    );
  }
  readMemberships(): Promise<KeepCollectionMembership[]> {
    return this.read(
      (adapter) => adapter.getCollectionMemberships?.() ?? Promise.resolve([]),
      overlayMemberships,
      (snapshot) => snapshot.memberships,
    );
  }

  write(
    operation: FallbackRecoveryOperation<TMeta>,
    execute: (adapter: StorageAdapter<TMeta>) => Promise<void> = (adapter) =>
      applyRecoveryOperation(adapter, operation),
  ): Promise<void> {
    return this.run(async (state, locked, notify) => {
      const { ready } = await this.preparePrimaryWrite(state, locked, notify);
      if (ready && this.options.primary) {
        let committed = false;
        try {
          await execute(this.options.primary);
          committed = true;
        } catch (cause) {
          if (!this.options.shouldFallback(cause)) throw cause;
          this.setSource("fallback", cause, notify);
        }
        if (committed) {
          // Checkpoint, mirror and observer failures cannot undo a primary commit.
          const canMirror = await this.refresh(state, locked, notify);
          if (canMirror) await this.mirror(operation, execute, notify);
          this.setSource("primary", undefined, notify);
          return;
        }
      }
      await this.commitFallback(state, operation, locked, notify);
    });
  }

  merge(items: KeepItem<TMeta>[]): Promise<KeepItem<TMeta>[]> {
    return this.run(async (state, locked, notify) => {
      const { ready } = await this.preparePrimaryWrite(state, locked, notify);
      const primary = this.options.primary;
      if (ready && primary) {
        let merged: KeepItem<TMeta>[] | undefined;
        try {
          const candidate = primary.merge
            ? await primary.merge(items)
            : mergeKeepItemLists(await primary.getAll(), items);
          if (!primary.merge) await persistKeepItems(primary, candidate);
          merged = candidate;
        } catch (cause) {
          if (!this.options.shouldFallback(cause)) throw cause;
          this.setSource("fallback", cause, notify);
        }
        if (merged) {
          const canMirror = await this.refresh(state, locked, notify);
          if (canMirror) await this.mirror({ type: "setItems", items: merged }, undefined, notify);
          this.setSource("primary", undefined, notify);
          return merged;
        }
      }
      const current = state.snapshot?.items ?? (await this.options.fallback.getAll());
      const merged = mergeKeepItemLists(overlayItems(current, state.operations), items);
      await this.commitFallback(state, { type: "setItems", items: merged }, locked, notify);
      return merged;
    });
  }

  inspect(options: { selections?: Record<string, string> } = {}): Promise<KeepRecoveryInspection<TMeta>> {
    return this.run((state) => this.inspection(state, options.selections ?? {}));
  }

  apply(options: { token: string; selections: Record<string, string> }): Promise<KeepRecoveryResult> {
    return this.run(async (state, locked, notify) => {
      if (!locked) throw new RecoveryLockUnavailableError({ operation: "set" });
      if (state.operations.length > 0)
        throw new Error("Recovery is pending. Retry the saved operations before submitting another repair.");
      const inspection = await this.inspection(state, options.selections);
      if (inspection.token !== options.token)
        throw new Error("Recovery data changed. Inspect it again before applying.");
      if (inspection.issues.length > 0) throw new Error("Resolve recovery conflicts and dependencies before applying.");
      if (inspection.operations.length === 0) return { status: "applied", pendingOperations: 0 };
      const next = this.normalized({
        ...state,
        operations: [...state.operations, ...inspection.operations],
        backups: [...(state.backups ?? []), ...inspection.backups],
        initialized: true,
      });
      // Both the complete approved sequence and the backups commit before replay starts.
      await this.options.journal.write(next);
      Object.assign(state, next);
      this.hasJournal = true;
      this.updateState(state, notify);
      const result = await this.recover(state, locked, notify);
      return { status: result.ready ? "applied" : "pending", pendingOperations: state.operations.length };
    });
  }

  retry(): Promise<KeepRecoveryResult> {
    return this.run(async (state, locked, notify) => {
      if (!locked) throw new RecoveryLockUnavailableError({ operation: "set" });
      const result = await this.recover(state, locked, notify);
      if (result.ready) await this.refresh(state, locked, notify);
      return { status: result.ready ? "applied" : "pending", pendingOperations: state.operations.length };
    });
  }

  private read<T>(
    read: (adapter: StorageAdapter<TMeta>) => Promise<T>,
    overlay: (value: T, operations: FallbackRecoveryOperation<TMeta>[]) => T,
    fromSnapshot: (snapshot: FallbackRecoverySnapshot<TMeta>) => T,
  ): Promise<T> {
    return this.run(async (state, locked, notify) => {
      const result = await this.recover(state, locked, notify);
      if (result.ready && this.options.primary) {
        if (result.snapshot) return fromSnapshot(result.snapshot);
        try {
          const snapshot = await this.capture(this.options.primary);
          const migration = await this.bootstrap(state, snapshot, locked, notify);
          if (!migration.ready) return overlay(fromSnapshot(state.snapshot ?? snapshot), state.operations);
          const current = migration.snapshot ?? snapshot;
          await this.refresh(state, locked, notify, current);
          this.setSource("primary", undefined, notify);
          return fromSnapshot(current);
        } catch (cause) {
          // A failed metadata capture must not hide a successful item read.
          this.degraded(cause, notify);
          try {
            const value = await read(this.options.primary);
            this.setSource("primary", undefined, notify);
            return value;
          } catch (readCause) {
            if (!this.options.shouldFallback(readCause)) throw readCause;
            this.setSource("fallback", readCause, notify);
          }
        }
      }
      const base = state.snapshot ? fromSnapshot(state.snapshot) : await read(this.options.fallback);
      return overlay(base, state.operations);
    });
  }

  private async run<T>(
    operation: (state: FallbackRecoveryJournalV2<TMeta>, locked: boolean, notify: Notify) => Promise<T>,
  ): Promise<T> {
    const notifications: Array<() => void> = [];
    const execute = async (locked: boolean) => {
      const loaded = await this.options.journal.read();
      this.hasJournal = loaded !== undefined;
      const parsed = loaded ? parseRecoveryState<TMeta>(loaded) : undefined;
      const state: FallbackRecoveryJournalV2<TMeta> =
        parsed?.version === 2
          ? parsed
          : { version: 2, operations: parsed?.operations ?? [], initialized: parsed !== undefined };
      this.validateScope(state);
      this.updateState(state, (notification) => notifications.push(notification));
      return operation(state, locked, (notification) => notifications.push(notification));
    };
    try {
      try {
        return await this.options.journal.runExclusive(() => execute(true));
      } catch (cause) {
        if (!(cause instanceof RecoveryLockUnavailableError)) throw cause;
        return await execute(false);
      }
    } finally {
      for (const notification of notifications) {
        try {
          notification();
        } catch {
          /* Observers cannot reject committed mutations. */
        }
      }
    }
  }

  private async capture(adapter: StorageAdapter<TMeta>): Promise<FallbackRecoverySnapshot<TMeta>> {
    const snapshot = {
      items: await adapter.getAll(),
      collections: (await adapter.getCollections?.()) ?? [],
      memberships: (await adapter.getCollectionMemberships?.()) ?? [],
      capabilities: {
        collections: Boolean(adapter.getCollections),
        memberships: Boolean(adapter.getCollectionMemberships),
      },
      capturedAt: Date.now(),
    };
    this.validateSnapshotScope(snapshot);
    return snapshot;
  }

  private async bootstrap(
    state: FallbackRecoveryJournalV2<TMeta>,
    snapshot: FallbackRecoverySnapshot<TMeta>,
    locked: boolean,
    notify: Notify,
  ): Promise<RecoveryResult<TMeta>> {
    if (state.initialized || !this.options.migrateFallbackOnEmpty || !this.options.primary || !locked)
      return { ready: true, snapshot };
    const legacy = await this.capture(this.options.fallback);
    const operations: FallbackRecoveryOperation<TMeta>[] = [];
    if (snapshot.items.length === 0 && legacy.items.length > 0)
      operations.push({ type: "setItems", items: legacy.items });
    if (snapshot.collections.length === 0 && legacy.collections.length > 0 && this.options.primary.setCollection) {
      for (const collection of legacy.collections) operations.push({ type: "setCollection", collection });
    }
    if (
      snapshot.memberships.length === 0 &&
      legacy.memberships.length > 0 &&
      this.options.primary.setCollectionMembership
    ) {
      for (const membership of legacy.memberships) operations.push({ type: "setMembership", membership });
    }
    if (operations.length === 0) return { ready: true, snapshot };
    // Partial migrations replay from the durable log even once the primary is nonempty.
    const next = this.normalized({ ...state, snapshot, archives: [legacy], operations, initialized: true });
    await this.options.journal.write(next);
    Object.assign(state, next);
    this.hasJournal = true;
    this.updateState(state, notify);
    return this.recover(state, locked, notify);
  }

  private async preparePrimaryWrite(
    state: FallbackRecoveryJournalV2<TMeta>,
    locked: boolean,
    notify: Notify,
  ): Promise<RecoveryResult<TMeta>> {
    const result = await this.recover(state, locked, notify);
    if (!result.ready || state.initialized || !this.options.migrateFallbackOnEmpty || !this.options.primary || !locked)
      return result;
    let snapshot: FallbackRecoverySnapshot<TMeta>;
    try {
      snapshot = await this.capture(this.options.primary);
    } catch (cause) {
      if (!this.options.shouldFallback(cause)) throw cause;
      this.degraded(cause, notify);
      return { ready: false };
    }
    // The first mutation must not make an empty primary look like established history.
    return this.bootstrap(state, snapshot, locked, notify);
  }

  private async refresh(
    state: FallbackRecoveryJournalV2<TMeta>,
    locked: boolean,
    notify: Notify,
    supplied?: FallbackRecoverySnapshot<TMeta>,
  ): Promise<boolean> {
    try {
      if (!this.options.primary) return false;
      if (!locked) throw new RecoveryLockUnavailableError({ operation: "set" });
      const snapshot = supplied ?? (await this.capture(this.options.primary));
      const archives = state.archives ?? [await this.capture(this.options.fallback)];
      const next = this.normalized({ ...state, snapshot, archives, initialized: true });
      const unchanged =
        state.initialized &&
        state.archives !== undefined &&
        state.snapshot &&
        snapshotContent(state.snapshot) === snapshotContent(snapshot);
      if (!unchanged) {
        await this.options.journal.write(next);
        Object.assign(state, next);
        this.hasJournal = true;
      }
      this.updateState(state, notify, false);
      return true;
    } catch (cause) {
      this.degraded(cause, notify);
      // Mirroring must not overwrite a legacy branch before its archive is durable.
      return state.archives !== undefined;
    }
  }

  private async recover(
    state: FallbackRecoveryJournalV2<TMeta>,
    locked: boolean,
    notify: Notify,
  ): Promise<RecoveryResult<TMeta>> {
    const primary = this.options.primary;
    if (!primary) {
      this.setSource("fallback", undefined, notify);
      return { ready: false };
    }
    if (state.operations.length === 0) return { ready: true };
    this.setSource("fallback", undefined, notify);
    if (!locked) return { ready: false };
    const replayedOperations = state.operations;
    let snapshot: FallbackRecoverySnapshot<TMeta>;
    try {
      for (const operation of state.operations) await applyRecoveryOperation(primary, operation);
      snapshot = await this.capture(primary);
      const archives = state.archives ?? [await this.capture(this.options.fallback)];
      const next = this.normalized({ ...state, snapshot, archives, operations: [], initialized: true });
      await this.options.journal.write(next);
      Object.assign(state, next);
    } catch (cause) {
      this.degraded(cause, notify);
      return { ready: false };
    }
    this.updateState(state, notify, false);
    for (const operation of replayedOperations) await this.mirror(operation, undefined, notify);
    this.setSource("primary", undefined, notify);
    return { ready: true, snapshot };
  }

  private async commitFallback(
    state: FallbackRecoveryJournalV2<TMeta>,
    operation: FallbackRecoveryOperation<TMeta>,
    locked: boolean,
    notify: Notify,
  ): Promise<void> {
    if (!locked) throw new RecoveryLockUnavailableError({ operation: "set" });
    const next = this.normalized({ ...state, operations: [...state.operations, operation] });
    this.validateScope(next);
    await this.options.journal.write(next);
    this.hasJournal = true;
    Object.assign(state, next);
    this.updateState(state, notify);
    this.setSource("fallback", undefined, notify);
    notify(() => this.options.onSourceChange("fallback"));
    try {
      for (const pending of next.operations) await applyRecoveryOperation(this.options.fallback, pending);
    } catch (cause) {
      this.degraded(cause, notify);
    }
  }

  private normalized(state: FallbackRecoveryJournalV2<TMeta>): FallbackRecoveryJournalV2<TMeta> {
    const value: unknown = JSON.parse(serializeKeepStorage(state, { operation: "set" }));
    const parsed = parseRecoveryState<TMeta>(value);
    if (parsed.version !== 2) throw new KeepStorageParseError({ operation: "set" });
    return parsed;
  }

  private async mirror(
    operation: FallbackRecoveryOperation<TMeta>,
    execute: ((adapter: StorageAdapter<TMeta>) => Promise<void>) | undefined,
    notify: Notify,
  ): Promise<void> {
    if (!this.options.mirrorWrites) return;
    try {
      await (execute ? execute(this.options.fallback) : applyRecoveryOperation(this.options.fallback, operation));
    } catch (cause) {
      this.degraded(cause, notify);
    }
  }

  private setSource(source: "primary" | "fallback", error: unknown, notify: Notify): void {
    if (this.state.source === source) return;
    this.state = { ...this.state, source };
    notify(() => this.options.onSourceChange(source, error));
    for (const listener of this.listeners) notify(listener);
  }
  private degraded(issue: unknown, notify: Notify): void {
    const identity = (error: unknown) => (error instanceof Error ? `${error.name}:${error.message}` : String(error));
    if (this.state.snapshotStale && this.state.issue !== undefined && identity(this.state.issue) === identity(issue))
      return;
    this.state = { ...this.state, snapshotStale: true, issue };
    notify(() => this.options.onError(issue));
    for (const listener of this.listeners) notify(listener);
  }
  private updateState(
    state: FallbackRecoveryJournalV2<TMeta>,
    notify: Notify,
    stale = state.operations.length > 0 || this.state.snapshotStale,
  ): void {
    const next = {
      ...this.state,
      pendingOperations: state.operations.length,
      capturedAt: state.snapshot?.capturedAt,
      snapshotStale: stale,
    };
    if (!stale) delete next.issue;
    if (
      next.pendingOperations === this.state.pendingOperations &&
      next.capturedAt === this.state.capturedAt &&
      next.snapshotStale === this.state.snapshotStale
    )
      return;
    this.state = next;
    for (const listener of this.listeners) notify(listener);
  }
  private validateSnapshotScope(snapshot: FallbackRecoverySnapshot<TMeta>): void {
    if (!this.options.scope) return;
    if (
      [...snapshot.items, ...snapshot.collections, ...snapshot.memberships].some(
        (record) => !isSameKeepScope(record.scope, this.options.scope),
      )
    ) {
      throw new KeepStorageParseError({ operation: "getAll" });
    }
  }
  private validateScope(state: FallbackRecoveryJournalV2<TMeta>): void {
    for (const snapshot of [state.snapshot, ...(state.archives ?? [])])
      if (snapshot) this.validateSnapshotScope(snapshot);
    for (const backup of state.backups ?? [])
      this.validateSnapshotScope({
        ...backup,
        capabilities: { collections: true, memberships: true },
        capturedAt: backup.exportedAt,
      });
    if (!this.options.scope) return;
    if (state.backups?.some((backup) => backup.scopes?.some((scope) => !isSameKeepScope(scope, this.options.scope)))) {
      throw new KeepStorageParseError({ operation: "getAll" });
    }
    for (const operation of state.operations) {
      if (operation.type === "setItems") {
        if (operation.items.some((item) => !isSameKeepScope(item.scope, this.options.scope)))
          throw new KeepStorageParseError({ operation: "getAll" });
      } else if (operation.type === "setCollection") {
        if (!isSameKeepScope(operation.collection.scope, this.options.scope))
          throw new KeepStorageParseError({ operation: "getAll" });
      } else if (operation.type === "setMembership") {
        if (!isSameKeepScope(operation.membership.scope, this.options.scope))
          throw new KeepStorageParseError({ operation: "getAll" });
      } else if (operation.type !== "clearItems" && !isSameKeepScope(operation.scope, this.options.scope))
        throw new KeepStorageParseError({ operation: "getAll" });
    }
  }

  private async inspection(
    state: FallbackRecoveryJournalV2<TMeta>,
    selections: Record<string, string>,
  ): Promise<KeepRecoveryInspection<TMeta>> {
    const sources: KeepRecoveryInspection<TMeta>["sources"] = [];
    const issues: string[] = [];
    for (const [id, adapter] of [
      ["primary", this.options.primary],
      ["fallback", this.options.fallback],
    ] as const) {
      if (!adapter) continue;
      try {
        sources.push({ id, label: id, snapshot: { ...(await this.capture(adapter)), capturedAt: 0 } });
      } catch (cause) {
        issues.push(`source-unavailable:${id}:${cause instanceof Error ? cause.message : String(cause)}`);
      }
    }
    if (state.snapshot)
      sources.push({
        id: "checkpoint",
        label: "checkpoint",
        snapshot: overlaySnapshot(state.snapshot, state.operations),
      });
    else if (state.operations.length > 0) {
      const fallback = sources.find((source) => source.id === "fallback");
      if (fallback)
        sources.push({
          id: "checkpoint",
          label: "checkpoint",
          snapshot: overlaySnapshot(fallback.snapshot, state.operations),
        });
    }
    for (const [index, snapshot] of (state.archives ?? []).entries())
      sources.push({ id: `legacy:${index}`, label: `legacy:${index}`, snapshot });
    const token = serializeKeepStorage({ scope: this.options.scope, state, sources }, { operation: "getAll" });
    const rows = buildRows(sources, selections, issues);
    const desired: FallbackRecoverySnapshot<TMeta> = {
      items: [],
      collections: [],
      memberships: [],
      capabilities: { collections: true, memberships: true },
      capturedAt: Date.now(),
    };
    for (const row of rows) {
      const candidate = row.candidates.find((entry) => entry.source === row.selectedSource);
      if (!candidate) continue;
      if (row.kind === "item" && isRecoveryItem<TMeta>(candidate.value)) desired.items.push(candidate.value);
      if (row.kind === "collection" && isKeepCollectionDefinition(candidate.value))
        desired.collections.push(candidate.value);
      if (row.kind === "membership" && isKeepCollectionMembership(candidate.value))
        desired.memberships.push(candidate.value);
    }
    const removedCollections = rows.filter((row) => row.kind === "collection" && row.selectedSource === "__remove__");
    const removedItems = rows.filter((row) => row.kind === "item" && row.selectedSource === "__remove__");
    desired.items = desired.items.map((item) => {
      if (!item.collectionId) return item;
      const exists = desired.collections.some(
        (collection) => collection.id === item.collectionId && isSameKeepScope(collection.scope, item.scope),
      );
      if (exists) return item;
      if (removedCollections.some((row) => row.key === recordKey("collection", item.collectionId ?? "", item.scope))) {
        const { collectionId: _collectionId, ...unassigned } = item;
        return unassigned;
      }
      issues.push(`missing-collection:${item.id}:${item.collectionId}`);
      return item;
    });
    desired.memberships = desired.memberships.filter((membership) => {
      const itemExists = desired.items.some(
        (item) => item.id === membership.itemId && isSameKeepScope(item.scope, membership.scope),
      );
      const collectionExists = desired.collections.some(
        (collection) =>
          collection.id === membership.collectionId && isSameKeepScope(collection.scope, membership.scope),
      );
      if (itemExists && collectionExists) return true;
      if (
        removedItems.some((row) => row.key === recordKey("item", membership.itemId, membership.scope)) ||
        removedCollections.some((row) => row.key === recordKey("collection", membership.collectionId, membership.scope))
      )
        return false;
      issues.push(`invalid-membership:${membership.collectionId}/${membership.itemId}`);
      return true;
    });
    const current = sources.find((source) => source.id === "primary")?.snapshot ?? emptySnapshot<TMeta>();
    const fallback = sources.find((source) => source.id === "fallback")?.snapshot ?? emptySnapshot<TMeta>();
    const proposedOperations = [
      ...replacementOperations(overlaySnapshot(current, state.operations), desired),
      ...replacementOperations(overlaySnapshot(fallback, state.operations), desired),
    ];
    const uniqueOperations = new Map<string, FallbackRecoveryOperation<TMeta>>();
    for (const operation of proposedOperations) {
      uniqueOperations.set(serializeKeepStorage(operation, { operation: "getAll" }), operation);
    }
    const operations = [...uniqueOperations.values()];
    for (const operation of operations) {
      if (
        (operation.type === "setCollection" && !this.options.primary?.setCollection) ||
        (operation.type === "removeCollection" && !this.options.primary?.removeCollection)
      )
        issues.push("primary-collections-unavailable");
      if (
        (operation.type === "setMembership" && !this.options.primary?.setCollectionMembership) ||
        (operation.type === "removeMembership" && !this.options.primary?.removeCollectionMembership)
      )
        issues.push("primary-memberships-unavailable");
    }
    const backups: KeepBackupV2<TMeta>[] = sources.map(({ snapshot }) => ({
      format: KEEP_BACKUP_FORMAT,
      version: KEEP_BACKUP_VERSION,
      exportedAt: Date.now(),
      items: snapshot.items,
      collections: snapshot.collections,
      memberships: snapshot.memberships,
      ...(this.options.scope ? { scopes: [this.options.scope] } : {}),
    }));
    return { token, sources, rows, issues, operations, backups, retainedBackups: state.backups ?? [] };
  }
}

function emptySnapshot<TMeta>(): FallbackRecoverySnapshot<TMeta> {
  return {
    items: [],
    collections: [],
    memberships: [],
    capabilities: { collections: false, memberships: false },
    capturedAt: 0,
  };
}
function snapshotContent<TMeta>(snapshot: FallbackRecoverySnapshot<TMeta>): string {
  const { capturedAt: _capturedAt, ...data } = snapshot;
  return serializeKeepStorage(data, { operation: "set" });
}
function overlaySnapshot<TMeta>(
  snapshot: FallbackRecoverySnapshot<TMeta>,
  operations: FallbackRecoveryOperation<TMeta>[],
): FallbackRecoverySnapshot<TMeta> {
  return {
    ...snapshot,
    items: overlayItems(snapshot.items, operations),
    collections: overlayCollections(snapshot.collections, operations),
    memberships: overlayMemberships(snapshot.memberships, operations),
  };
}
function recordKey(kind: string, id: string, scope?: KeepScope): string {
  return JSON.stringify([kind, scope?.tenantId ?? null, scope?.userId ?? null, id]);
}
function buildRows<TMeta>(
  sources: KeepRecoveryInspection<TMeta>["sources"],
  selections: Record<string, string>,
  issues: string[],
): KeepRecoveryRow<TMeta>[] {
  const byKey = new Map<string, KeepRecoveryRow<TMeta>>();
  for (const source of sources) {
    for (const [kind, records] of [
      ["item", source.snapshot.items],
      ["collection", source.snapshot.collections],
      ["membership", source.snapshot.memberships],
    ] as const) {
      for (const value of records) {
        const id = "id" in value ? value.id : `${value.collectionId}/${value.itemId}`;
        const identity = "id" in value ? value.id : JSON.stringify([value.collectionId, value.itemId]);
        const key = recordKey(kind, identity, value.scope);
        const row = byKey.get(key) ?? { key, kind, id, candidates: [], conflict: false };
        row.candidates.push({ source: source.id, value });
        byKey.set(key, row);
      }
    }
  }
  for (const row of byKey.values()) {
    const values = new Set(row.candidates.map(({ value }) => serializeKeepStorage(value, { operation: "getAll" })));
    row.conflict = values.size > 1;
    row.selectedSource = selections[row.key] ?? (row.conflict ? undefined : row.candidates[0]?.source);
    if (
      row.selectedSource !== undefined &&
      row.selectedSource !== "__remove__" &&
      !row.candidates.some(({ source }) => source === row.selectedSource)
    )
      issues.push(`invalid-selection:${row.id}`);
    if (row.conflict && row.selectedSource === undefined) issues.push(`unresolved-conflict:${row.id}`);
  }
  for (const key of Object.keys(selections)) if (!byKey.has(key)) issues.push("invalid-selection");
  return [...byKey.values()];
}
function replacementOperations<TMeta>(
  current: FallbackRecoverySnapshot<TMeta>,
  desired: FallbackRecoverySnapshot<TMeta>,
): FallbackRecoveryOperation<TMeta>[] {
  const operations: FallbackRecoveryOperation<TMeta>[] = [];
  for (const membership of current.memberships)
    if (
      !desired.memberships.some(
        (entry) =>
          entry.collectionId === membership.collectionId &&
          entry.itemId === membership.itemId &&
          isSameKeepScope(entry.scope, membership.scope),
      )
    )
      operations.push({
        type: "removeMembership",
        collectionId: membership.collectionId,
        itemId: membership.itemId,
        scope: membership.scope,
      });
  for (const collection of current.collections)
    if (
      !desired.collections.some((entry) => entry.id === collection.id && isSameKeepScope(entry.scope, collection.scope))
    )
      operations.push({ type: "removeCollection", id: collection.id, scope: collection.scope });
  for (const item of current.items)
    if (!desired.items.some((entry) => entry.id === item.id && isSameKeepScope(entry.scope, item.scope)))
      operations.push({ type: "removeItems", ids: [item.id], scope: item.scope });
  for (const collection of desired.collections) {
    const existing = current.collections.find(
      (entry) => entry.id === collection.id && isSameKeepScope(entry.scope, collection.scope),
    );
    if (!sameRecoveryRecord(existing, collection)) operations.push({ type: "setCollection", collection });
  }
  const isChangedItem = (item: KeepItem<TMeta>) => {
    const existing = current.items.find((entry) => entry.id === item.id && isSameKeepScope(entry.scope, item.scope));
    return !sameRecoveryRecord(existing, item);
  };
  const changedItems = desired.items.filter(isChangedItem);
  if (changedItems.length > 0) operations.push({ type: "setItems", items: changedItems });
  for (const membership of desired.memberships) {
    const existing = current.memberships.find(
      (entry) =>
        entry.collectionId === membership.collectionId &&
        entry.itemId === membership.itemId &&
        isSameKeepScope(entry.scope, membership.scope),
    );
    if (!sameRecoveryRecord(existing, membership)) operations.push({ type: "setMembership", membership });
  }
  return operations;
}

function sameRecoveryRecord<T>(left: T | undefined, right: T): boolean {
  if (left === undefined) return false;
  return serializeKeepStorage(left, { operation: "getAll" }) === serializeKeepStorage(right, { operation: "getAll" });
}
async function applyRecoveryOperation<TMeta>(
  adapter: StorageAdapter<TMeta>,
  operation: FallbackRecoveryOperation<TMeta>,
): Promise<void> {
  switch (operation.type) {
    case "setItems":
      return persistKeepItems(adapter, operation.items);
    case "removeItems":
      if (adapter.removeMany) return adapter.removeMany(operation.ids, operation.scope);
      for (const id of operation.ids) await adapter.remove(id, operation.scope);
      return;
    case "clearItems":
      return adapter.clear();
    case "setCollection":
      if (!adapter.setCollection) throw new Error("Collection storage is unavailable.");
      return adapter.setCollection(operation.collection);
    case "removeCollection":
      if (!adapter.removeCollection) throw new Error("Collection storage is unavailable.");
      return adapter.removeCollection(operation.id, operation.scope);
    case "setMembership":
      if (!adapter.setCollectionMembership) throw new Error("Collection membership storage is unavailable.");
      return adapter.setCollectionMembership(operation.membership);
    case "removeMembership":
      if (!adapter.removeCollectionMembership) throw new Error("Collection membership storage is unavailable.");
      return adapter.removeCollectionMembership(operation.collectionId, operation.itemId, operation.scope);
  }
}

function overlayItems<TMeta>(
  items: KeepItem<TMeta>[],
  operations: FallbackRecoveryOperation<TMeta>[],
): KeepItem<TMeta>[] {
  let next = items;
  for (const operation of operations) {
    if (operation.type === "clearItems") next = [];
    if (operation.type === "setItems") {
      for (const item of operation.items) {
        next = [...next.filter((entry) => entry.id !== item.id || !isSameKeepScope(entry.scope, item.scope)), item];
      }
    }
    if (operation.type === "removeItems") {
      next = next.filter(
        (item) =>
          !operation.ids.includes(item.id) ||
          (operation.scope !== undefined && !isSameKeepScope(item.scope, operation.scope)),
      );
    }
  }
  return next;
}

function overlayCollections<TMeta>(
  collections: KeepCollectionDefinition[],
  operations: FallbackRecoveryOperation<TMeta>[],
): KeepCollectionDefinition[] {
  let next = collections;
  for (const operation of operations) {
    if (operation.type === "setCollection") {
      const collection = operation.collection;
      next = [
        ...next.filter((entry) => entry.id !== collection.id || !isSameKeepScope(entry.scope, collection.scope)),
        collection,
      ];
    }
    if (operation.type === "removeCollection") {
      next = next.filter((entry) => entry.id !== operation.id || !isSameKeepScope(entry.scope, operation.scope));
    }
  }
  return next;
}

function overlayMemberships<TMeta>(
  memberships: KeepCollectionMembership[],
  operations: FallbackRecoveryOperation<TMeta>[],
): KeepCollectionMembership[] {
  let next = memberships;
  for (const operation of operations) {
    if (operation.type === "clearItems") next = [];
    if (operation.type === "setMembership") {
      const membership = operation.membership;
      next = [
        ...next.filter(
          (entry) =>
            entry.collectionId !== membership.collectionId ||
            entry.itemId !== membership.itemId ||
            !isSameKeepScope(entry.scope, membership.scope),
        ),
        membership,
      ];
    }
    if (operation.type === "removeMembership") {
      next = next.filter(
        (entry) =>
          entry.collectionId !== operation.collectionId ||
          entry.itemId !== operation.itemId ||
          !isSameKeepScope(entry.scope, operation.scope),
      );
    }
    if (operation.type === "removeCollection") {
      next = next.filter(
        (entry) => entry.collectionId !== operation.id || !isSameKeepScope(entry.scope, operation.scope),
      );
    }
    if (operation.type === "removeItems") {
      next = next.filter(
        (entry) =>
          !operation.ids.includes(entry.itemId) ||
          (operation.scope !== undefined && !isSameKeepScope(entry.scope, operation.scope)),
      );
    }
  }
  return next;
}

function parseRecoveryState<TMeta>(value: unknown, storageKey?: string): FallbackRecoveryJournalState<TMeta> {
  if (
    !isRecord(value) ||
    (value.version !== 1 && value.version !== 2) ||
    !Array.isArray(value.operations) ||
    !value.operations.every(isRecoveryOperation<TMeta>)
  ) {
    throw new KeepStorageParseError({ operation: "getAll", storageKey });
  }
  if (value.version === 1) return { version: 1, operations: value.operations };
  if (
    (value.snapshot !== undefined && !isRecoverySnapshot<TMeta>(value.snapshot)) ||
    (value.archives !== undefined &&
      (!Array.isArray(value.archives) || !value.archives.every(isRecoverySnapshot<TMeta>))) ||
    (value.backups !== undefined && (!Array.isArray(value.backups) || !value.backups.every(isRecoveryBackup<TMeta>))) ||
    (value.initialized !== undefined && typeof value.initialized !== "boolean")
  )
    throw new KeepStorageParseError({ operation: "getAll", storageKey });
  return {
    version: 2,
    operations: value.operations,
    ...(isRecoverySnapshot<TMeta>(value.snapshot) ? { snapshot: value.snapshot } : {}),
    ...(Array.isArray(value.archives) && value.archives.every(isRecoverySnapshot<TMeta>)
      ? { archives: value.archives }
      : {}),
    ...(Array.isArray(value.backups) && value.backups.every(isRecoveryBackup<TMeta>) ? { backups: value.backups } : {}),
    ...(typeof value.initialized === "boolean" ? { initialized: value.initialized } : {}),
  };
}
function isRecoveryItem<TMeta>(value: unknown): value is KeepItem<TMeta> {
  return isKeepItem(value);
}
function isRecoverySnapshot<TMeta>(value: unknown): value is FallbackRecoverySnapshot<TMeta> {
  return (
    isRecord(value) &&
    isKeepItemArray(value.items) &&
    Array.isArray(value.collections) &&
    value.collections.every(isKeepCollectionDefinition) &&
    Array.isArray(value.memberships) &&
    value.memberships.every(isKeepCollectionMembership) &&
    isRecord(value.capabilities) &&
    typeof value.capabilities.collections === "boolean" &&
    typeof value.capabilities.memberships === "boolean" &&
    typeof value.capturedAt === "number" &&
    Number.isFinite(value.capturedAt)
  );
}
function isRecoveryBackup<TMeta>(value: unknown): value is KeepBackupV2<TMeta> {
  return (
    isRecord(value) &&
    value.format === KEEP_BACKUP_FORMAT &&
    value.version === KEEP_BACKUP_VERSION &&
    typeof value.exportedAt === "number" &&
    Number.isFinite(value.exportedAt) &&
    isKeepItemArray(value.items) &&
    Array.isArray(value.collections) &&
    value.collections.every(isKeepCollectionDefinition) &&
    Array.isArray(value.memberships) &&
    value.memberships.every(isKeepCollectionMembership) &&
    (value.scopes === undefined || (Array.isArray(value.scopes) && value.scopes.every(isRecoveryScope)))
  );
}
function isRecoveryScope(value: unknown): value is KeepScope {
  return (
    isRecord(value) &&
    (value.userId === undefined || typeof value.userId === "string") &&
    (value.tenantId === undefined || typeof value.tenantId === "string")
  );
}

function isRecoveryOperation<TMeta>(value: unknown): value is FallbackRecoveryOperation<TMeta> {
  if (!isRecord(value)) return false;
  if (
    value.scope !== undefined &&
    (!isRecord(value.scope) ||
      (value.scope.userId !== undefined && typeof value.scope.userId !== "string") ||
      (value.scope.tenantId !== undefined && typeof value.scope.tenantId !== "string"))
  )
    return false;
  switch (value.type) {
    case "setItems":
      return isKeepItemArray(value.items);
    case "removeItems":
      return Array.isArray(value.ids) && value.ids.every((id) => typeof id === "string");
    case "clearItems":
      return true;
    case "setCollection":
      return isKeepCollectionDefinition(value.collection);
    case "removeCollection":
      return typeof value.id === "string";
    case "setMembership":
      return isKeepCollectionMembership(value.membership);
    case "removeMembership":
      return typeof value.collectionId === "string" && typeof value.itemId === "string";
    default:
      return false;
  }
}
