import { useKeepContext } from "@keepkit/core/react";
import { useKeepUiFeedback, useUiLabel } from "../ui-context";

export function useKeepUndo() {
  const context = useKeepContext();
  const emitFeedback = useKeepUiFeedback();
  const restoredMessage = useUiLabel("restoredMessage");
  return {
    canUndo: context.undo.canUndo,
    undo: async () => {
      const items = context.lastChange?.items ?? (context.lastChange?.item ? [context.lastChange.item] : []);
      await context.undoLastRemoval();
      if (items.length > 0) {
        emitFeedback({ type: "item-restored", item: items[0], items, message: restoredMessage });
      }
    },
    message: useUiLabel("undoAvailable"),
    label: useUiLabel("undo"),
  };
}
