import { useCallback } from "react";
import { useKeepStore } from "../KeepProvider";
import type { KeepItemMetadataRefresher } from "../revalidation";
import type { KeepItem, KeepItemInput } from "../types";
import { useKeepStoreSelector } from "./useKeepStoreSelector";

export type UseKeepItemResult<TMeta = Record<string, unknown>> = {
  item: KeepItem<TMeta> | undefined;
  isSaved: boolean;
  isLoading: boolean;
  isMutating: boolean;
  error: unknown | null;
  save: () => Promise<void>;
  remove: () => Promise<void>;
  removeWithUndo: () => Promise<void>;
  undo: () => Promise<void>;
  toggle: () => Promise<void>;
  updateNote: (note?: string) => Promise<void>;
  updateTags: (tags?: string[]) => Promise<void>;
  refreshMetadata: (refresh: KeepItemMetadataRefresher<TMeta>) => Promise<void>;
};

/** Read and mutate one saved item from its complete minimal input description. */
export function useKeepItem<TMeta = Record<string, unknown>>(input?: KeepItemInput<TMeta>): UseKeepItemResult<TMeta> {
  const { store, actions } = useKeepStore<TMeta>();
  const id = input?.id ?? "";
  const item = useKeepStoreSelector(
    store,
    useCallback((state) => state.items.find((current) => current.id === id), [id]),
  );
  const isLoading = useKeepStoreSelector(
    store,
    useCallback((state) => state.isLoading, []),
  );
  const isMutating = useKeepStoreSelector(
    store,
    useCallback((state) => state.isMutating, []),
  );
  const error = useKeepStoreSelector(
    store,
    useCallback((state) => state.error, []),
  );
  const currentOrder = item?.order;

  const save = useCallback(async () => {
    if (!input) throw new Error("An item input is required to save an item.");
    const now = Date.now();
    await actions.saveItem({
      ...input,
      ...(currentOrder === undefined ? {} : { order: currentOrder }),
      savedAt: item?.savedAt ?? now,
      updatedAt: now,
    });
  }, [actions, currentOrder, input, item?.savedAt]);

  const remove = useCallback(() => actions.removeItem(id), [actions, id]);
  const removeWithUndo = useCallback(() => actions.removeItemWithUndo(id), [actions, id]);
  const toggle = useCallback(() => (item ? remove() : save()), [item, remove, save]);
  const updateNote = useCallback((note?: string) => actions.updateNote(id, note), [actions, id]);
  const updateTags = useCallback((tags?: string[]) => actions.updateTags(id, tags), [actions, id]);
  const refreshMetadata = useCallback(
    (refresh: KeepItemMetadataRefresher<TMeta>) => actions.refreshItemMetadata(id, refresh),
    [actions, id],
  );

  return {
    item,
    isSaved: Boolean(item),
    isLoading,
    isMutating,
    error,
    save,
    remove,
    removeWithUndo,
    undo: actions.undoLastRemoval,
    toggle,
    updateNote,
    updateTags,
    refreshMetadata,
  };
}
