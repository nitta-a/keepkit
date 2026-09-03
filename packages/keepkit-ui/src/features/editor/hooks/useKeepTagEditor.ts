import type { KeepItem } from "@keepkit/core/core";
import { useKeepItem } from "@keepkit/core/react";
import type { FormEvent, KeyboardEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { normalizeUiTags } from "../../../foundation/shared";
import { useUiLabel } from "../../../foundation/ui-context";
import type { KeepTagEditorState } from "../KeepTagEditor";

type KeepTagEditorOptions<TMeta> = {
  item: KeepItem<TMeta>;
  onSaved: ((tags?: string[]) => void) | undefined;
  onSaveError: ((error: unknown) => void) | undefined;
};

export function useKeepTagEditor<TMeta>({ item, onSaved, onSaveError }: KeepTagEditorOptions<TMeta>) {
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
    } catch (cause) {
      onSaveError?.(cause);
      throw cause;
    }
  }, [itemState, onSaveError, onSaved, tags]);
  const addTag = (tag: string) => {
    setTags(normalizeUiTags([...tags, tag]));
    setInput("");
  };
  const state: KeepTagEditorState = { tags, setTags, save, isSaving: itemState.isMutating };

  return {
    state,
    input,
    setInput,
    error: itemState.error,
    handleInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        if (event.nativeEvent.isComposing) return;
        event.preventDefault();
        if (input.trim()) addTag(input);
      } else if (event.key === "Backspace" && input.length === 0 && tags.length > 0) {
        event.preventDefault();
        setTags(tags.slice(0, -1));
      }
    },
    removeTag: (tag: string) => setTags(tags.filter((current) => current !== tag)),
    submit: (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void save().catch(() => undefined);
    },
    labels: {
      tags: useUiLabel("tagsToApply"),
      remove: useUiLabel("remove"),
      apply: useUiLabel("applyTags"),
      error: useUiLabel("error"),
    },
  };
}
