"use client";

import { useKeepContext } from "@keepkit/core/react";
import type { HTMLAttributes, ReactNode } from "react";
import { useUiLabel } from "./ui-context";

export type KeepUndoProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  children?: ReactNode;
  label?: ReactNode;
};

/** Presents the short-lived undo action created by removeWithUndo/removeBatchWithUndo. */
export function KeepUndo({ children, label, ...props }: KeepUndoProps) {
  const context = useKeepContext();
  const message = useUiLabel("undoAvailable");
  const undoLabel = useUiLabel("undo");
  if (!context.undo.canUndo) return null;
  return (
    <div {...props} role="status" aria-live="polite" data-keepkit="undo" data-state="available">
      {children ?? message}
      <button type="button" onClick={() => void context.undoLastRemoval()}>
        {label ?? undoLabel}
      </button>
    </div>
  );
}
