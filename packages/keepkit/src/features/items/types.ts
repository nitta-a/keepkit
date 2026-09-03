export type KeepItemStatus = "available" | "expired" | "removed" | "deleted" | "private" | "unknown";

export type SyncScope = {
  userId?: string;
  tenantId?: string;
};

export type KeepItem<TMeta = Record<string, unknown>> = {
  id: string;
  savedAt: number;
  updatedAt: number;
  meta: TMeta;
  /** Optional zero-based position in the user's custom viewing order. */
  order?: number;
  /** Whether the item is hidden from the default active list. */
  archived?: boolean;
  /** Whether the item should be shown before unpinned items. */
  pinned?: boolean;
  /** Optional derived collection identifier. */
  collectionId?: string;
  targetType?: string;
  note?: string;
  tags?: string[];
  schemaVersion?: number;
  /** Optional server-provided revision used by synchronizing adapters. */
  revision?: string;
  /** Timestamp for the last successful refresh of source metadata. */
  metaUpdatedAt?: number;
  /** Source availability as last determined by a revalidator. Omitted means available. */
  status?: KeepItemStatus;
  /** Optional human-readable or machine-provided reason for a non-available status. */
  statusReason?: string;
  /** Optional user/tenant scope used by a synchronizing adapter. */
  scope?: SyncScope;
};

/** The minimal item description accepted by save controls and hooks. */
export type KeepItemInput<TMeta = Record<string, unknown>> = {
  id: string;
  meta: TMeta;
  order?: number;
  targetType?: string;
  note?: string;
  tags?: string[];
  archived?: boolean;
  pinned?: boolean;
  collectionId?: string;
};

export interface StorageAdapter<TMeta = Record<string, unknown>> {
  getAll(): Promise<KeepItem<TMeta>[]>;
  set(item: KeepItem<TMeta>): Promise<void>;
  setMany?(items: KeepItem<TMeta>[]): Promise<void>;
  remove(id: string): Promise<void>;
  removeMany?(ids: string[]): Promise<void>;
  clear(): Promise<void>;
  merge?(localItems: KeepItem<TMeta>[]): Promise<KeepItem<TMeta>[]>;
  subscribe?(listener: () => void): () => void;
  readonly storageKey?: string;
}

export type KeepAction =
  | "refresh"
  | "import"
  | "export"
  | "save"
  | "updateNote"
  | "updateTags"
  | "updateTagsBatch"
  | "archive"
  | "pin"
  | "collection"
  | "revalidate"
  | "remove"
  | "removeBatch"
  | "undo"
  | "reorder"
  | "clear";

export type KeepChangePhase = "local" | "synced";

export type KeepChangeContext<TMeta = Record<string, unknown>> = {
  action: KeepAction;
  id?: string;
  item?: KeepItem<TMeta>;
  items?: KeepItem<TMeta>[];
  phase: KeepChangePhase;
};

export type KeepPluginContext<TMeta = Record<string, unknown>> = {
  action: KeepAction;
  id?: string;
  item?: KeepItem<TMeta>;
  items?: KeepItem<TMeta>[];
};

export type KeepPlugin<TMeta = Record<string, unknown>> = {
  name?: string;
  before?: (context: KeepPluginContext<TMeta>) => void | Promise<void>;
  after?: (context: KeepPluginContext<TMeta>) => void | Promise<void>;
  onError?: (error: unknown, context: KeepErrorContext) => void;
};

export type KeepSchemaParseResult<T> = { success: true; data: T } | { success: false; error?: unknown };

export type KeepSchema<T> =
  | { parse: (value: unknown) => T | Promise<T> }
  | { safeParse: (value: unknown) => KeepSchemaParseResult<T> | Promise<KeepSchemaParseResult<T>> }
  | {
      "~standard": {
        validate: (
          value: unknown,
        ) => { value?: T; issues?: readonly unknown[] } | Promise<{ value?: T; issues?: readonly unknown[] }>;
      };
    };

export type KeepInvalidItemPolicy = "error" | "drop";

export type KeepSyncStatus = "idle" | "pending" | "syncing" | "synced" | "conflict" | "error";

export type KeepSyncResolution = "local" | "remote" | "manual";

export type KeepSyncConflict<TMeta = Record<string, unknown>> = {
  id: string;
  operation: SyncOperation<TMeta>;
  remote: KeepItem<TMeta>;
  revision?: string;
};

export type KeepSyncState<TMeta = Record<string, unknown>> = {
  status: KeepSyncStatus;
  pendingCount: number;
  conflictIds: string[];
  /** Detailed conflict records when the adapter supports interactive resolution. */
  conflicts?: KeepSyncConflict<TMeta>[];
  lastSyncedAt?: number;
  error?: unknown;
};

export type SyncOperation<TMeta = Record<string, unknown>> = {
  operationId: string;
  type: "upsert" | "remove";
  id: string;
  item?: KeepItem<TMeta>;
  createdAt: number;
  baseRevision?: string;
  attempts?: number;
  scope?: SyncScope;
};

