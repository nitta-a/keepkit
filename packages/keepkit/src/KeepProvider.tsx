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
import type { KeepErrorHandler, KeepEventHandlers, KeepItem, StorageAdapter } from "./types";

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
  onError,
  children,
}: KeepProviderProps<TMeta>) {
  const [items, setItems] = useState<KeepItem<TMeta>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown | null>(null);
  const itemsRef = useRef(items);

  const reportError = useCallback(
    (cause: unknown) => {
      setError(cause);
      onError?.(cause);
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
      reportError(cause);
    } finally {
      setIsLoading(false);
    }
  }, [reportError, storage]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorage = (event: StorageEvent) => {
      const storageKey = storage.storageKey;
      if (storageKey && event.key !== null && event.key !== storageKey) return;
      void refresh();
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [refresh, storage]);

  const saveItem = useCallback(
    async (item: KeepItem<TMeta>) => {
      try {
        await storage.set(item);
        const next = [...itemsRef.current.filter((current) => current.id !== item.id), item].sort(
          (a, b) => b.updatedAt - a.updatedAt,
        );
        itemsRef.current = next;
        setItems(next);
        setError(null);
        onSave?.(item);
      } catch (cause) {
        reportError(cause);
        throw cause;
      }
    },
    [onSave, reportError, storage],
  );

  const updateNote = useCallback(
    async (id: string, note?: string) => {
      const current = itemsRef.current.find((item) => item.id === id);
      if (!current) return;
      await saveItem({
        ...current,
        note: note?.trim() || undefined,
        updatedAt: Date.now(),
      });
    },
    [saveItem],
  );

  const removeItem = useCallback(
    async (id: string) => {
      const current = itemsRef.current.find((item) => item.id === id);
      if (!current) return;
      try {
        await storage.remove(id);
        const next = itemsRef.current.filter((item) => item.id !== id);
        itemsRef.current = next;
        setItems(next);
        setError(null);
        onRemove?.(current);
      } catch (cause) {
        reportError(cause);
        throw cause;
      }
    },
    [onRemove, reportError, storage],
  );

  const clear = useCallback(async () => {
    try {
      await storage.clear();
      itemsRef.current = [];
      setItems([]);
      setError(null);
    } catch (cause) {
      reportError(cause);
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
