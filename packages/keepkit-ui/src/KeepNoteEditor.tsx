"use client";

import type { KeepItem } from "@keepkit/core/core";
import { useKeepItem } from "@keepkit/core/react";
import {
  type FormHTMLAttributes,
  isValidElement,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { type RenderProp, renderRoot } from "./shared";
import { useUiLabel } from "./ui-context";

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
  const defaultLabel = useUiLabel("note");
  const defaultSaveLabel = useUiLabel("saveNote");
  const itemState = useKeepItem<TMeta>(item);
  const { error, isMutating, item: savedItem, updateNote } = itemState;
  const contentChildren = asChild && isValidElement(children) ? undefined : children;
  const [note, setNote] = useState(item.note ?? "");
  const baselineNote = savedItem?.note ?? item.note ?? "";
  const isDirty = note !== baselineNote;
  const lastSavedNoteRef = useRef<string | undefined>(undefined);
  useEffect(() => setNote(baselineNote), [baselineNote]);
  const save = useCallback(async () => {
    const nextNote = note.trim() || undefined;
    try {
      await updateNote(nextNote);
      lastSavedNoteRef.current = note;
      onSaved?.(nextNote);
    } catch (error) {
      onSaveError?.(error);
      throw error;
    }
  }, [note, onSaveError, onSaved, updateNote]);
  useEffect(() => {
    if (!isDirty || debounceMs <= 0 || lastSavedNoteRef.current === note) return;
    const timer = window.setTimeout(() => void save().catch(() => undefined), debounceMs);
    return () => window.clearTimeout(timer);
  }, [debounceMs, isDirty, note, save]);
  const state: KeepNoteEditorState<TMeta> = {
    item,
    note,
    setNote,
    isDirty,
    isSaving: isMutating,
    error,
    save,
  };
  const body = render
    ? render(state)
    : typeof contentChildren === "function"
      ? contentChildren(state)
      : (contentChildren ?? (
          <>
            <label>
              {label ?? defaultLabel}
              <textarea
                value={note}
                onChange={(event) => setNote(event.currentTarget.value)}
                placeholder={placeholder}
                disabled={isMutating}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                    event.preventDefault();
                    void save().catch(() => undefined);
                  }
                }}
              />
            </label>
            <button type="submit" disabled={isMutating} aria-busy={isMutating}>
              {saveLabel ?? defaultSaveLabel}
            </button>
          </>
        ));
  const handleSubmit: FormHTMLAttributes<HTMLFormElement>["onSubmit"] = (event) => {
    event.preventDefault();
    void save().catch(() => undefined);
  };
  if (!asChild) {
    return (
      <form
        {...formProps}
        className={className}
        onSubmit={handleSubmit}
        aria-busy={isMutating || formProps["aria-busy"]}
        data-state={isDirty ? "dirty" : "clean"}
        data-loading={isMutating ? "true" : undefined}
        data-disabled={isMutating ? "true" : undefined}
      >
        {body}
      </form>
    );
  }
  return renderRoot(
    true,
    isValidElement(children) ? children : undefined,
    {
      ...formProps,
      className,
      onSubmit: handleSubmit,
      "aria-busy": isMutating || formProps["aria-busy"],
      "data-state": isDirty ? "dirty" : "clean",
      "data-loading": isMutating ? "true" : undefined,
      "data-disabled": isMutating ? "true" : undefined,
    },
    body,
    "KeepNoteEditor",
  );
}
