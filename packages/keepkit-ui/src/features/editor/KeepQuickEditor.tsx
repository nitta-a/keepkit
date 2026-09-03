"use client";

import type { KeepItem } from "@keepkit/core/core";
import { useKeepContext, useKeepItem } from "@keepkit/core/react";
import {
  type FormEvent,
  type FormHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useUiLabel } from "../../foundation/ui-context";

export type KeepQuickEditorState<TMeta = Record<string, unknown>> = {
  item: KeepItem<TMeta>;
  note: string;
  tags: string[];
  collectionId?: string;
  setNote: (value: string) => void;
  setTags: (value: string[]) => void;
  setCollectionId: (value?: string) => void;
  isDirty: boolean;
  isSaving: boolean;
  error: unknown | null;
  flush: () => Promise<void>;
};

export function useKeepQuickEditor<TMeta = Record<string, unknown>>(
  item: KeepItem<TMeta>,
  options: {
    debounceMs?: number;
    onSaved?: (item: KeepItem<TMeta>) => void;
    onSaveError?: (error: unknown) => void;
  } = {},
) {
  const { debounceMs = 300, onSaved, onSaveError } = options;
  const itemState = useKeepItem<TMeta>(item);
  const { error, isMutating, moveToCollection, updateNote, updateTags } = itemState;
  const baseline = itemState.item ?? item;
  const [note, setNote] = useState(baseline.note ?? "");
  const [tags, setTags] = useState(baseline.tags ?? []);
  const [collectionId, setCollectionId] = useState(baseline.collectionId);
  const baselineRef = useRef({
    note: baseline.note ?? "",
    tags: baseline.tags ?? [],
    collectionId: baseline.collectionId,
  });
  const draftRef = useRef({ note, tags, collectionId });
  draftRef.current = { note, tags, collectionId };
  useEffect(() => {
    if (
      draftRef.current.note === baselineRef.current.note &&
      sameTags(draftRef.current.tags, baselineRef.current.tags) &&
      draftRef.current.collectionId === baselineRef.current.collectionId
    ) {
      setNote(baseline.note ?? "");
      setTags(baseline.tags ?? []);
      setCollectionId(baseline.collectionId);
      baselineRef.current = {
        note: baseline.note ?? "",
        tags: baseline.tags ?? [],
        collectionId: baseline.collectionId,
      };
    }
  }, [baseline]);
  const isDirty =
    note !== baselineRef.current.note ||
    !sameTags(tags, baselineRef.current.tags) ||
    collectionId !== baselineRef.current.collectionId;
  const flush = useCallback(async () => {
    const draft = draftRef.current;
    try {
      if (draft.note !== baselineRef.current.note) await updateNote(draft.note.trim() || undefined);
      if (!sameTags(draft.tags, baselineRef.current.tags)) await updateTags(draft.tags);
      if (draft.collectionId !== baselineRef.current.collectionId) await moveToCollection(draft.collectionId);
      baselineRef.current = { note: draft.note, tags: [...draft.tags], collectionId: draft.collectionId };
      const { collectionId: _oldCollectionId, ...withoutCollection } = baseline;
      onSaved?.({
        ...withoutCollection,
        note: draft.note.trim() || undefined,
        tags: draft.tags,
        ...(draft.collectionId ? { collectionId: draft.collectionId } : {}),
      });
    } catch (error) {
      onSaveError?.(error);
      throw error;
    }
  }, [baseline, moveToCollection, onSaveError, onSaved, updateNote, updateTags]);
  useEffect(() => {
    if (!isDirty || debounceMs <= 0) return;
    const timer = window.setTimeout(() => void flush().catch(() => undefined), debounceMs);
    return () => window.clearTimeout(timer);
  }, [debounceMs, flush, isDirty]);
  return {
    state: {
      item,
      note,
      tags,
      collectionId,
      setNote,
      setTags,
      setCollectionId,
      isDirty,
      isSaving: isMutating,
      error,
      flush,
    } satisfies KeepQuickEditorState<TMeta>,
  };
}

