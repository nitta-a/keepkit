"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { useKeepUndo } from "./hooks/useKeepUndo";

export type KeepUndoProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  children?: ReactNode;
  label?: ReactNode;
};

/** Presents the short-lived undo action created by removeWithUndo/removeBatchWithUndo. */
export function KeepUndo({ children, label, ...props }: KeepUndoProps) {
  const view = useKeepUndo();
  if (!view.canUndo) return null;
  return (
    <div {...props} role="status" aria-live="polite" data-keepkit="undo" data-state="available">
      {children ?? view.message}
      <button type="button" data-keep-action="undo" onClick={() => void view.undo()}>
        {label ?? view.label}
      </button>
    </div>
  );
}
