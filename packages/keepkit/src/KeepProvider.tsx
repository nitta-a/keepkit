import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { exportItems, type ImportItemsOptions, type ImportItemsResult, importItems } from "./backup";
import { KeepErrorBoundary, type KeepErrorBoundaryProps } from "./KeepErrorBoundary";
import type { KeepAutoRevalidationOptions, KeepItemResolver } from "./revalidation";
import {
  type KeepItemMetadataRefresher,
  type KeepItemRevalidationSummary,
  type KeepItemRevalidator,
  type RevalidateKeepItemsOptions,
  revalidateKeepItems,
} from "./revalidation";
import { parseKeepMeta } from "./schema";
import { createBrowserStorageAdapter } from "./storage";
import { KeepStore, type KeepStoreActions } from "./store";
import type {
  KeepAction,
  KeepChangeContext,
  KeepErrorContext,
  KeepErrorHandler,
  KeepEventHandlers,
  KeepInvalidItemPolicy,
  KeepItem,
  KeepPlugin,
  KeepSchema,
  KeepSyncState,
  KeepUndoState,
  StorageAdapter,
  SyncCapableStorageAdapter,
} from "./types";
import { normalizeKeepTags } from "./types";

export type KeepContextValue<TMeta = Record<string, unknown>> = {
  items: KeepItem<TMeta>[];
  isLoading: boolean;
  isHydrated: boolean;
  isMutating: boolean;
  error: unknown | null;
  lastChange?: KeepChangeContext<TMeta>;
  syncState: KeepSyncState<TMeta>;
  undo: KeepUndoState;
  saveItem: (item: KeepItem<TMeta>) => Promise<void>;
  updateNote: (id: string, note?: string) => Promise<void>;
  updateTags: (id: string, tags?: string[]) => Promise<void>;
  updateTagsBatch: (ids: string[], tags?: string[]) => Promise<void>;
  addTagsBatch: (ids: string[], tags: string[]) => Promise<void>;
  removeTagsBatch: (ids: string[], tags: string[]) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  removeItems: (ids: string[]) => Promise<void>;
  removeItemWithUndo: (id: string) => Promise<void>;
  removeItemsWithUndo: (ids: string[]) => Promise<void>;
  undoLastRemoval: () => Promise<void>;
  clear: () => Promise<void>;
  refresh: () => Promise<void>;
  flushSync: () => Promise<void>;
  resolveSyncConflict: (id: string, resolution: "local" | "remote" | "manual", item?: KeepItem<TMeta>) => Promise<void>;
  refreshItemMetadata: (id: string, refresh: KeepItemMetadataRefresher<TMeta>) => Promise<void>;
  revalidateItems: (
    revalidator?: KeepItemRevalidator<TMeta>,
    options?: RevalidateKeepItemsOptions<TMeta>,
  ) => Promise<KeepItemRevalidationSummary<TMeta>>;
  exportBackup: () => Promise<string>;
  importBackup: (
    data: string,
    options?: Pick<ImportItemsOptions<TMeta>, "mode" | "invalidItemPolicy" | "onInvalidItem">,
  ) => Promise<ImportItemsResult<TMeta>>;
};

export type KeepProviderProps<TMeta = Record<string, unknown>> = PropsWithChildren<
  KeepEventHandlers<TMeta> & {
    storage?: StorageAdapter<TMeta>;
    /**
     * Optional server-provided snapshot rendered before the client adapter
     * finishes hydrating. The adapter remains the source of truth after the
     * first refresh.
     */
    initialItems?: KeepItem<TMeta>[];
    plugins?: KeepPlugin<TMeta>[];
    schemaVersion?: number;
    schema?: KeepSchema<TMeta>;
    invalidItemPolicy?: KeepInvalidItemPolicy;
    onInvalidItem?: (error: unknown, item: KeepItem<unknown>) => void;
    migrateMeta?: (
      meta: unknown,
      fromVersion: number,
      toVersion: number,
      item: KeepItem<TMeta>,
    ) => TMeta | Promise<TMeta>;
    /** Render this content when a descendant or provider render unexpectedly throws. */
    fallback?: KeepErrorBoundaryProps["fallback"];
    onBoundaryError?: KeepErrorBoundaryProps["onError"];
    boundaryResetKey?: unknown;
    validateItem?: KeepItemRevalidator<TMeta>;
    resolveItem?: KeepItemResolver<TMeta>;
    autoRevalidation?: KeepAutoRevalidationOptions<TMeta>;
    undoTimeoutMs?: number;
  }
