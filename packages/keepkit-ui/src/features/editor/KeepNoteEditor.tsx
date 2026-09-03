"use client";

import type { KeepItem } from "@keepkit/core/core";
import { type FormHTMLAttributes, isValidElement, type ReactNode } from "react";
import { type RenderProp, renderRoot } from "../../foundation/shared";
import { useKeepNoteEditor } from "./hooks/useKeepNoteEditor";

export type KeepNoteEditorState<TMeta = Record<string, unknown>> = {
  item: KeepItem<TMeta>;
  note: string;
  setNote: (note: string) => void;
  isDirty: boolean;
  isSaving: boolean;
  error: unknown | null;
  save: () => Promise<void>;
};

export type KeepNoteEditorProps<TMeta = Record<string, unknown>> = Omit<
  FormHTMLAttributes<HTMLFormElement>,
  "children" | "onSubmit"
> & {
  item: KeepItem<TMeta>;
  label?: ReactNode;
  saveLabel?: ReactNode;
  placeholder?: string;
  /** Automatically save dirty notes after this delay; set to 0 to disable auto-save. */
  debounceMs?: number;
  onSaved?: (note?: string) => void;
  onSaveError?: (error: unknown) => void;
  render?: RenderProp<KeepNoteEditorState<TMeta>>;
  children?: ReactNode | RenderProp<KeepNoteEditorState<TMeta>>;
  asChild?: boolean;
};

/** A controlled-by-default note editor that persists through useKeepItem. */
export function KeepNoteEditor<TMeta = Record<string, unknown>>({
  item,
  label,
  saveLabel,
  placeholder,
  debounceMs = 300,
  onSaved,
  onSaveError,
  render,
  children,
  asChild = false,
  className,
  ...formProps
}: KeepNoteEditorProps<TMeta>) {
  const view = useKeepNoteEditor<TMeta>({ item, debounceMs, onSaved, onSaveError });
  const { error, isDirty, isSaving, note, setNote } = view.state;
  const contentChildren = asChild && isValidElement(children) ? undefined : children;
  const body = render
    ? render(view.state)
    : typeof contentChildren === "function"
      ? contentChildren(view.state)
      : (contentChildren ?? (
          <>
            <label>
              {label ?? view.labels.note}
              <textarea
                data-keep-action="edit-note"
                value={note}
                onChange={(event) => setNote(event.currentTarget.value)}
                placeholder={placeholder}
                disabled={isSaving}
                onKeyDown={view.handleKeyDown}
              />
            </label>
            <button type="submit" data-keep-action="save-note" disabled={isSaving} aria-busy={isSaving}>
              {saveLabel ?? view.labels.save}
            </button>
          </>
        ));
  if (!asChild) {
    return (
      <form
        {...formProps}
        className={className}
        data-keepkit="note-editor"
        onSubmit={view.submit}
        aria-busy={isSaving || formProps["aria-busy"]}
        data-state={error ? "error" : isDirty ? "dirty" : "clean"}
        data-loading={isSaving ? "true" : undefined}
        data-disabled={isSaving ? "true" : undefined}
      >
        {body}
        {error ? <p role="alert">{getErrorMessage(error, view.labels.error)}</p> : null}
      </form>
    );
  }
  return renderRoot(
    true,
    isValidElement(children) ? children : undefined,
    {
      ...formProps,
      className,
      "data-keepkit": "note-editor",
      onSubmit: view.submit,
      "aria-busy": isSaving || formProps["aria-busy"],
      "data-state": error ? "error" : isDirty ? "dirty" : "clean",
      "data-loading": isSaving ? "true" : undefined,
      "data-disabled": isSaving ? "true" : undefined,
    },
    body,
    "KeepNoteEditor",
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
