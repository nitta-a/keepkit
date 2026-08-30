export type KeepItem<TMeta = Record<string, unknown>> = {
  id: string;
  savedAt: number;
  updatedAt: number;
  meta: TMeta;
  targetType?: string;
  note?: string;
  tags?: string[];
  schemaVersion?: number;
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
  onError?: KeepErrorHandler;
};

export function normalizeKeepTags(tags?: string[]): string[] | undefined {
  if (!tags) return undefined;
  const normalized = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
  return normalized.length > 0 ? normalized : undefined;
}