>;

const defaultStorage = createBrowserStorageAdapter();
const KeepContext = createContext<KeepContextValue<unknown> | null>(null);
const KeepStoreContext = createContext<KeepStoreAccess<unknown> | null>(null);

type KeepStoreAccess<TMeta> = {
  store: KeepStore<TMeta>;
  actions: KeepStoreActions<TMeta>;
};

type MutationPlan<TMeta> = {
  next: KeepItem<TMeta>[];
  persist: () => Promise<void>;
  onSuccess?: () => void;
  pluginContext?: {
    action: KeepAction;
    id?: string;
    item?: KeepItem<TMeta>;
    items?: KeepItem<TMeta>[];
  };
};

export function KeepProvider<TMeta = Record<string, unknown>>({
  storage = defaultStorage as StorageAdapter<TMeta>,
  initialItems,
  onSave,
  onRemove,
  onNoteUpdate,
  onTagsUpdate,
  onChange,
  onUndo,
  onError,
  plugins = [],
  schemaVersion,
  schema,
  invalidItemPolicy = "error",
  onInvalidItem,
  migrateMeta,
  fallback,
  onBoundaryError,
  boundaryResetKey,
  validateItem,
  resolveItem,
  autoRevalidation,
  undoTimeoutMs,
  children,
}: KeepProviderProps<TMeta>) {
  const content = (
    <KeepProviderContent<TMeta>
      storage={storage}
      initialItems={initialItems}
      onSave={onSave}
      onRemove={onRemove}
      onNoteUpdate={onNoteUpdate}
      onTagsUpdate={onTagsUpdate}
      onChange={onChange}
      onUndo={onUndo}
      onError={onError}
      plugins={plugins}
      schemaVersion={schemaVersion}
      schema={schema}
      invalidItemPolicy={invalidItemPolicy}
      onInvalidItem={onInvalidItem}
      migrateMeta={migrateMeta}
      validateItem={validateItem}
      resolveItem={resolveItem}
      autoRevalidation={autoRevalidation}
      undoTimeoutMs={undoTimeoutMs}
    >
      {children}
    </KeepProviderContent>
  );
  if (fallback === undefined && onBoundaryError === undefined) return content;
  return (
    <KeepErrorBoundary fallback={fallback} onError={onBoundaryError} resetKey={boundaryResetKey}>
      {content}
    </KeepErrorBoundary>
  );
}

