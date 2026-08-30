import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { LocalStorageAdapter } from "./storage";
import type {
  KeepAction,
  KeepErrorContext,
  KeepErrorHandler,
  KeepEventHandlers,
  KeepItem,
  StorageAdapter,
} from "./types";
import { normalizeKeepTags } from "./types";

export type KeepContextValue<TMeta = Record<string, unknown>> = {
  items: KeepItem<TMeta>[];
  isLoading: boolean;
  isHydrated: boolean;
  isMutating: boolean;
  error: unknown | null;
  saveItem: (item: KeepItem<TMeta>) => Promise<void>;
  updateNote: (id: string, note?: string) => Promise<void>;
  updateTags: (id: string, tags?: string[]) => Promise<void>;
  updateTagsBatch: (ids: string[], tags?: string[]) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  removeItems: (ids: string[]) => Promise<void>;
  clear: () => Promise<void>;
  refresh: () => Promise<void>;
};

export type KeepProviderProps<TMeta = Record<string, unknown>> = PropsWithChildren<
  KeepEventHandlers<TMeta> & {
    storage?: StorageAdapter<TMeta>;
  }
>;

const defaultStorage = new LocalStorageAdapter();
const KeepContext = createContext<KeepContextValue<unknown> | null>(null);

type MutationPlan<TMeta> = {
  next: KeepItem<TMeta>[];
  persist: () => Promise<void>;
  onSuccess?: () => void;
};

export function KeepProvider<TMeta = Record<string, unknown>>({
  storage = defaultStorage as StorageAdapter<TMeta>,
  onSave,
  onRemove,
  onNoteUpdate,
  onTagsUpdate,
  onError,
  children,
}: KeepProviderProps<TMeta>) {
  const [items, setItems] = useState<KeepItem<TMeta>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const itemsRef = useRef(items);
  const operationTailRef = useRef<Promise<unknown>>(Promise.resolve());
  const pendingRefreshesRef = useRef(0);
  const pendingMutationsRef = useRef(0);

  const reportError = useCallback(
    (cause: unknown, context: KeepErrorContext) => {
      setError(cause);
      onError?.(cause, context);
    },
    [onError],
  );

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
    setIsLoading(true);

    try {
      await enqueueOperation(async () => {
        try {
          const next = await storage.getAll();
          itemsRef.current = next;
          setItems(next);
          setError(null);
        } catch (cause) {
          reportError(cause, { action: "refresh" });
        }
      });
    } finally {
      pendingRefreshesRef.current -= 1;
      if (pendingRefreshesRef.current === 0) setIsLoading(false);
      setIsHydrated(true);
    }
  }, [enqueueOperation, reportError, storage]);

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
      setIsMutating(true);

      const run = enqueueOperation(async () => {
        const previous = itemsRef.current;
        const plan = createPlan(previous);
        if (!plan) return;

        itemsRef.current = plan.next;
        setItems(plan.next);
        setError(null);

        try {
          await plan.persist();
        } catch (cause) {
          itemsRef.current = previous;
          setItems(previous);
          reportError(cause, { action, id });
          throw cause;
        }

        plan.onSuccess?.();
      });

      return run.finally(() => {
        pendingMutationsRef.current -= 1;
        if (pendingMutationsRef.current === 0) setIsMutating(false);
      });
    },
    [enqueueOperation, reportError],
  );

  const saveItem = useCallback(
    async (item: KeepItem<TMeta>) => {
      const normalizedItem = { ...item, tags: normalizeKeepTags(item.tags) };
      await runMutation("save", normalizedItem.id, (previous) => ({
        next: [
          ...previous.filter((current) => current.id !== normalizedItem.id),
          normalizedItem,
        ].sort((a, b) => b.updatedAt - a.updatedAt),
        persist: () => storage.set(normalizedItem),
        onSuccess: () => onSave?.(normalizedItem),
      }));
    },
    [onSave, runMutation, storage],
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
          onSuccess: () => onNoteUpdate?.(id, nextNote),
        };
      });
    },
    [onNoteUpdate, runMutation, storage],
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
          onSuccess: () => onTagsUpdate?.(id, nextTags),
        };
      });
    },
    [onTagsUpdate, runMutation, storage],
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
              onTagsUpdate?.(item.id, nextTags);
            });
          },
        };
      });
    },
    [onTagsUpdate, runMutation, storage],
  );

  const removeItem = useCallback(
    async (id: string) => {
      await runMutation("remove", id, (previous) => {
        const current = previous.find((item) => item.id === id);
        if (!current) return undefined;
        return {
          next: previous.filter((item) => item.id !== id),
          persist: () => storage.remove(id),
          onSuccess: () => onRemove?.(current),
        };
      });
    },
    [onRemove, runMutation, storage],
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
              onRemove?.(item);
            });
          },
        };
      });
    },
    [onRemove, runMutation, storage],
  );

  const clear = useCallback(
    () =>
      runMutation("clear", undefined, (_previous) => ({
        next: [],
        persist: () => storage.clear(),
      })),
    [runMutation, storage],
  );

  const value = useMemo<KeepContextValue<TMeta>>(
    () => ({
      items,
      isLoading,
      isHydrated,
      isMutating,
      error,
      saveItem,
      updateNote,
      updateTags,
      updateTagsBatch,
      removeItem,
      removeItems,
      clear,
      refresh,
    }),
    [
      clear,
      error,
      isHydrated,
      isLoading,
      isMutating,
      items,
      refresh,
      removeItem,
      saveItem,
      updateNote,
      updateTags,
      updateTagsBatch,
      removeItems,
    ],
  );

  return (
    <KeepContext.Provider value={value as unknown as KeepContextValue<unknown>}>
      {children}
    </KeepContext.Provider>
  );
}

export function useKeepContext<TMeta = Record<string, unknown>>(): KeepContextValue<TMeta> {
  const context = useContext(KeepContext);
  if (!context) throw new Error("Keep hooks must be used inside a KeepProvider");
  return context as unknown as KeepContextValue<TMeta>;
}

export type { KeepErrorHandler };
