"use client";

import type { KeepItem } from "@keepkit/core/core";
import { useKeepCollections, useKeepItem } from "@keepkit/core/react";
import {
  type FormEvent,
  type FormHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
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
  saveStatus: "idle" | "dirty" | "saving" | "saved" | "error";
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
  const [saveStatus, setSaveStatus] = useState<KeepQuickEditorState<TMeta>["saveStatus"]>("idle");
  const [saveError, setSaveError] = useState<unknown | null>(null);
  const baselineRef = useRef({
    note: baseline.note ?? "",
    tags: baseline.tags ?? [],
    collectionId: baseline.collectionId,
  });
  const draftRef = useRef({ note, tags, collectionId });
  const flushRequestedRef = useRef(false);
  const flushPromiseRef = useRef<Promise<void> | null>(null);
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
  useEffect(() => {
    if (!isDirty && saveStatus === "dirty" && !flushPromiseRef.current) setSaveStatus("idle");
  }, [isDirty, saveStatus]);
  const flush = useCallback((): Promise<void> => {
    flushRequestedRef.current = true;
    if (flushPromiseRef.current) return flushPromiseRef.current;

    const run = async () => {
      let saved = false;
      while (flushRequestedRef.current || !sameDraft(draftRef.current, baselineRef.current)) {
        flushRequestedRef.current = false;
        const draft = { ...draftRef.current, tags: [...draftRef.current.tags] };
        const previous = baselineRef.current;
        if (sameDraft(draft, previous)) continue;

        setSaveError(null);
        setSaveStatus("saving");
        try {
          if (draft.note !== previous.note) await updateNote(draft.note.trim() || undefined);
          if (!sameTags(draft.tags, previous.tags)) await updateTags(draft.tags);
          if (draft.collectionId !== previous.collectionId) await moveToCollection(draft.collectionId);
        } catch (error) {
          setSaveError(error);
          setSaveStatus("error");
          onSaveError?.(error);
          throw error;
        }

        baselineRef.current = draft;
        saved = true;
        const { collectionId: _oldCollectionId, ...withoutCollection } = baseline;
        onSaved?.({
          ...withoutCollection,
          note: draft.note.trim() || undefined,
          tags: draft.tags,
          ...(draft.collectionId ? { collectionId: draft.collectionId } : {}),
        });
        if (!sameDraft(draftRef.current, baselineRef.current)) flushRequestedRef.current = true;
      }
      if (saved) setSaveStatus("saved");
    };

    const promise = run().finally(() => {
      flushPromiseRef.current = null;
    });
    flushPromiseRef.current = promise;
    return promise;
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
      setNote: (value) => {
        setSaveError(null);
        setSaveStatus("dirty");
        setNote(value);
      },
      setTags: (value) => {
        setSaveError(null);
        setSaveStatus("dirty");
        setTags(value);
      },
      setCollectionId: (value) => {
        setSaveError(null);
        setSaveStatus("dirty");
        setCollectionId(value);
      },
      isDirty,
      isSaving: isMutating || saveStatus === "saving",
      saveStatus,
      error: saveError ?? error,
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
  showSaveButton?: boolean;
  children?: ReactNode | ((state: KeepQuickEditorState<TMeta>) => ReactNode);
  onClose?: () => void;
  onSaved?: (item: KeepItem<TMeta>) => void;
  onSaveError?: (error: unknown) => void;
};

/** A compact, temporary-state editor for note, tags, and collection metadata. */
export function KeepQuickEditor<TMeta = Record<string, unknown>>({
  item,
  debounceMs = 300,
  onSaved,
  onSaveError,
  ...props
}: KeepQuickEditorProps<TMeta>) {
  const view = useKeepQuickEditor(item, { debounceMs, onSaved, onSaveError });
  return <KeepQuickEditorView {...props} state={view.state} />;
}

type KeepQuickEditorViewProps<TMeta> = Omit<
  KeepQuickEditorProps<TMeta>,
  "item" | "debounceMs" | "onSaved" | "onSaveError"
> & {
  state: KeepQuickEditorState<TMeta>;
  focusScopeRef?: RefObject<HTMLElement | null>;
};

/** Internal view used by KeepSavePopover so close requests can await the same editor state. */
export function KeepQuickEditorView<TMeta = Record<string, unknown>>({
  state,
  collectionIds,
  collectionLabels,
  showSaveButton = true,
  children,
  onClose,
  focusScopeRef,
  ...props
}: KeepQuickEditorViewProps<TMeta>) {
  const collections = useKeepCollections<TMeta>({ targetType: state.item.targetType, orderBy: "name" });
  const rootRef = useRef<HTMLFormElement>(null);
  const noteLabel = useUiLabel("note");
  const tagsLabel = useUiLabel("tags");
  const collectionLabel = useUiLabel("collection");
  const uncategorizedLabel = useUiLabel("uncategorized");
  const saveLabel = useUiLabel("saveWithNote");
  const closeLabel = useUiLabel("close");
  const unsavedChangesLabel = useUiLabel("unsavedChanges");
  const savingLabel = useUiLabel("saving");
  const savedLabel = useUiLabel("saved");
  const errorLabel = useUiLabel("error");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void state.flush().catch(() => undefined);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    props.onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === "Escape") {
      event.preventDefault();
      void state
        .flush()
        .then(() => onClose?.())
        .catch(() => undefined);
    }
    if (event.key === "Tab") trapFocus(event, focusScopeRef?.current ?? rootRef.current);
  };
  const statusMessage =
    state.saveStatus === "dirty"
      ? unsavedChangesLabel
      : state.saveStatus === "saving"
        ? savingLabel
        : state.saveStatus === "saved"
          ? savedLabel
          : state.saveStatus === "error"
            ? getErrorMessage(state.error, errorLabel)
            : null;
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
                {(collectionIds ?? collections.map((collection) => collection.id)).map((id) => (
                  <option key={id} value={id}>
                    {collectionLabels?.[id] ?? id}
                  </option>
                ))}
              </select>
            </label>
            {statusMessage ? (
              <p
                role={state.saveStatus === "error" ? "alert" : "status"}
                aria-live={state.saveStatus === "error" ? "assertive" : "polite"}
                tabIndex={state.saveStatus === "error" ? -1 : undefined}
                data-keep-editor-status="true"
                data-state={state.saveStatus}
              >
                {statusMessage}
              </p>
            ) : null}
            {showSaveButton ? (
              <button type="submit" disabled={state.isSaving} data-keep-action="save-quick-edit">
                {saveLabel}
              </button>
            ) : null}
            {onClose ? (
              <button
                type="button"
                onClick={() =>
                  void state
                    .flush()
                    .then(onClose)
                    .catch(() => undefined)
                }
                disabled={state.isSaving}
                data-keep-action="close-quick-edit"
              >
                {closeLabel}
              </button>
            ) : null}
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
      data-save-status={state.saveStatus}
      aria-busy={state.isSaving || props["aria-busy"]}
    >
      {body}
    </form>
  );
}

function sameDraft(
  left: { note: string; tags: string[]; collectionId?: string },
  right: { note: string; tags: string[]; collectionId?: string },
): boolean {
  return left.note === right.note && sameTags(left.tags, right.tags) && left.collectionId === right.collectionId;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
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