function KeepProviderContent<TMeta = Record<string, unknown>>({
  storage = defaultStorage as StorageAdapter<TMeta>,
  initialItems,
  onSave,
  onRemove,
  onNoteUpdate,
  onTagsUpdate,
  onChange,
  onUndo,
  onError,
  plugins = [],
  schemaVersion,
  schema,
  invalidItemPolicy = "error",
  onInvalidItem,
  migrateMeta,
  validateItem,
  resolveItem,
  autoRevalidation,
  undoTimeoutMs = 5000,
  children,
}: KeepProviderProps<TMeta>) {
  const storeRef = useRef<KeepStore<TMeta> | null>(null);
  if (!storeRef.current) {
    storeRef.current = new KeepStore<TMeta>({
      items: initialItems ? [...initialItems] : [],
      isLoading: true,
      isHydrated: false,
      isMutating: false,
      error: null,
      lastChange: undefined,
      undo: { canUndo: false, ids: [] },
    });
  }
  const store = storeRef.current;
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const { items, isLoading, isHydrated, isMutating, error, lastChange, undo: storedUndo } = state;
  const undo = storedUndo ?? EMPTY_UNDO_STATE;
  const itemsRef = useRef(items);
  const pluginsRef = useRef(plugins);
  pluginsRef.current = plugins;
  const handlersRef = useRef({ onSave, onRemove, onNoteUpdate, onTagsUpdate, onChange, onUndo, onError });
  handlersRef.current = { onSave, onRemove, onNoteUpdate, onTagsUpdate, onChange, onUndo, onError };
  const migrationRef = useRef({
    schemaVersion,
    migrateMeta,
    schema,
    invalidItemPolicy,
    onInvalidItem,
  });
  migrationRef.current = { schemaVersion, migrateMeta, schema, invalidItemPolicy, onInvalidItem };
  const operationTailRef = useRef<Promise<unknown>>(Promise.resolve());
  const pendingRefreshesRef = useRef(0);
  const pendingMutationsRef = useRef(0);
  const undoRef = useRef<
    { items: KeepItem<TMeta>[]; expiresAt: number; timer?: ReturnType<typeof setTimeout> } | undefined
  >(undefined);
  const autoRevalidationRef = useRef<KeepAutoRevalidationOptions<TMeta> | undefined>(autoRevalidation);
  autoRevalidationRef.current = autoRevalidation;
  const didMountRevalidateRef = useRef(false);
  const syncStorage = isSyncCapableStorage(storage) ? storage : undefined;
  const getSyncState = useCallback(() => syncStorage?.getSyncState() ?? IDLE_SYNC_STATE, [syncStorage]);
  const subscribeSync = useCallback(
    (listener: () => void) => syncStorage?.subscribeSync(listener) ?? (() => undefined),
    [syncStorage],
  );
  const syncState = useSyncExternalStore(subscribeSync, getSyncState, getSyncState);

  const reportError = useCallback(
    (cause: unknown, context: KeepErrorContext) => {
      store.setState({ error: cause });
      handlersRef.current.onError?.(cause, context);
      for (const plugin of pluginsRef.current) plugin.onError?.(cause, context);
    },
    [store],
  );

  const setItems = useCallback(
    (next: KeepItem<TMeta>[]) => {
      itemsRef.current = next;
      store.setState({ items: next });
    },
    [store],
  );

  const runBeforePlugins = useCallback(async (context: NonNullable<MutationPlan<TMeta>["pluginContext"]>) => {
    for (const plugin of pluginsRef.current) await plugin.before?.(context);
    return context;
  }, []);

  const runAfterPlugins = useCallback(async (context: NonNullable<MutationPlan<TMeta>["pluginContext"]>) => {
    for (const plugin of pluginsRef.current) await plugin.after?.(context);
  }, []);

  const enqueueOperation = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    const run = operationTailRef.current.then(operation, operation);
    operationTailRef.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }, []);

  const refresh = useCallback(async () => {
    pendingRefreshesRef.current += 1;
    store.setState({ isLoading: true });

    try {
      await enqueueOperation(async () => {
        try {
          let next = await storage.getAll();
          let needsMigrationPersist = false;
          if (migrationRef.current.schemaVersion !== undefined) {
            const migrated = await Promise.all(
              next.map(async (item) => {
                const currentSchemaVersion = migrationRef.current.schemaVersion as number;
                if (item.schemaVersion === currentSchemaVersion) return item;
                const meta = migrationRef.current.migrateMeta
                  ? await migrationRef.current.migrateMeta(
                      item.meta,
                      item.schemaVersion ?? 0,
                      currentSchemaVersion,
                      item,
                    )
                  : item.meta;
                return { ...item, meta, schemaVersion: currentSchemaVersion };
              }),
            );
            if (migrated.some((item, index) => item !== next[index])) {
              next = migrated;
              needsMigrationPersist = true;
            }
          }
          if (migrationRef.current.schema) {
            const validated: KeepItem<TMeta>[] = [];
            for (const item of next) {
              try {
                validated.push(await parseKeepMetaItem(item, migrationRef.current.schema));
              } catch (cause) {
                migrationRef.current.onInvalidItem?.(cause, item);
                if (migrationRef.current.invalidItemPolicy === "drop") continue;
                throw cause;
              }
            }
            next = validated;
          }
          if (needsMigrationPersist) {
            if (storage.setMany) await storage.setMany(next);
            else for (const item of next) await storage.set(item);
          }
          setItems(next);
          store.setState({ error: null });
        } catch (cause) {
          reportError(cause, { action: "refresh" });
        }
      });
    } finally {
      pendingRefreshesRef.current -= 1;
      if (pendingRefreshesRef.current === 0) store.setState({ isLoading: false });
      store.setState({ isHydrated: true });
    }
  }, [enqueueOperation, reportError, setItems, storage, store]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!storage.subscribe) return;
    return storage.subscribe(() => void refresh());
  }, [refresh, storage]);

  useEffect(() => {
    if (!isScopeAwareStorage(storage)) return;
    return storage.subscribeScope(() => {
      undoRef.current?.timer && clearTimeout(undoRef.current.timer);
      undoRef.current = undefined;
      itemsRef.current = [];
      store.setState({ items: [], isHydrated: false, isLoading: true, error: null, undo: EMPTY_UNDO_STATE });
      void refresh();
    });
  }, [refresh, storage, store]);

  const runMutation = useCallback(
    (
      action: Exclude<KeepAction, "refresh">,
      id: string | undefined,
      createPlan: (previous: KeepItem<TMeta>[]) => MutationPlan<TMeta> | undefined,
    ): Promise<void> => {
      pendingMutationsRef.current += 1;
      store.setState({ isMutating: true });

      const run = enqueueOperation(async () => {
        const previous = itemsRef.current;
        const plan = createPlan(previous);
        if (!plan) return;

        try {
          if (plan.pluginContext) await runBeforePlugins(plan.pluginContext);
          setItems(plan.next);
          store.setState({ error: null });
          await plan.persist();
          plan.onSuccess?.();
          if (plan.pluginContext) await runAfterPlugins(plan.pluginContext);
          if (plan.pluginContext) {
            const change: KeepChangeContext<TMeta> = { ...plan.pluginContext, phase: "local" };
            store.setState({ lastChange: change });
            void Promise.resolve(handlersRef.current.onChange?.(change)).catch((cause) =>
              reportError(cause, { action, id }),
            );
          }
        } catch (cause) {
          setItems(previous);
          reportError(cause, { action, id });
          throw cause;
        }
      });

      return run.finally(() => {
        pendingMutationsRef.current -= 1;
        if (pendingMutationsRef.current === 0) store.setState({ isMutating: false });
      });
    },
    [enqueueOperation, reportError, runAfterPlugins, runBeforePlugins, setItems, store],
  );

  const saveItem = useCallback(
    async (item: KeepItem<TMeta>) => {
      let normalizedItem: KeepItem<TMeta>;
      try {
        const meta = migrationRef.current.schema
          ? await parseKeepMeta(migrationRef.current.schema, item.meta)
          : item.meta;
        normalizedItem = {
          ...item,
          meta,
          tags: normalizeKeepTags(item.tags),
          ...(migrationRef.current.schemaVersion === undefined
            ? {}
            : { schemaVersion: migrationRef.current.schemaVersion }),
        };
      } catch (cause) {
        reportError(cause, { action: "save", id: item.id });
        throw cause;
      }
      await runMutation("save", normalizedItem.id, (previous) => ({
        next: [...previous.filter((current) => current.id !== normalizedItem.id), normalizedItem].sort(
          (a, b) => b.updatedAt - a.updatedAt,
        ),
        persist: () => storage.set(normalizedItem),
        onSuccess: () => handlersRef.current.onSave?.(normalizedItem),
        pluginContext: { action: "save", id: normalizedItem.id, item: normalizedItem },
      }));
    },
    [reportError, runMutation, storage],
  );

  const updateNote = useCallback(
    async (id: string, note?: string) => {
      const nextNote = note?.trim() || undefined;
      await runMutation("updateNote", id, (previous) => {
        const current = previous.find((item) => item.id === id);
        if (!current) return undefined;
        const next = { ...current, note: nextNote, updatedAt: Date.now() };
        return {
          next: previous.map((item) => (item.id === id ? next : item)),
          persist: () => storage.set(next),
          onSuccess: () => handlersRef.current.onNoteUpdate?.(id, nextNote),
          pluginContext: { action: "updateNote", id, item: next },
        };
      });
    },
    [runMutation, storage],
  );

  const updateTags = useCallback(
    async (id: string, tags?: string[]) => {
      const nextTags = normalizeKeepTags(tags);
      await runMutation("updateTags", id, (previous) => {
        const current = previous.find((item) => item.id === id);
        if (!current) return undefined;
        const next = { ...current, tags: nextTags, updatedAt: Date.now() };
        return {
          next: previous.map((item) => (item.id === id ? next : item)),
          persist: () => storage.set(next),
          onSuccess: () => handlersRef.current.onTagsUpdate?.(id, nextTags),
          pluginContext: { action: "updateTags", id, item: next },
        };
      });
    },
    [runMutation, storage],
  );

  const updateTagsBatch = useCallback(
    async (ids: string[], tags?: string[]) => {
      const idSet = new Set(ids);
      const nextTags = normalizeKeepTags(tags);
      await runMutation("updateTagsBatch", undefined, (previous) => {
        const currentItems = previous.filter((item) => idSet.has(item.id));
        if (currentItems.length === 0) return undefined;
        const updatedItems = currentItems.map((item) => ({
          ...item,
          tags: nextTags,
          updatedAt: Date.now(),
        }));
        const updatedById = new Map(updatedItems.map((item) => [item.id, item]));
        return {
          next: previous.map((item) => updatedById.get(item.id) ?? item),
          persist: async () => {
            if (storage.setMany) {
              await storage.setMany(updatedItems);
              return;
            }
            const completed: KeepItem<TMeta>[] = [];
            try {
              for (const item of updatedItems) {
                await storage.set(item);
                completed.push(item);
              }
            } catch (cause) {
              const previousById = new Map(currentItems.map((item) => [item.id, item]));
              await Promise.allSettled(
                completed.map((item) => {
                  const previousItem = previousById.get(item.id);
                  return previousItem ? storage.set(previousItem) : Promise.resolve();
                }),
              );
              throw cause;
            }
          },
          onSuccess: () => {
            updatedItems.forEach((item) => {
              handlersRef.current.onTagsUpdate?.(item.id, nextTags);
            });
          },
          pluginContext: { action: "updateTagsBatch", items: updatedItems },
        };
      });
    },
    [runMutation, storage],
  );

  const addTagsBatch = useCallback(
    async (ids: string[], tags: string[]) => {
      const additions = normalizeKeepTags(tags) ?? [];
      const idSet = new Set(ids);
      const currentItems = itemsRef.current.filter((item) => idSet.has(item.id));
      await Promise.all(
        currentItems.map((item) => updateTags(item.id, normalizeKeepTags([...(item.tags ?? []), ...additions]))),
      );
    },
    [updateTags],
  );

  const removeTagsBatch = useCallback(
    async (ids: string[], tags: string[]) => {
      const removals = new Set(normalizeKeepTags(tags) ?? []);
      const idSet = new Set(ids);
      const currentItems = itemsRef.current.filter((item) => idSet.has(item.id));
      await Promise.all(
        currentItems.map((item) =>
          updateTags(item.id, normalizeKeepTags((item.tags ?? []).filter((tag) => !removals.has(tag)))),
        ),
      );
    },
    [updateTags],
  );

  const removeItem = useCallback(
    async (id: string) => {
      await runMutation("remove", id, (previous) => {
        const current = previous.find((item) => item.id === id);
        if (!current) return undefined;
        return {
          next: previous.filter((item) => item.id !== id),
          persist: () => storage.remove(id),
          onSuccess: () => handlersRef.current.onRemove?.(current),
          pluginContext: { action: "remove", id, item: current },
        };
      });
    },
    [runMutation, storage],
  );

  const removeItems = useCallback(
    async (ids: string[]) => {
      const idSet = new Set(ids);
      await runMutation("removeBatch", undefined, (previous) => {
        const removedItems = previous.filter((item) => idSet.has(item.id));
        if (removedItems.length === 0) return undefined;
        return {
          next: previous.filter((item) => !idSet.has(item.id)),
          persist: async () => {
            if (storage.removeMany) {
              await storage.removeMany(removedItems.map((item) => item.id));
              return;
            }
            const completed: KeepItem<TMeta>[] = [];
            try {
              for (const item of removedItems) {
                await storage.remove(item.id);
                completed.push(item);
              }
            } catch (cause) {
              await Promise.allSettled(completed.map((item) => storage.set(item)));
              throw cause;
            }
          },
          onSuccess: () => {
            removedItems.forEach((item) => {
              handlersRef.current.onRemove?.(item);
            });
          },
          pluginContext: { action: "removeBatch", items: removedItems },
        };
      });
    },
    [runMutation, storage],
  );

  const rememberUndo = useCallback(
    (removedItems: KeepItem<TMeta>[]) => {
      undoRef.current?.timer && clearTimeout(undoRef.current.timer);
      const expiresAt = Date.now() + Math.max(0, undoTimeoutMs);
      const timer = setTimeout(
        () => {
          undoRef.current = undefined;
          store.setState({ undo: { canUndo: false, ids: [] } });
        },
        Math.max(0, undoTimeoutMs),
      );
      undoRef.current = { items: removedItems, expiresAt, timer };
      store.setState({ undo: { canUndo: true, ids: removedItems.map((item) => item.id), expiresAt } });
    },
    [store, undoTimeoutMs],
  );

  const removeItemWithUndo = useCallback(
    async (id: string) => {
      const item = itemsRef.current.find((current) => current.id === id);
      await removeItem(id);
      if (item) rememberUndo([item]);
    },
    [rememberUndo, removeItem],
  );

  const removeItemsWithUndo = useCallback(
    async (ids: string[]) => {
      const idSet = new Set(ids);
      const removedItems = itemsRef.current.filter((item) => idSet.has(item.id));
      await removeItems(ids);
      if (removedItems.length > 0) rememberUndo(removedItems);
    },
    [rememberUndo, removeItems],
  );

  const undoLastRemoval = useCallback(async () => {
    const pending = undoRef.current;
    if (!pending || pending.expiresAt < Date.now()) {
      undoRef.current = undefined;
      store.setState({ undo: { canUndo: false, ids: [] } });
      return;
    }
    if (pending.timer) clearTimeout(pending.timer);
    undoRef.current = undefined;
    store.setState({ undo: { canUndo: false, ids: [] } });
    await runMutation("undo", undefined, (previous) => {
      const restored = new Map(pending.items.map((item) => [item.id, item]));
      const next = [...previous.filter((item) => !restored.has(item.id)), ...pending.items].sort(
        (a, b) => b.updatedAt - a.updatedAt,
      );
      return {
        next,
        persist: async () => {
          if (storage.setMany) await storage.setMany(pending.items);
          else for (const item of pending.items) await storage.set(item);
        },
        onSuccess: () => handlersRef.current.onUndo?.(pending.items),
        pluginContext: { action: "undo", items: pending.items },
      };
    });
  }, [runMutation, storage, store]);

  useEffect(() => {
    if (syncState.status !== "error" || !undoRef.current) return;
    void undoLastRemoval();
  }, [syncState.status, undoLastRemoval]);

  const clear = useCallback(
    () =>
      runMutation("clear", undefined, (_previous) => ({
        next: [],
        persist: () => storage.clear(),
        pluginContext: { action: "clear", items: [] },
      })),
    [runMutation, storage],
  );

  const revalidateItems = useCallback(
    async (
      revalidator: KeepItemRevalidator<TMeta> | undefined,
      options: RevalidateKeepItemsOptions<TMeta> = {},
    ): Promise<KeepItemRevalidationSummary<TMeta>> => {
      pendingMutationsRef.current += 1;
      store.setState({ isMutating: true });
      const run = enqueueOperation(async () => {
        const previous = itemsRef.current;
        let persistenceStarted = false;
        try {
          const activeRevalidator = revalidator ?? validateItem;
          if (!activeRevalidator)
            throw new Error("KeepProvider.revalidateItems requires a revalidator or validateItem.");
          const summary = await revalidateKeepItems(previous, activeRevalidator, {
            ...options,
            resolveItem: options.resolveItem ?? resolveItem,
          });
          const pluginContext = { action: "revalidate" as const, items: summary.updatedItems };
          await runBeforePlugins(pluginContext);
          if (summary.updatedItems.length > 0) {
            persistenceStarted = true;
            if (storage.setMany) await storage.setMany(summary.updatedItems);
            else for (const item of summary.updatedItems) await storage.set(item);
          }
          if (summary.removedIds.length > 0) {
            persistenceStarted = true;
            if (storage.removeMany) await storage.removeMany(summary.removedIds);
            else for (const id of summary.removedIds) await storage.remove(id);
          }
          setItems(summary.items);
          store.setState({ error: null });
          const removedIdSet = new Set(summary.removedIds);
          for (const result of summary.results) {
            if (removedIdSet.has(result.item.id)) handlersRef.current.onRemove?.(result.item);
          }
          await runAfterPlugins(pluginContext);
          void Promise.resolve(handlersRef.current.onChange?.({ ...pluginContext, phase: "local" })).catch((cause) =>
            reportError(cause, { action: "revalidate" }),
          );
          return summary;
        } catch (cause) {
          if (persistenceStarted) await restoreItems(storage, previous);
          setItems(previous);
          reportError(cause, { action: "revalidate" });
          throw cause;
        }
      });
      return run.finally(() => {
        pendingMutationsRef.current -= 1;
        if (pendingMutationsRef.current === 0) store.setState({ isMutating: false });
      });
    },
    [
      enqueueOperation,
      reportError,
      resolveItem,
      runAfterPlugins,
      runBeforePlugins,
      setItems,
      storage,
      store,
      validateItem,
    ],
  );

  useEffect(() => {
    const settings = autoRevalidationRef.current;
    const activeRevalidator = settings?.revalidator ?? validateItem;
    if (!settings || !activeRevalidator) return;
    const run = () =>
      void revalidateItems(activeRevalidator, { removeStatuses: settings.removeStatuses }).catch(() => undefined);
    if (isHydrated && settings.onMount !== false && !didMountRevalidateRef.current) {
      didMountRevalidateRef.current = true;
      run();
    }
    const interval = settings.intervalMs && settings.intervalMs > 0 ? setInterval(run, settings.intervalMs) : undefined;
    const onOnline = () => {
      if (settings.onReconnect !== false) run();
    };
    if (typeof window !== "undefined" && settings.onReconnect !== false) {
      window.addEventListener("online", onOnline);
    }
    return () => {
      if (interval) clearInterval(interval);
      if (typeof window !== "undefined") window.removeEventListener("online", onOnline);
    };
  }, [isHydrated, revalidateItems, validateItem]);

  const refreshItemMetadata = useCallback(
    async (id: string, refresh: KeepItemMetadataRefresher<TMeta>): Promise<void> => {
      if (!itemsRef.current.some((item) => item.id === id)) {
        throw new Error(`Cannot refresh metadata for missing item "${id}".`);
      }
      await revalidateItems(async (item) => {
        if (item.id !== id) return "available";
        return { status: "available", meta: await refresh(item) };
      });
    },
    [revalidateItems],
  );
  const flushSync = useCallback(() => (syncStorage ? syncStorage.flushSync() : Promise.resolve()), [syncStorage]);
  const resolveSyncConflict = useCallback(
    (id: string, resolution: "local" | "remote" | "manual", item?: KeepItem<TMeta>) => {
      if (!syncStorage?.resolveSyncConflict) {
        return Promise.reject(new Error("The configured storage does not support sync conflict resolution."));
      }
      return syncStorage.resolveSyncConflict(id, resolution, item);
    },
    [syncStorage],
  );
  const exportBackup = useCallback(() => exportItems(storage), [storage]);
  const importBackup = useCallback(
    async (
      data: string,
      options: Pick<ImportItemsOptions<TMeta>, "mode" | "invalidItemPolicy" | "onInvalidItem"> = {},
    ): Promise<ImportItemsResult<TMeta>> => {
      pendingMutationsRef.current += 1;
      store.setState({ isMutating: true });
      const run = enqueueOperation(async () => {
        try {
          const result = await importItems(storage, data, {
            ...options,
            schema: migrationRef.current.schema,
            invalidItemPolicy: options.invalidItemPolicy ?? migrationRef.current.invalidItemPolicy,
            onInvalidItem: options.onInvalidItem ?? migrationRef.current.onInvalidItem,
          });
          setItems(result.items);
          store.setState({ error: null });
          return result;
        } catch (cause) {
          reportError(cause, { action: "import" });
          throw cause;
        }
      });
      return run.finally(() => {
        pendingMutationsRef.current -= 1;
        if (pendingMutationsRef.current === 0) store.setState({ isMutating: false });
      });
    },
    [enqueueOperation, reportError, setItems, storage, store],
  );

  const value = useMemo<KeepContextValue<TMeta>>(
    () => ({
      items,
      isLoading,
      isHydrated,
      isMutating,
      error,
      lastChange,
      syncState,
      undo,
      saveItem,
      updateNote,
      updateTags,
      updateTagsBatch,
      addTagsBatch,
      removeTagsBatch,
      removeItem,
      removeItems,
      removeItemWithUndo,
      removeItemsWithUndo,
      undoLastRemoval,
      clear,
      refresh,
      flushSync,
      resolveSyncConflict,
      refreshItemMetadata,
      revalidateItems,
      exportBackup,
      importBackup,
    }),
    [
      clear,
      error,
      lastChange,
      flushSync,
      resolveSyncConflict,
      isHydrated,
      isLoading,
      isMutating,
      items,
      syncState,
      undo,
      refresh,
      removeItem,
      saveItem,
      removeItemWithUndo,
      removeItemsWithUndo,
      undoLastRemoval,
      updateNote,
      updateTags,
      updateTagsBatch,
      addTagsBatch,
      removeTagsBatch,
      removeItems,
      refreshItemMetadata,
      revalidateItems,
      exportBackup,
      importBackup,
    ],
  );

  const actions = useMemo<KeepStoreActions<TMeta>>(
    () => ({
      saveItem,
      updateNote,
      updateTags,
      updateTagsBatch,
      addTagsBatch,
      removeTagsBatch,
      removeItem,
      removeItems,
      removeItemWithUndo,
      removeItemsWithUndo,
      undoLastRemoval,
      clear,
      refresh,
      refreshItemMetadata,
      revalidateItems,
    }),
    [
      addTagsBatch,
      clear,
      refresh,
      removeItem,
      removeItems,
      removeTagsBatch,
      saveItem,
      updateNote,
      updateTags,
      updateTagsBatch,
      refreshItemMetadata,
      revalidateItems,
      removeItemWithUndo,
      removeItemsWithUndo,
      undoLastRemoval,
    ],
  );
  const storeAccess = useMemo<KeepStoreAccess<TMeta>>(() => ({ store, actions }), [actions, store]);

  return (
    <KeepStoreContext.Provider value={storeAccess as KeepStoreAccess<unknown>}>
      <KeepContext.Provider value={value as unknown as KeepContextValue<unknown>}>{children}</KeepContext.Provider>
    </KeepStoreContext.Provider>
  );
}