export type KeepSyncAuthStatus = 401 | 403;

/** Indicates that a sync request needs the host application to re-authenticate. */
export class KeepSyncAuthError<TMeta = Record<string, unknown>> extends Error {
  readonly status: KeepSyncAuthStatus;
  readonly operation?: SyncOperation<TMeta>;
  readonly scope?: SyncScope;
  readonly cause?: unknown;

  constructor(
    status: KeepSyncAuthStatus,
    options: { operation?: SyncOperation<TMeta>; scope?: SyncScope; cause?: unknown },
  ) {
    super(`KeepKit sync authorization failed with status ${status}.`);
    this.name = "KeepSyncAuthError";
    this.status = status;
    this.operation = options.operation;
    this.scope = options.scope;
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

export function isKeepSyncAuthError(error: unknown): error is KeepSyncAuthError {
  return error instanceof KeepSyncAuthError;
}

export type RemoteSyncResult<TMeta = Record<string, unknown>> =
  | { type: "synced"; item?: KeepItem<TMeta>; revision?: string }
  | { type: "conflict"; remote: KeepItem<TMeta>; revision?: string };

export type KeepConflictContext<TMeta = Record<string, unknown>> = {
  operation: SyncOperation<TMeta>;
  remoteRevision?: string;
};

export type KeepConflictResolver<TMeta = Record<string, unknown>> = (
  local: KeepItem<TMeta> | undefined,
  remote: KeepItem<TMeta>,
  context: KeepConflictContext<TMeta>,
) => KeepItem<TMeta> | undefined | Promise<KeepItem<TMeta> | undefined>;

export interface RemoteSyncDriver<TMeta = Record<string, unknown>> {
  push(operation: SyncOperation<TMeta>): Promise<RemoteSyncResult<TMeta>>;
  pull?: () => Promise<KeepItem<TMeta>[]>;
}

export interface SyncQueueAdapter<TMeta = Record<string, unknown>> {
  getAll(): Promise<SyncOperation<TMeta>[]>;
  setMany(operations: SyncOperation<TMeta>[]): Promise<void>;
  remove(operationIds: string[]): Promise<void>;
  clear(): Promise<void>;
}

export interface SyncCapableStorageAdapter<TMeta = Record<string, unknown>> extends StorageAdapter<TMeta> {
  getSyncState(): KeepSyncState<TMeta>;
  subscribeSync(listener: () => void): () => void;
  subscribeScope?(listener: () => void): () => void;
  flushSync(): Promise<void>;
  retrySync?(): Promise<void>;
  resolveSyncConflict?(id: string, resolution: KeepSyncResolution, item?: KeepItem<TMeta>): Promise<void>;
  dispose?(): void;
}

export type KeepStorageOperation = "getAll" | "set" | "remove" | "clear" | "merge";

export class KeepStorageError extends Error {
  readonly operation: KeepStorageOperation;
  readonly storageKey?: string;
  readonly cause?: unknown;

  constructor(
    message: string,
    options: {
      operation: KeepStorageOperation;
      storageKey?: string;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = "KeepStorageError";
    this.operation = options.operation;
    this.storageKey = options.storageKey;
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

export class KeepStorageQuotaError extends KeepStorageError {
  constructor(options: { operation: KeepStorageOperation; storageKey?: string; cause?: unknown }) {
    super("KeepKit storage quota was exceeded.", options);
    this.name = "KeepStorageQuotaError";
  }
}

export class KeepStorageAccessError extends KeepStorageError {
  constructor(options: { operation: KeepStorageOperation; storageKey?: string; cause?: unknown }) {
    super("KeepKit could not access the configured storage.", options);
    this.name = "KeepStorageAccessError";
  }
}

export class KeepStorageParseError extends KeepStorageError {
  constructor(options: { operation: KeepStorageOperation; storageKey?: string; cause?: unknown }) {
    super("KeepKit found invalid data in the configured storage.", options);
    this.name = "KeepStorageParseError";
  }
}

export type KeepErrorContext = {
  action: KeepAction;
  id?: string;
};

export type KeepErrorHandler = (error: unknown, context: KeepErrorContext) => void;

export type KeepEventHandlers<TMeta = Record<string, unknown>> = {
  onSave?: (item: KeepItem<TMeta>) => void;
  onRemove?: (item: KeepItem<TMeta>) => void;
  onNoteUpdate?: (id: string, note?: string) => void;
  onTagsUpdate?: (id: string, tags?: string[]) => void;
  onChange?: (context: KeepChangeContext<TMeta>) => void | Promise<void>;
  onUndo?: (items: KeepItem<TMeta>[]) => void;
  onError?: KeepErrorHandler;
};

export type KeepUndoState = {
  canUndo: boolean;
  ids: string[];
  startedAt?: number;
  expiresAt?: number;
};

export function normalizeKeepTags(tags?: string[]): string[] | undefined {
  if (!tags) return undefined;
  const normalized = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
  return normalized.length > 0 ? normalized : undefined;
}
