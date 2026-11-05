"use client";

import { type HTMLAttributes, type ReactNode, useRef, useState } from "react";
import { getErrorMessage } from "../../foundation/shared";
import { useUiLabel, useUiLabelVisibility } from "../../foundation/ui-context";
import { useKeepUndo } from "./hooks/useKeepUndo";

export type KeepUndoProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  children?: ReactNode;
  label?: ReactNode;
};

/** Presents the short-lived undo action created by removeWithUndo/removeBatchWithUndo. */
export function KeepUndo({ children, label, ...props }: KeepUndoProps) {
  const view = useKeepUndo();
  const showLabel = useUiLabelVisibility("undo");
  const errorLabel = useUiLabel("error");
  const [error, setError] = useState<unknown>();
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  if (!view.canUndo && !pending && !error) return null;
  async function undo() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setError(undefined);
    setPending(true);
    try {
      await view.undo();
    } catch (cause) {
      setError(cause);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }
  return (
    <div {...props} role="status" aria-live="polite" data-keepkit="undo" data-state={error ? "error" : "available"}>
      {view.canUndo || pending ? (
        <>
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
          <button
            type="button"
            data-keep-action="undo"
            aria-label={showLabel ? undefined : view.label}
            disabled={pending}
            onClick={() => void undo()}
          >
            {showLabel ? (label ?? view.label) : null}
          </button>
        </>
      ) : null}
      {error ? <p role="alert">{getErrorMessage(error, errorLabel)}</p> : null}
    </div>
  );
}
