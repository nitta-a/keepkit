import type { KeepItem, KeepItemStatus } from "@keepkit/core/core";
import { useKeepContext } from "@keepkit/core/react";
import { useState } from "react";
import { useKeepUiFeedback, useUiLabel } from "../../../foundation/ui-context";

type KeepStaleNoticeOptions<TMeta> = {
  item: KeepItem<TMeta>;
  onRetry: ((item: KeepItem<TMeta>) => void | Promise<void>) | undefined;
  onRemoved: ((item: KeepItem<TMeta>) => void) | undefined;
};

export function useKeepStaleNotice<TMeta>({ item, onRetry, onRemoved }: KeepStaleNoticeOptions<TMeta>) {
  const context = useKeepContext<TMeta>();
  const emitFeedback = useKeepUiFeedback<TMeta>();
  const removedMessage = useUiLabel("removedMessage");
  const restoredMessage = useUiLabel("restoredMessage");
  const undoLabel = useUiLabel("undo");
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
      emitFeedback({
        type: "item-removed",
        item,
        message: removedMessage,
        undoLabel,
        undo: async () => {
          await context.undoLastRemoval();
          emitFeedback({ type: "item-restored", item, items: [item], message: restoredMessage });
        },
      });
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
  const emitFeedback = useKeepUiFeedback<TMeta>();
  const staleItems = context.items.filter((item) => item.status && statuses.includes(item.status));
  const staleIds = staleItems.map((item) => item.id);
  const restoredMessage = useUiLabel("restoredMessage");
  const prunedMessage = useUiLabel("stalePrunedMessage");
  const undoLabel = useUiLabel("undo");

  return {
    staleIds,
    isMutating: context.isMutating,
    label: useUiLabel("pruneStale"),
    prune: async () => {
      const ids = [...staleIds];
      const items = [...staleItems];
      await context.removeItemsWithUndo(ids);
      onPruned?.(ids);
      if (items.length > 0) {
        emitFeedback({
          type: "stale-pruned",
          item: items[0],
          items,
          message: prunedMessage,
          undoLabel,
          undo: async () => {
            await context.undoLastRemoval();
            emitFeedback({ type: "item-restored", item: items[0], items, message: restoredMessage });
          },
        });
      }
    },
  };
}
