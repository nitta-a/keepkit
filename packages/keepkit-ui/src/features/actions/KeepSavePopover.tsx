"use client";

import type { KeepItem, KeepItemInput } from "@keepkit/core/core";
import { type KeepCollectionSummary, useKeepCollections, useKeepItem } from "@keepkit/core/react";
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
import { KeepPortalTheme } from "../../foundation/theme";
import { useUiLabel } from "../../foundation/ui-context";
import { useKeepCollectionCreate } from "../collection/hooks/useKeepCollectionCreate";
import { KeepCollectionCreateForm } from "../collection/KeepCollectionCreate";
import {
  type KeepQuickEditorProps,
  type KeepQuickEditorState,
  KeepQuickEditorView,
  useKeepQuickEditor,
} from "../editor/KeepQuickEditor";
import { KeepButton, type KeepButtonProps } from "./KeepButton";

export type KeepSavePopoverPanelContext<TMeta = Record<string, unknown>> = {
  panelId: string;
  dialogLabel: string;
  triggerRef: RefObject<HTMLElement | null>;
  state: KeepQuickEditorState<TMeta>;
  /** Render once inside the host shell. Includes children, the editor, and optional collection creation. */
  content: ReactNode;
  /** Flushes pending edits; resolves false and leaves the panel open on failure. */
  requestClose: () => Promise<boolean>;
};

export type KeepSavePopoverEditorContext<TMeta = Record<string, unknown>> = {
  state: KeepQuickEditorState<TMeta>;
  collections: KeepCollectionSummary[];
  canCreateCollection: boolean;
  createCollection: (name: string) => Promise<boolean>;
  collectionError: string | null;
  isCreatingCollection: boolean;
  clearCollectionError: () => void;
};

export type KeepSavePopoverProps<TMeta = Record<string, unknown>> = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  item: KeepItemInput<TMeta>;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  dialogLabel?: string;
  portalContainer?: HTMLElement | null;
  buttonProps?: Omit<KeepButtonProps<TMeta>, "item" | "asChild"> & { asChild?: false };
  editorProps?: Omit<KeepQuickEditorProps<TMeta>, "item" | "onClose">;
  /** Show a sibling form for creating and selecting a new collection. */
  allowCreateCollection?: boolean;
  /** Replace the open panel shell. The host owns its portal, focus, and dismissal events. */
  renderPanel?: (context: KeepSavePopoverPanelContext<TMeta>) => ReactNode;
  /** Replace the editor and collection creation controls while KeepKit retains their state. */
  renderEditor?: (context: KeepSavePopoverEditorContext<TMeta>) => ReactNode;
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
  allowCreateCollection,
  renderPanel,
  renderEditor,
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
    const restore = wasOpenRef.current && !isOpen && !renderPanel;
    wasOpenRef.current = isOpen;
    if (!restore) return;
    const timer = window.setTimeout(() => triggerRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [isOpen, renderPanel]);

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

  const currentItem = state.item;
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
          key={currentItem.id}
          panelId={panelId}
          dialogLabel={dialogLabel ?? editSavedItemLabel}
          item={currentItem}
          editorProps={editorProps}
          allowCreateCollection={allowCreateCollection}
          renderPanel={renderPanel}
          renderEditor={renderEditor}
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
  panelId: string;
  dialogLabel: string;
  item: KeepItem<TMeta>;
  editorProps?: KeepSavePopoverProps<TMeta>["editorProps"];
  allowCreateCollection?: boolean;
  renderPanel?: KeepSavePopoverProps<TMeta>["renderPanel"];
  renderEditor?: KeepSavePopoverProps<TMeta>["renderEditor"];
  triggerRef: RefObject<HTMLElement | null>;
  portalContainer?: HTMLElement | null;
  onClose: () => void;
  children?: ReactNode;
};

