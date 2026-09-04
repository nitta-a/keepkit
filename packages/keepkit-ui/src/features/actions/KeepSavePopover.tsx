"use client";

import type { KeepItem, KeepItemInput } from "@keepkit/core/core";
import { useKeepItem } from "@keepkit/core/react";
import {
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useUiLabel } from "../../foundation/ui-context";
import { type KeepQuickEditorProps, KeepQuickEditorView, useKeepQuickEditor } from "../editor/KeepQuickEditor";
import { KeepButton, type KeepButtonProps } from "./KeepButton";

export type KeepSavePopoverProps<TMeta = Record<string, unknown>> = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  item: KeepItemInput<TMeta>;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  dialogLabel?: string;
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
  dialogLabel,
  buttonProps,
  editorProps,
  children,
  ...props
}: KeepSavePopoverProps<TMeta>) {
  const state = useKeepItem(item);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledOpen ?? internalOpen;
  const triggerRef = useRef<HTMLElement>(null);
  const wasOpenRef = useRef(isOpen);
  const previousSaved = useRef(state.isSaved);
  const observedHydration = useRef(!state.isLoading);
  const panelId = useId();
  const titleId = `${panelId}-title`;
  const editSavedItemLabel = useUiLabel("editSavedItem");
  const { ref: _buttonRef, ...resolvedButtonProps } = buttonProps ?? {};
  const setOpen = useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [controlledOpen, onOpenChange],
  );

  useEffect(() => {
    if (wasOpenRef.current && !isOpen) window.setTimeout(() => triggerRef.current?.focus(), 0);
    wasOpenRef.current = isOpen;
  }, [isOpen]);

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

  useEffect(() => {
    if (isOpen && observedHydration.current && !state.isSaved) setOpen(false);
  }, [isOpen, setOpen, state.isSaved]);

  const currentItem = state.item as KeepItem<TMeta> | undefined;
  return (
    <div {...props} data-keepkit="save-popover" data-open={isOpen ? "true" : "false"}>
      <KeepButton
        {...resolvedButtonProps}
        item={item}
        asChild={false}
        ref={triggerRef}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={panelId}
      />
      {isOpen && currentItem ? (
        <KeepSavePopoverPanel
          id={panelId}
          titleId={titleId}
          dialogLabel={dialogLabel ?? editSavedItemLabel}
          item={currentItem}
          editorProps={editorProps}
          triggerRef={triggerRef}
          onClose={() => setOpen(false)}
        >
          {children}
        </KeepSavePopoverPanel>
      ) : null}
    </div>
  );
}

type KeepSavePopoverPanelProps<TMeta> = {
  id: string;
  titleId: string;
  dialogLabel: string;
  item: KeepItem<TMeta>;
  editorProps?: KeepSavePopoverProps<TMeta>["editorProps"];
  triggerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  children?: ReactNode;
};

function KeepSavePopoverPanel<TMeta>({
  id,
  titleId,
  dialogLabel,
  item,
  editorProps,
  triggerRef,
  onClose,
  children,
}: KeepSavePopoverPanelProps<TMeta>) {
  const { debounceMs, onSaved, onSaveError, ...editorViewProps } = editorProps ?? {};
  const { state } = useKeepQuickEditor(item, { debounceMs, onSaved, onSaveError });
  const panelRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef<Promise<void> | null>(null);
  const closeLabel = useUiLabel("close");
  const requestClose = useCallback(() => {
    if (closingRef.current) return closingRef.current;
    const promise = state
      .flush()
      .then(onClose)
      .catch(() => {
        window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>('[role="alert"]')?.focus(), 0);
      })
      .finally(() => {
        closingRef.current = null;
      });
    closingRef.current = promise;
    return promise;
  }, [onClose, state]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLElement>('[data-keepkit="quick-editor"] :is(textarea, input, select, button)')
        ?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const closeFromOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || panelRef.current?.contains(target) || triggerRef.current?.contains(target))
        return;
      void requestClose();
    };
    document.addEventListener("pointerdown", closeFromOutside);
    return () => document.removeEventListener("pointerdown", closeFromOutside);
  }, [requestClose, triggerRef]);

  return (
    <div
      ref={panelRef}
      id={id}
      role="dialog"
      aria-labelledby={titleId}
      data-keep-popover-panel="true"
      data-save-status={state.saveStatus}
      onKeyDownCapture={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        void requestClose();
      }}
    >
      <h2 id={titleId} data-keep-popover-title="true">
        {dialogLabel}
      </h2>
      {children}
      <KeepQuickEditorView {...editorViewProps} state={state} focusScopeRef={panelRef} />
      <button
        type="button"
        onClick={() => void requestClose()}
        disabled={state.isSaving}
        data-keep-action="close-save-popover"
      >
        {closeLabel}
      </button>
    </div>
  );
}
