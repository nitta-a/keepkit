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
  toggle: () => Promise<void>;
  updateNote: (note?: string) => Promise<void>;
  updateTags: (tags?: string[]) => Promise<void>;
  refreshMetadata: (refresh: KeepItemMetadataRefresher<TMeta>) => Promise<void>;
};

export function useKeepItem<TMeta = Record<string, unknown>>(
  id: string,
  itemPayload?: KeepItemInput<TMeta>,
): UseKeepItemResult<TMeta> {
  const { store, actions } = useKeepStore<TMeta>();
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

  const save = useCallback(async () => {
    if (!itemPayload) {
      throw new Error(`An itemPayload is required to save item "${id}".`);
    }
    const now = Date.now();
    await actions.saveItem({
      id,
      ...itemPayload,
      savedAt: item?.savedAt ?? now,
      updatedAt: now,
    });
  }, [actions, id, item?.savedAt, itemPayload]);

  const remove = useCallback(() => actions.removeItem(id), [actions, id]);
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
    toggle,
    updateNote,
    updateTags,
    refreshMetadata,
  };
}