function KeepSavePopoverPanel<TMeta>({
  panelId,
  dialogLabel,
  item,
  editorProps,
  allowCreateCollection,
  renderPanel,
  renderEditor,
  triggerRef,
  portalContainer,
  onClose,
  children,
}: KeepSavePopoverPanelProps<TMeta>) {
  const { debounceMs, onSaved, onSaveError, collectionIds, ...editorViewProps } = editorProps ?? {};
  const { state } = useKeepQuickEditor(item, { debounceMs, onSaved, onSaveError });
  const panelRef = useRef<HTMLDivElement>(null);
  const [createdIds, setCreatedIds] = useState<string[]>([]);
  const pendingCreate = useRef<Promise<boolean> | null>(null);
  const closingRef = useRef<Promise<boolean> | null>(null);
  const activeRef = useRef(true);
  const creationFailed = useRef(false);
  const collections = useKeepCollections({ targetType: item.targetType });
  const creation = useKeepCollectionCreate({
    onCreated: (id) => {
      setCreatedIds((ids) => [...ids, id]);
      state.setCollectionId(id);
    },
  });
  useLayoutEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);
  const { flush } = state;
  const flushDraft = useCallback(async () => {
    try {
      await flush();
      return true;
    } catch {
      return false;
    }
  }, [flush]);
  const trackCreation = (creation: Promise<boolean>) => {
    const commit = creation.then((created) => created && flushDraft());
    pendingCreate.current = commit;
    void commit.finally(() => {
      if (pendingCreate.current === commit) pendingCreate.current = null;
    });
  };
  const createCollection = (name: string): Promise<boolean> => {
    if (pendingCreate.current) return Promise.resolve(false);
    if (!allowCreateCollection || editorViewProps.features?.collection === false) return Promise.resolve(false);
    creationFailed.current = false;
    const task = creation.create(name).then((created) => {
      creationFailed.current = !created;
      return created;
    });
    const commit = task.then((created) => created && flushDraft());
    pendingCreate.current = commit;
    void commit.finally(() => {
      if (pendingCreate.current === commit) pendingCreate.current = null;
    });
    return task;
  };
  const requestClose = useCallback(() => {
    if (closingRef.current) return closingRef.current;
    const close = async () => {
      do {
        if (pendingCreate.current && !(await pendingCreate.current)) return false;
        if (creationFailed.current) return false;
        if (!(await flushDraft())) return false;
      } while (pendingCreate.current);
      if (!activeRef.current) return false;
      onClose();
      return true;
    };
    const promise = close().finally(() => {
      closingRef.current = null;
    });
    closingRef.current = promise;
    return promise;
  }, [flushDraft, onClose]);

  const content = (
    <>
      {children}
      {renderEditor ? (
        <div data-keepkit="custom-save-editor">
          {renderEditor({
            state,
            collections: collectionIds
              ? [...new Set([...collectionIds, ...createdIds])].map((id) => {
                  const collection = collections.find((entry) => entry.id === id);
                  return {
                    id,
                    name: editorViewProps.collectionLabels?.[id] ?? collection?.name ?? id,
                    count: collection?.count ?? 0,
                  };
                })
              : collections.map((entry) => ({
                  ...entry,
                  name: editorViewProps.collectionLabels?.[entry.id] ?? entry.name,
                })),
            canCreateCollection: !!allowCreateCollection && editorViewProps.features?.collection !== false,
            createCollection,
            collectionError: creation.error,
            isCreatingCollection: creation.isSubmitting,
            clearCollectionError: () => {
              creationFailed.current = false;
              creation.clearError();
            },
          })}
        </div>
      ) : (
        <KeepQuickEditorView
          {...editorViewProps}
          collectionIds={collectionIds && [...new Set([...collectionIds, ...createdIds])]}
          state={state}
          focusScopeRef={renderPanel ? undefined : panelRef}
          hostHandlesEscape={!!renderPanel}
        />
      )}
      {!renderEditor && allowCreateCollection && editorViewProps.features?.collection !== false ? (
        <KeepCollectionCreateForm
          onCreated={(id) => {
            setCreatedIds((ids) => [...ids, id]);
            state.setCollectionId(id);
          }}
          onSubmitTask={trackCreation}
        />
      ) : null}
    </>
  );
  const context = { panelId, dialogLabel, triggerRef, state, content, requestClose };
  if (renderPanel) {
    return renderPanel({ ...context, content: <KeepPortalTheme sourceRef={triggerRef}>{content}</KeepPortalTheme> });
  }
  return <DefaultSavePanel {...context} panelRef={panelRef} portalContainer={portalContainer} />;
}

function DefaultSavePanel<TMeta>({
  panelId,
  dialogLabel,
  panelRef,
  triggerRef,
  portalContainer,
  requestClose,
  state: { saveStatus, isSaving },
  content,
}: KeepSavePopoverPanelContext<TMeta> & {
  panelRef: RefObject<HTMLDivElement | null>;
  portalContainer?: HTMLElement | null;
}) {
  const titleId = `${panelId}-title`;
  const closeLabel = useUiLabel("close");
  const [position, setPosition] = useState({ left: 8, top: 8, width: 320 });
  const [isMobile, setIsMobile] = useState(false);
  useLayoutEffect(() => {
    const place = () => {
      const mobile = window.matchMedia?.("(max-width: 32rem)").matches ?? window.innerWidth <= 512;
      setIsMobile(mobile);
      const trigger = triggerRef.current?.getBoundingClientRect();
      const panel = panelRef.current;
      if (!trigger || !panel) return;
      const width = Math.min(Math.max(trigger.width, 320), window.innerWidth - 16);
      const left = Math.max(8, Math.min(trigger.left, window.innerWidth - width - 8));
      panel.style.width = mobile ? "100%" : `${width}px`;
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
  }, [triggerRef, panelRef]);
  const dismiss = useCallback(() => {
    void requestClose().then((closed) => {
      if (!closed) {
        window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>('[role="alert"]')?.focus(), 0);
      }
    });
  }, [panelRef, requestClose]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLElement>(
          '[data-keepkit="quick-editor"] :is(textarea, input, select, button), [data-keepkit="custom-save-editor"] :is(textarea, input, select, button)',
        )
        ?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [panelRef]);

  useEffect(() => {
    const closeFromOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || panelRef.current?.contains(target) || triggerRef.current?.contains(target))
        return;
      dismiss();
    };
    document.addEventListener("pointerdown", closeFromOutside);
    return () => document.removeEventListener("pointerdown", closeFromOutside);
  }, [dismiss, panelRef, triggerRef]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <KeepPortalTheme sourceRef={triggerRef}>
      <div
        ref={panelRef}
        style={{
          position: "fixed",
          boxSizing: "border-box",
          left: isMobile ? 0 : position.left,
          top: isMobile ? "auto" : position.top,
          width: isMobile ? "100%" : position.width,
          right: isMobile ? 0 : "auto",
          bottom: isMobile ? 0 : "auto",
          maxHeight: isMobile ? "min(85dvh, 40rem)" : "calc(100dvh - 16px)",
          overflowY: "auto",
        }}
        id={panelId}
        role="dialog"
        aria-labelledby={titleId}
        data-keep-popover-panel="true"
        data-save-status={saveStatus}
        onKeyDownCapture={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          dismiss();
        }}
      >
        <h2 id={titleId} data-keep-popover-title="true">
          {dialogLabel}
        </h2>
        {content}
        <button type="button" onClick={dismiss} disabled={isSaving} data-keep-action="close-save-popover">
          {closeLabel}
        </button>
      </div>
    </KeepPortalTheme>,
    portalContainer ?? triggerRef.current?.closest("dialog[open]") ?? document.body,
  );
}
