import type { KeepItem } from "@keepkit/core/core";
import { useKeepItem } from "@keepkit/core/react";
import type { FormHTMLAttributes, KeyboardEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { KeepNoteEditorState } from "../KeepNoteEditor";
import { useUiLabel } from "../ui-context";

type KeepNoteEditorOptions<TMeta> = {
  item: KeepItem<TMeta>;
  debounceMs: number;
  onSaved: ((note?: string) => void) | undefined;
  onSaveError: ((error: unknown) => void) | undefined;
};

export function useKeepNoteEditor<TMeta>({ item, debounceMs, onSaved, onSaveError }: KeepNoteEditorOptions<TMeta>) {
  const itemState = useKeepItem<TMeta>(item);
  const { error, isMutating, item: savedItem, updateNote } = itemState;
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
    } catch (cause) {
      onSaveError?.(cause);
      throw cause;
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
  const submit: FormHTMLAttributes<HTMLFormElement>["onSubmit"] = (event) => {
    event.preventDefault();
    void save().catch(() => undefined);
  };

  return {
    state,
    submit,
    handleKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || (!event.ctrlKey && !event.metaKey)) return;
      event.preventDefault();
      void save().catch(() => undefined);
    },
    labels: {
      note: useUiLabel("note"),
      save: useUiLabel("saveNote"),
      error: useUiLabel("error"),
    },
  };
}
