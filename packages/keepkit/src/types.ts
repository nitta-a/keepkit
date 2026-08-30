export type KeepItem<TMeta = Record<string, unknown>> = {
  id: string;
  savedAt: number;
  updatedAt: number;
  meta: TMeta;
  targetType?: string;
  note?: string;
};

export type KeepItemInput<TMeta = Record<string, unknown>> = Omit<
  KeepItem<TMeta>,
  "id" | "savedAt" | "updatedAt"
>;

export interface StorageAdapter<TMeta = Record<string, unknown>> {
  getAll(): Promise<KeepItem<TMeta>[]>;
  set(item: KeepItem<TMeta>): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
  merge?(localItems: KeepItem<TMeta>[]): Promise<KeepItem<TMeta>[]>;
  readonly storageKey?: string;
}

export type KeepErrorHandler = (error: unknown) => void;

export type KeepEventHandlers<TMeta = Record<string, unknown>> = {
  onSave?: (item: KeepItem<TMeta>) => void;
  onRemove?: (item: KeepItem<TMeta>) => void;
  onError?: KeepErrorHandler;
};
