"use client";

import type { KeepItem } from "@keepkit/core/core";
import type { FormHTMLAttributes } from "react";
import type { RenderProp } from "../../foundation/shared";
import { useKeepTagEditor } from "./hooks/useKeepTagEditor";

export type KeepTagEditorState = {
  tags: string[];
  setTags: (tags: string[]) => void;
  save: () => Promise<void>;
  isSaving: boolean;
};

export type KeepTagEditorProps<TMeta = Record<string, unknown>> = Omit<
  FormHTMLAttributes<HTMLFormElement>,
  "children" | "onSubmit"
> & {
  item: KeepItem<TMeta>;
  availableTags?: string[];
  onSaved?: (tags?: string[]) => void;
  onSaveError?: (error: unknown) => void;
  render?: RenderProp<KeepTagEditorState>;
};

/** Edits one item's normalized tag set; Enter adds and Backspace removes the last tag. */
export function KeepTagEditor<TMeta = Record<string, unknown>>({
  item,
  availableTags = [],
  onSaved,
  onSaveError,
  render,
  ...props
}: KeepTagEditorProps<TMeta>) {
  const view = useKeepTagEditor<TMeta>({ item, onSaved, onSaveError });
  const { isSaving, tags } = view.state;
  const body = render ? (
    render(view.state)
  ) : (
    <>
      <label>
        {view.labels.tags}
        <input
          data-keep-action="edit-tags"
          value={view.input}
          list={availableTags.length > 0 ? `keep-tags-${item.id}` : undefined}
          onChange={(event) => view.setInput(event.currentTarget.value)}
          onKeyDown={view.handleInputKeyDown}
        />
      </label>
      {availableTags.length > 0 ? (
        <datalist id={`keep-tags-${item.id}`}>
          {availableTags.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
      ) : null}
      <ul aria-label={view.labels.tags}>
        {tags.map((tag) => (
          <li key={tag}>
            {tag}
            <button type="button" data-keep-action="remove-tag" onClick={() => view.removeTag(tag)}>
              {view.labels.remove}
            </button>
          </li>
        ))}
      </ul>
      <button type="submit" data-keep-action="apply-tags" disabled={isSaving} aria-busy={isSaving}>
        {view.labels.apply}
      </button>
    </>
  );
  return (
    <form
      {...props}
      onSubmit={view.submit}
      aria-busy={isSaving || props["aria-busy"]}
      data-keepkit="tag-editor"
      data-state={view.error ? "error" : isSaving ? "saving" : "idle"}
      data-loading={isSaving ? "true" : undefined}
      data-disabled={isSaving ? "true" : undefined}
    >
      {body}
      {view.error ? <p role="alert">{getErrorMessage(view.error, view.labels.error)}</p> : null}
    </form>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
