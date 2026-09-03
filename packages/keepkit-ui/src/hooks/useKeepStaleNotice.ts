import type { KeepItem, KeepItemStatus } from "@keepkit/core/core";
import { useKeepContext } from "@keepkit/core/react";
import { useState } from "react";
import { useUiLabel } from "../ui-context";

type KeepStaleNoticeOptions<TMeta> = {
  item: KeepItem<TMeta>;
  onRetry: ((item: KeepItem<TMeta>) => void | Promise<void>) | undefined;
  onRemoved: ((item: KeepItem<TMeta>) => void) | undefined;
};

export function useKeepStaleNotice<TMeta>({ item, onRetry, onRemoved }: KeepStaleNoticeOptions<TMeta>) {
  const context = useKeepContext<TMeta>();
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<unknown | null>(null);

  async function retry() {
    setError(null);
    setIsRetrying(true);
    try {
      if (onRetry) await onRetry(item);
      else await context.revalidateItems();
    } catch (cause) {
      setError(cause);
    } finally {
      setIsRetrying(false);
    }
  }

  async function remove() {
    try {
      await context.removeItemWithUndo(item.id);
      onRemoved?.(item);
    } catch (cause) {
      setError(cause);
    }
  }

  return {
    status: item.status && item.status !== "available" ? item.status : "unknown",
    error,
    isRetrying,
    isMutating: context.isMutating,
    retry,
    remove,
    labels: {
      retry: useUiLabel("retry"),
      remove: useUiLabel("removeFromList"),
      error: useUiLabel("error"),
    },
  };
}

type KeepPruneStaleOptions = {
  statuses: KeepItemStatus[];
  onPruned: ((ids: string[]) => void) | undefined;
};

export function useKeepPruneStale<TMeta>({ statuses, onPruned }: KeepPruneStaleOptions) {
  const context = useKeepContext<TMeta>();
  const staleIds = context.items.filter((item) => item.status && statuses.includes(item.status)).map((item) => item.id);

  return {
    staleIds,
    isMutating: context.isMutating,
    label: useUiLabel("pruneStale"),
    prune: async () => {
      const ids = [...staleIds];
      await context.removeItemsWithUndo(ids);
      onPruned?.(ids);
    },
  };
}
