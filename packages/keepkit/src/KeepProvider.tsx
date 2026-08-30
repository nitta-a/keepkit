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
  syncState: KeepSyncState;
  saveItem: (item: KeepItem<TMeta>) => Promise<void>;
  updateNote: (id: string, note?: string) => Promise<void>;
  updateTags: (id: string, tags?: string[]) => Promise<void>;
  updateTagsBatch: (ids: string[], tags?: string[]) => Promise<void>;
  addTagsBatch: (ids: string[], tags: string[]) => Promise<void>;
  removeTagsBatch: (ids: string[], tags: string[]) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  removeItems: (ids: string[]) => Promise<void>;
  clear: () => Promise<void>;
  refresh: () => Promise<void>;
  flushSync: () => Promise<void>;
  refreshItemMetadata: (id: string, refresh: KeepItemMetadataRefresher<TMeta>) => Promise<void>;
  revalidateItems: (
    revalidator: KeepItemRevalidator<TMeta>,
    options?: RevalidateKeepItemsOptions,
  ) => Promise<KeepItemRevalidationSummary<TMeta>>;
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
  onError,
  plugins = [],
  schemaVersion,
  schema,
  invalidItemPolicy = "error",
  onInvalidItem,
  migrateMeta,
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
    });
  }
  const store = storeRef.current;
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const { items, isLoading, isHydrated, isMutating, error } = state;
  const itemsRef = useRef(items);
  const pluginsRef = useRef(plugins);
  pluginsRef.current = plugins;
  const handlersRef = useRef({ onSave, onRemove, onNoteUpdate, onTagsUpdate, onChange, onError });
  handlersRef.current = { onSave, onRemove, onNoteUpdate, onTagsUpdate, onChange, onError };
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
      revalidator: KeepItemRevalidator<TMeta>,
      options: RevalidateKeepItemsOptions = {},
    ): Promise<KeepItemRevalidationSummary<TMeta>> => {
      pendingMutationsRef.current += 1;
      store.setState({ isMutating: true });
      const run = enqueueOperation(async () => {
        const previous = itemsRef.current;
        let persistenceStarted = false;
        try {
          const summary = await revalidateKeepItems(previous, revalidator, options);
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
    [enqueueOperation, reportError, runAfterPlugins, runBeforePlugins, setItems, storage, store],
  );

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

  const value = useMemo<KeepContextValue<TMeta>>(
    () => ({
      items,
      isLoading,
      isHydrated,
      isMutating,
      error,
      syncState,
      saveItem,
      updateNote,
      updateTags,
      updateTagsBatch,
      addTagsBatch,
      removeTagsBatch,
      removeItem,
      removeItems,
      clear,
      refresh,
      flushSync,
      refreshItemMetadata,
      revalidateItems,
    }),
    [
      clear,
      error,
      flushSync,
      isHydrated,
      isLoading,
      isMutating,
      items,
      syncState,
      refresh,
      removeItem,
      saveItem,
      updateNote,
      updateTags,
      updateTagsBatch,
      addTagsBatch,
      removeTagsBatch,
      removeItems,
      refreshItemMetadata,
      revalidateItems,
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
    ],
  );
  const storeAccess = useMemo<KeepStoreAccess<TMeta>>(() => ({ store, actions }), [actions, store]);

  return (
    <KeepStoreContext.Provider value={storeAccess as KeepStoreAccess<unknown>}>
      <KeepContext.Provider value={value as unknown as KeepContextValue<unknown>}>{children}</KeepContext.Provider>
    </KeepStoreContext.Provider>
  );
}

const IDLE_SYNC_STATE: KeepSyncState = Object.freeze({
  status: "idle",
  pendingCount: 0,
  conflictIds: [],
});

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
