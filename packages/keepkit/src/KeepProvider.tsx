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

export type KeepContextValue<TMeta = Record<string, unknown>> = {
  items: KeepItem<TMeta>[];
  isLoading: boolean;
  error: unknown | null;
  saveItem: (item: KeepItem<TMeta>) => Promise<void>;
  updateNote: (id: string, note?: string) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
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

export function KeepProvider<TMeta = Record<string, unknown>>({
  storage = defaultStorage as StorageAdapter<TMeta>,
  onSave,
  onRemove,
  onNoteUpdate,
  onError,
  children,
}: KeepProviderProps<TMeta>) {
  const [items, setItems] = useState<KeepItem<TMeta>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown | null>(null);
  const itemsRef = useRef(items);

  const reportError = useCallback(
    (cause: unknown, context: KeepErrorContext) => {
      setError(cause);
      onError?.(cause, context);
    },
    [onError],
  );

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await storage.getAll();
      itemsRef.current = next;
      setItems(next);
      setError(null);
    } catch (cause) {
      reportError(cause, { action: "refresh" });
    } finally {
      setIsLoading(false);
    }
  }, [reportError, storage]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!storage.subscribe) return;
    return storage.subscribe(() => void refresh());
  }, [refresh, storage]);

  const persistItem = useCallback(
    async (item: KeepItem<TMeta>, action: KeepAction = "save") => {
      const previous = itemsRef.current;
      const next = [...previous.filter((current) => current.id !== item.id), item].sort(
        (a, b) => b.updatedAt - a.updatedAt,
      );
      itemsRef.current = next;
      setItems(next);
      setError(null);

      try {
        await storage.set(item);
      } catch (cause) {
        itemsRef.current = previous;
        setItems(previous);
        reportError(cause, { action, id: item.id });
        throw cause;
      }
    },
    [reportError, storage],
  );

  const saveItem = useCallback(
    async (item: KeepItem<TMeta>) => {
      await persistItem(item);
      onSave?.(item);
    },
    [onSave, persistItem],
  );

  const updateNote = useCallback(
    async (id: string, note?: string) => {
      const current = itemsRef.current.find((item) => item.id === id);
      if (!current) return;
      const nextNote = note?.trim() || undefined;
      const next = {
        ...current,
        note: nextNote,
        updatedAt: Date.now(),
      };
      await persistItem(next, "updateNote");
      onNoteUpdate?.(id, nextNote);
    },
    [onNoteUpdate, persistItem],
  );

  const removeItem = useCallback(
    async (id: string) => {
      const current = itemsRef.current.find((item) => item.id === id);
      if (!current) return;
      const previous = itemsRef.current;
      const next = previous.filter((item) => item.id !== id);
      itemsRef.current = next;
      setItems(next);
      setError(null);
      try {
        await storage.remove(id);
        onRemove?.(current);
      } catch (cause) {
        itemsRef.current = previous;
        setItems(previous);
        reportError(cause, { action: "remove", id });
        throw cause;
      }
    },
    [onRemove, reportError, storage],
  );

  const clear = useCallback(async () => {
    const previous = itemsRef.current;
    itemsRef.current = [];
    setItems([]);
    setError(null);
    try {
      await storage.clear();
    } catch (cause) {
      itemsRef.current = previous;
      setItems(previous);
      reportError(cause, { action: "clear" });
      throw cause;
    }
  }, [reportError, storage]);

  const value = useMemo<KeepContextValue<TMeta>>(
    () => ({ items, isLoading, error, saveItem, updateNote, removeItem, clear, refresh }),
    [clear, error, isLoading, items, refresh, removeItem, saveItem, updateNote],
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
