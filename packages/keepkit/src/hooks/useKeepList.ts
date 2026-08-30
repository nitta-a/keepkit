import { useCallback, useMemo } from "react";
import { useKeepContext } from "../KeepProvider";
import type { KeepItem } from "../types";

export type KeepListOptions<TMeta = Record<string, unknown>> = {
  targetType?: string;
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
  const items = useMemo(
    () =>
      context.items.filter(
        (item) =>
          (options.targetType === undefined || item.targetType === options.targetType) &&
          (options.filter === undefined || options.filter(item)),
      ),
    [context.items, options.filter, options.targetType],
  );
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
