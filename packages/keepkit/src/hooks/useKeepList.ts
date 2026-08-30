import { useCallback, useMemo } from "react";
import { useKeepContext } from "../KeepProvider";
import type { KeepItem } from "../types";

export type KeepListOptions<TMeta = Record<string, unknown>> = {
  targetType?: string;
  tag?: string;
  tags?: string[];
  sort?: {
    by: "savedAt" | "updatedAt";
    direction?: "asc" | "desc";
  };
  filter?: (item: KeepItem<TMeta>) => boolean;
};

export type UseKeepListResult<TMeta = Record<string, unknown>> = {
  items: KeepItem<TMeta>[];
  isLoading: boolean;
  error: unknown | null;
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  refresh: () => Promise<void>;
};

export function useKeepList<TMeta = Record<string, unknown>>(
  options: KeepListOptions<TMeta> = {},
): UseKeepListResult<TMeta> {
  const context = useKeepContext<TMeta>();
  const items = useMemo(() => {
    const filtered = context.items.filter(
      (item) =>
        (options.targetType === undefined || item.targetType === options.targetType) &&
        (options.tag === undefined || item.tags?.includes(options.tag) === true) &&
        (options.tags === undefined || options.tags.every((tag) => item.tags?.includes(tag))) &&
        (options.filter === undefined || options.filter(item)),
    );
    if (!options.sort) return filtered;
    const { by, direction: requestedDirection } = options.sort;
    const direction = requestedDirection === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => (a[by] - b[by]) * direction);
  }, [context.items, options.filter, options.sort, options.tag, options.tags, options.targetType]);
  const remove = useCallback((id: string) => context.removeItem(id), [context]);

  return {
    items,
    isLoading: context.isLoading,
    error: context.error,
    remove,
    clear: context.clear,
    refresh: context.refresh,
  };
}
