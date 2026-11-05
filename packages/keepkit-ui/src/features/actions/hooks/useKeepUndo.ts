import { useKeepContext, useKeepStore } from "@keepkit/core/react";
import { useEffect, useState } from "react";
import { useKeepUiFeedback, useUiLabel } from "../../../foundation/ui-context";

export function useKeepUndo() {
  const context = useKeepContext();
  const { store } = useKeepStore();
  const emitFeedback = useKeepUiFeedback();
  const restoredMessage = useUiLabel("restoredMessage");
  const { canUndo, startedAt, expiresAt } = context.undo;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!canUndo || expiresAt === undefined) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [canUndo, expiresAt]);

  const duration = Math.max(1, (expiresAt ?? now) - (startedAt ?? now));
  const remainingMs = Math.max(0, (expiresAt ?? now) - now);
  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const progress = Math.min(1, Math.max(0, remainingMs / duration));
  return {
    canUndo,
    expiresAt,
    remainingMs,
    remainingSeconds,
    progress,
    undo: async () => {
      const before = store.getSnapshot().lastChange;
      const ids = context.undo.ids;
      await context.undoLastRemoval();
      const change = store.getSnapshot().lastChange;
      const items = change?.action === "undo" && change !== before ? (change.items ?? []) : [];
      if (items.length > 0 && items.length === ids.length && items.every((item) => ids.includes(item.id))) {
        emitFeedback({ type: "item-restored", item: items[0], items, message: restoredMessage });
      }
    },
    message: useUiLabel("undoAvailable"),
    label: useUiLabel("undo"),
  };
}
