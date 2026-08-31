"use client";

import type { KeepItem } from "@keepkit/core/core";
import { useKeepItem } from "@keepkit/core/react";
import { type FormHTMLAttributes, useCallback, useEffect, useState } from "react";
import { normalizeUiTags, type RenderProp } from "./shared";
import { useUiLabel } from "./ui-context";

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
  const tagsLabel = useUiLabel("tagsToApply");
  const removeLabel = useUiLabel("remove");
  const applyTagsLabel = useUiLabel("applyTags");
  const itemState = useKeepItem<TMeta>(item);
  const [tags, setTags] = useState(item.tags ?? []);
  const [input, setInput] = useState("");
  useEffect(() => setTags(itemState.item?.tags ?? item.tags ?? []), [item.tags, itemState.item?.tags]);
  const save = useCallback(async () => {
    const nextTags = normalizeUiTags(tags);
    try {
      await itemState.updateTags(nextTags);
      setTags(nextTags);
      onSaved?.(nextTags);
    } catch (error) {
      onSaveError?.(error);
      throw error;
    }
  }, [itemState, onSaveError, onSaved, tags]);
  const addTag = (tag: string) => {
    setTags(normalizeUiTags([...tags, tag]));
    setInput("");
  };
  const body = render ? (
    render({ tags, setTags, save, isSaving: itemState.isMutating })
  ) : (
    <>
      <label>
        {tagsLabel}
        <input
          value={input}
          list={availableTags.length > 0 ? `keep-tags-${item.id}` : undefined}
          onChange={(event) => setInput(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              if (event.nativeEvent.isComposing) return;
              event.preventDefault();
              if (input.trim()) addTag(input);
            } else if (event.key === "Backspace" && input.length === 0 && tags.length > 0) {
              event.preventDefault();
              setTags(tags.slice(0, -1));
            }
          }}
        />
      </label>
      {availableTags.length > 0 ? (
        <datalist id={`keep-tags-${item.id}`}>
          {availableTags.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
      ) : null}
      <ul aria-label={tagsLabel}>
        {tags.map((tag) => (
          <li key={tag}>
            {tag}
            <button type="button" onClick={() => setTags(tags.filter((current) => current !== tag))}>
              {removeLabel}
            </button>
          </li>
        ))}
      </ul>
      <button type="submit" disabled={itemState.isMutating} aria-busy={itemState.isMutating}>
        {applyTagsLabel}
      </button>
    </>
  );
  return (
    <form
      {...props}
      onSubmit={(event) => {
        event.preventDefault();
        void save().catch(() => undefined);
      }}
      aria-busy={itemState.isMutating || props["aria-busy"]}
    >
      {body}
    </form>
  );
}
