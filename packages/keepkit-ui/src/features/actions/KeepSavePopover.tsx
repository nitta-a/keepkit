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
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { KeepThemeProvider, useKeepTheme } from "../../foundation/theme";
import { useUiLabel } from "../../foundation/ui-context";
import { type KeepQuickEditorProps, KeepQuickEditorView, useKeepQuickEditor } from "../editor/KeepQuickEditor";
import { KeepButton, type KeepButtonProps } from "./KeepButton";

export type KeepSavePopoverProps<TMeta = Record<string, unknown>> = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  item: KeepItemInput<TMeta>;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  dialogLabel?: string;
  portalContainer?: HTMLElement | null;
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
  portalContainer,
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
  const initiatedSave = useRef(false);
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
    if (!previousSaved.current && state.isSaved && initiatedSave.current) {
      initiatedSave.current = false;
      setOpen(true);
    }
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
        onClick={(event) => {
          resolvedButtonProps.onClick?.(event);
          if (!event.defaultPrevented && !state.isSaved) initiatedSave.current = true;
        }}
        onToggleError={(error) => {
          initiatedSave.current = false;
          resolvedButtonProps.onToggleError?.(error);
        }}
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
          portalContainer={portalContainer}
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
  portalContainer?: HTMLElement | null;
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
  portalContainer,
  onClose,
  children,
}: KeepSavePopoverPanelProps<TMeta>) {
  const { debounceMs, onSaved, onSaveError, ...editorViewProps } = editorProps ?? {};
  const { state } = useKeepQuickEditor(item, { debounceMs, onSaved, onSaveError });
  const panelRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef<Promise<void> | null>(null);
  const closeLabel = useUiLabel("close");
  const theme = useKeepTheme();
  const [position, setPosition] = useState({ left: 8, top: 8, width: 320 });
  useLayoutEffect(() => {
    const place = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const panel = panelRef.current;
      if (!trigger || !panel) return;
      const width = Math.min(Math.max(trigger.width, 320), window.innerWidth - 16);
      const left = Math.max(8, Math.min(trigger.left, window.innerWidth - width - 8));
      panel.style.width = `${width}px`;
      const height = panel.getBoundingClientRect().height;
      const below = trigger.bottom + 8;
      const top = Math.max(
        8,
        Math.min(
          below + height <= window.innerHeight - 8 ? below : trigger.top - height - 8,
          window.innerHeight - height - 8,
        ),
      );
      setPosition({ left, top, width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [triggerRef]);
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

  if (typeof document === "undefined") return null;
  return createPortal(
    <KeepThemeProvider {...theme}>
      <div
        ref={panelRef}
        style={{
          position: "fixed",
          boxSizing: "border-box",
          left: position.left,
          top: position.top,
          width: position.width,
          right: "auto",
          bottom: "auto",
          maxHeight: "calc(100dvh - 16px)",
          overflowY: "auto",
        }}
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
    </KeepThemeProvider>,
    portalContainer ?? triggerRef.current?.closest("dialog[open]") ?? document.body,
  );
}
