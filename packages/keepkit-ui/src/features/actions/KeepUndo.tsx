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
      <span data-keepkit="undo-message">{children ?? view.message}</span>
      <span data-keepkit="undo-countdown" aria-hidden="true">
        {view.remainingSeconds}s
      </span>
      <progress
        data-keepkit="undo-progress"
        max={1}
        value={view.progress}
        aria-label={String(view.label)}
        aria-valuetext={`${view.remainingSeconds}s`}
      />
      <button type="button" data-keep-action="undo" onClick={() => void view.undo()}>
        {label ?? view.label}
      </button>
    </div>
  );
}
