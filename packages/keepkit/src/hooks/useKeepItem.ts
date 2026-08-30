import { useCallback } from "react";
import { useKeepContext } from "../KeepProvider";
import type { KeepItem, KeepItemInput } from "../types";

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
};

export function useKeepItem<TMeta = Record<string, unknown>>(
  id: string,
  itemPayload?: KeepItemInput<TMeta>,
): UseKeepItemResult<TMeta> {
  const context = useKeepContext<TMeta>();
  const item = context.items.find((current) => current.id === id);

  const save = useCallback(async () => {
    if (!itemPayload) {
      throw new Error(`An itemPayload is required to save item "${id}".`);
    }
    const now = Date.now();
    await context.saveItem({
      id,
      ...itemPayload,
      savedAt: item?.savedAt ?? now,
      updatedAt: now,
    });
  }, [context, id, item?.savedAt, itemPayload]);

  const remove = useCallback(() => context.removeItem(id), [context, id]);
  const toggle = useCallback(() => (item ? remove() : save()), [item, remove, save]);
  const updateNote = useCallback((note?: string) => context.updateNote(id, note), [context, id]);
  const updateTags = useCallback((tags?: string[]) => context.updateTags(id, tags), [context, id]);

  return {
    item,
    isSaved: Boolean(item),
    isLoading: context.isLoading,
    isMutating: context.isMutating,
    error: context.error,
    save,
    remove,
    toggle,
    updateNote,
    updateTags,
  };
}
