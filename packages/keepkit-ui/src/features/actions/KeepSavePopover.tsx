"use client";

import type { KeepItem, KeepItemInput } from "@keepkit/core/core";
import { useKeepItem } from "@keepkit/core/react";
import { type HTMLAttributes, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useUiLabel } from "../../foundation/ui-context";
import { KeepQuickEditor, type KeepQuickEditorProps } from "../editor/KeepQuickEditor";
import { KeepButton, type KeepButtonProps } from "./KeepButton";

export type KeepSavePopoverProps<TMeta = Record<string, unknown>> = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  item: KeepItemInput<TMeta>;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  buttonProps?: Omit<KeepButtonProps<TMeta>, "item" | "asChild"> & { asChild?: false };
  editorProps?: Omit<KeepQuickEditorProps<TMeta>, "item" | "onClose">;
  children?: ReactNode;
};

/** Opens a quick editor only after this trigger changes from unsaved to saved. */
export function KeepSavePopover<TMeta = Record<string, unknown>>({
  item,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  buttonProps,
  editorProps,
  children,
  ...props
}: KeepSavePopoverProps<TMeta>) {
  const state = useKeepItem(item);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledOpen ?? internalOpen;
  const triggerRef = useRef<HTMLElement>(null);
  const previousSaved = useRef(state.isSaved);
  const observedHydration = useRef(!state.isLoading);
  const closeLabel = useUiLabel("close");
  const { ref: _buttonRef, ...resolvedButtonProps } = buttonProps ?? {};
  const setOpen = useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) setInternalOpen(next);
      onOpenChange?.(next);
      if (!next) window.setTimeout(() => triggerRef.current?.focus(), 0);
    },
    [controlledOpen, onOpenChange],
  );

  useEffect(() => {
    if (!observedHydration.current) {
      if (state.isLoading) return;
      observedHydration.current = true;
      previousSaved.current = state.isSaved;
      return;
    }
    if (!previousSaved.current && state.isSaved) setOpen(true);
    previousSaved.current = state.isSaved;
  }, [setOpen, state.isLoading, state.isSaved]);

  const currentItem = state.item as KeepItem<TMeta> | undefined;
  return (
    <div {...props} data-keepkit="save-popover" data-open={isOpen ? "true" : "false"}>
      <KeepButton {...resolvedButtonProps} item={item} asChild={false} ref={triggerRef} />
      {isOpen && currentItem ? (
        <div role="dialog" aria-label={children ? undefined : closeLabel} data-keep-popover-panel="true">
          {children}
          <KeepQuickEditor {...editorProps} item={currentItem} onClose={() => setOpen(false)} />
          <button type="button" onClick={() => setOpen(false)} data-keep-action="close-save-popover">
            {closeLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