const IDLE_SYNC_STATE: KeepSyncState<never> = Object.freeze({
  status: "idle",
  pendingCount: 0,
  conflictIds: [],
  conflicts: [],
});

const EMPTY_UNDO_STATE: KeepUndoState = Object.freeze({ canUndo: false, ids: [] });

function isSyncCapableStorage<TMeta>(storage: StorageAdapter<TMeta>): storage is SyncCapableStorageAdapter<TMeta> {
  return (
    "getSyncState" in storage &&
    typeof storage.getSyncState === "function" &&
    "subscribeSync" in storage &&
    typeof storage.subscribeSync === "function" &&
    "flushSync" in storage &&
    typeof storage.flushSync === "function"
  );
}

function isScopeAwareStorage<TMeta>(
  storage: StorageAdapter<TMeta>,
): storage is StorageAdapter<TMeta> & { subscribeScope: (listener: () => void) => () => void } {
  return "subscribeScope" in storage && typeof storage.subscribeScope === "function";
}

async function parseKeepMetaItem<TMeta>(item: KeepItem<unknown>, schema: KeepSchema<TMeta>): Promise<KeepItem<TMeta>> {
  return { ...item, meta: await parseKeepMeta(schema, item.meta) };
}

async function restoreItems<TMeta>(storage: StorageAdapter<TMeta>, items: KeepItem<TMeta>[]): Promise<void> {
  try {
    if (storage.setMany) {
      await storage.setMany(items);
      return;
    }
    for (const item of items) await storage.set(item);
  } catch {
    // The original operation's error is more useful to the caller than a best-effort rollback error.
  }
}

export function useKeepContext<TMeta = Record<string, unknown>>(): KeepContextValue<TMeta> {
  const context = useContext(KeepContext);
  if (!context) throw new Error("Keep hooks must be used inside a KeepProvider");
  return context as unknown as KeepContextValue<TMeta>;
}

export function useKeepStore<TMeta = Record<string, unknown>>(): KeepStoreAccess<TMeta> {
  const context = useContext(KeepStoreContext);
  if (!context) throw new Error("Keep hooks must be used inside a KeepProvider");
  return context as unknown as KeepStoreAccess<TMeta>;
}

export type { KeepErrorHandler };