export type KeepQuickEditorProps<TMeta = Record<string, unknown>> = Omit<
  FormHTMLAttributes<HTMLFormElement>,
  "children" | "onSubmit"
> & {
  item: KeepItem<TMeta>;
  debounceMs?: number;
  collectionIds?: string[];
  collectionLabels?: Record<string, string>;
  children?: ReactNode | ((state: KeepQuickEditorState<TMeta>) => ReactNode);
  onClose?: () => void;
  onSaved?: (item: KeepItem<TMeta>) => void;
  onSaveError?: (error: unknown) => void;
};

/** A compact, temporary-state editor for note, tags, and collection metadata. */
export function KeepQuickEditor<TMeta = Record<string, unknown>>({
  item,
  debounceMs = 300,
  collectionIds,
  collectionLabels,
  children,
  onClose,
  onSaved,
  onSaveError,
  ...props
}: KeepQuickEditorProps<TMeta>) {
  const view = useKeepQuickEditor(item, { debounceMs, onSaved, onSaveError });
  const context = useKeepContext<TMeta>();
  const { state } = view;
  const rootRef = useRef<HTMLFormElement>(null);
  const noteLabel = useUiLabel("note");
  const tagsLabel = useUiLabel("tags");
  const collectionLabel = useUiLabel("collection");
  const uncategorizedLabel = useUiLabel("uncategorized");
  const saveLabel = useUiLabel("saveWithNote");
  const closeLabel = useUiLabel("close");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void state.flush().catch(() => undefined);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      void state
        .flush()
        .then(() => onClose?.())
        .catch(() => undefined);
    }
    if (event.key === "Tab") trapFocus(event, rootRef.current);
  };
  const body =
    typeof children === "function"
      ? children(state)
      : (children ?? (
          <>
            <label>
              {noteLabel}
              <textarea value={state.note} onChange={(event) => state.setNote(event.currentTarget.value)} />
            </label>
            <label>
              {tagsLabel}
              <input
                value={state.tags.join(", ")}
                onChange={(event) =>
                  state.setTags(
                    event.currentTarget.value
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  )
                }
              />
            </label>
            <label>
              {collectionLabel}
              <select
                value={state.collectionId ?? ""}
                onChange={(event) => state.setCollectionId(event.currentTarget.value || undefined)}
              >
                <option value="">{uncategorizedLabel}</option>
                {(
                  collectionIds ??
                  [
                    ...new Set(
                      context.items.map((entry) => entry.collectionId).filter((id): id is string => Boolean(id)),
                    ),
                  ].sort()
                ).map((id) => (
                  <option key={id} value={id}>
                    {collectionLabels?.[id] ?? id}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={state.isSaving} data-keep-action="save-quick-edit">
              {saveLabel}
            </button>
            <button
              type="button"
              onClick={() =>
                void state
                  .flush()
                  .then(() => onClose?.())
                  .catch(() => undefined)
              }
              disabled={state.isSaving}
              data-keep-action="close-quick-edit"
            >
              {closeLabel}
            </button>
          </>
        ));
  return (
    <form
      {...props}
      ref={rootRef}
      onSubmit={submit}
      onKeyDown={onKeyDown}
      data-keepkit="quick-editor"
      data-state={state.isDirty ? "dirty" : "clean"}
      aria-busy={state.isSaving || props["aria-busy"]}
    >
      {body}
    </form>
  );
}

function sameTags(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((tag, index) => tag === right[index]);
}

function trapFocus(event: KeyboardEvent<HTMLElement>, root: HTMLElement | null): void {
  if (!root) return;
  const elements = [
    ...root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
  ].filter((element) => !element.hasAttribute("disabled"));
  if (elements.length === 0) return;
  const first = elements[0];
  const last = elements[elements.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
