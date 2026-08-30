export type KeepItem<TMeta = Record<string, unknown>> = {
  id: string;
  savedAt: number;
  updatedAt: number;
  meta: TMeta;
  targetType?: string;
  note?: string;
  tags?: string[];
  schemaVersion?: number;
  /** Optional server-provided revision used by synchronizing adapters. */
  revision?: string;
};

export type KeepItemInput<TMeta = Record<string, unknown>> = Omit<
  KeepItem<TMeta>,
  "id" | "savedAt" | "updatedAt"
>;

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
  | "save"
  | "updateNote"
  | "updateTags"
  | "updateTagsBatch"
  | "remove"
  | "removeBatch"
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

export type KeepSchemaParseResult<T> =
  | { success: true; data: T }
  | { success: false; error?: unknown };

export type KeepSchema<T> =
  | { parse: (value: unknown) => T | Promise<T> }
  | { safeParse: (value: unknown) => KeepSchemaParseResult<T> | Promise<KeepSchemaParseResult<T>> }
  | {
      "~standard": {
        validate: (
          value: unknown,
        ) =>
          | { value?: T; issues?: readonly unknown[] }
          | Promise<{ value?: T; issues?: readonly unknown[] }>;
      };
    };

export type KeepInvalidItemPolicy = "error" | "drop";

export type KeepSyncStatus = "idle" | "pending" | "syncing" | "synced" | "conflict" | "error";

export type KeepSyncState = {
  status: KeepSyncStatus;
  pendingCount: number;
  conflictIds: string[];
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
};

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

export interface SyncCapableStorageAdapter<TMeta = Record<string, unknown>>
  extends StorageAdapter<TMeta> {
  getSyncState(): KeepSyncState;
  subscribeSync(listener: () => void): () => void;
  flushSync(): Promise<void>;
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
  onError?: KeepErrorHandler;
};

export function normalizeKeepTags(tags?: string[]): string[] | undefined {
  if (!tags) return undefined;
  const normalized = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
  return normalized.length > 0 ? normalized : undefined;
}
