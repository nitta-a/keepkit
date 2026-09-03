import { useKeepContext } from "@keepkit/core/react";
import { useUiLabel } from "../ui-context";

export function useKeepUndo() {
  const context = useKeepContext();
  return {
    canUndo: context.undo.canUndo,
    undo: () => context.undoLastRemoval(),
    message: useUiLabel("undoAvailable"),
    label: useUiLabel("undo"),
  };
}
