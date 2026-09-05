"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { type RenderProp, resolveContent } from "../../foundation/shared";
import { KeepBackup, type KeepBackupProps } from "../actions/KeepBackup";
import { KeepUndo, type KeepUndoProps } from "../actions/KeepUndo";
import { KeepCollection, type KeepCollectionProps } from "../collection/KeepCollection";
import { KeepPruneStaleButton, type KeepPruneStaleButtonProps } from "../status/KeepStaleNotice";
import { KeepSyncRecoveryDialog, type KeepSyncRecoveryDialogProps } from "../sync/KeepSyncRecoveryDialog";
import { KeepSyncStatusBanner, type KeepSyncStatusBannerProps } from "../sync/KeepSyncStatusBanner";
import { useKeepWorkspace } from "./hooks/useKeepWorkspace";

export type KeepWorkspacePreset = "basic" | "standard" | "management" | "sync";
export type KeepWorkspaceModule = "syncStatus" | "undo" | "recovery" | "backup" | "stalePrune";
export type KeepWorkspaceRegion =
  | "before"
  | "syncStatus"
  | "collection"
  | "actions"
  | "undo"
  | "recovery"
  | "children"
  | "after";
export type KeepWorkspaceSurface = "plain" | "compact" | "panel";
export type KeepWorkspaceSectionGap = "none" | "compact" | "comfortable";

export type KeepWorkspaceState = {
  preset: KeepWorkspacePreset;
  modules: Readonly<Record<KeepWorkspaceModule, boolean>>;
  recoveryOpen: boolean;
  setRecoveryOpen: (open: boolean) => void;
};

type KeepWorkspaceContent = ReactNode | RenderProp<KeepWorkspaceState>;

export type KeepWorkspaceSlots = {
  before?: KeepWorkspaceContent;
  syncStatus?: KeepWorkspaceContent;
  collection?: KeepWorkspaceContent;
  actions?: KeepWorkspaceContent;
  undo?: KeepWorkspaceContent;
  recovery?: KeepWorkspaceContent;
  after?: KeepWorkspaceContent;
};

export type KeepWorkspaceProps<TMeta = Record<string, unknown>> = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  preset?: KeepWorkspacePreset;
  modules?: Partial<Record<KeepWorkspaceModule, boolean>>;
  /** Opts into region wrappers and their theme-backed surface treatment. */
  surface?: KeepWorkspaceSurface | Partial<Record<KeepWorkspaceRegion, KeepWorkspaceSurface>>;
  /** Controls the finite spacing scale between rendered workspace regions. */
  sectionGap?: KeepWorkspaceSectionGap;
  collectionProps?: KeepCollectionProps<TMeta>;
  syncStatusProps?: KeepSyncStatusBannerProps;
  recoveryProps?: KeepSyncRecoveryDialogProps<TMeta>;
  backupProps?: KeepBackupProps<TMeta>;
  undoProps?: KeepUndoProps;
  stalePruneProps?: KeepPruneStaleButtonProps;
  slots?: KeepWorkspaceSlots;
  children?: KeepWorkspaceContent;
};

/** Composes the standard collection, management, and sync primitives into one customizable workspace. */
export function KeepWorkspace<TMeta = Record<string, unknown>>({
  preset = "standard",
  modules,
  surface,
  sectionGap,
  collectionProps,
  syncStatusProps,
  recoveryProps,
  backupProps,
  undoProps,
  stalePruneProps,
  slots,
  children,
  className,
  ...props
}: KeepWorkspaceProps<TMeta>) {
  const view = useKeepWorkspace({
    preset,
    modules,
    recoveryOpen: recoveryProps?.open,
    onRecoveryOpenChange: recoveryProps?.onOpenChange,
    onResolveConflicts: syncStatusProps?.onResolveConflicts,
  });
  const state: KeepWorkspaceState = {
    preset: view.preset,
    modules: view.modules,
    recoveryOpen: view.recoveryOpen,
    setRecoveryOpen: view.setRecoveryOpen,
  };
  const resolvedCollectionProps = {
    ...collectionProps,
    features: { ...view.collectionFeatures, ...collectionProps?.features },
  };
  const structuredRegions = surface !== undefined && surface !== "plain";
  const region = (name: KeepWorkspaceRegion, content: ReactNode): ReactNode => {
    if (!structuredRegions) return content;
    if (content === null || content === undefined || content === false) return null;
    const resolvedSurface = typeof surface === "string" ? surface : (surface[name] ?? "plain");
    return (
      <div data-keepkit="workspace-region" data-region={name} data-surface={resolvedSurface}>
        {content}
      </div>
    );
  };
  const before = resolveOptionalSlot(slots?.before, state);
  const syncStatus = view.modules.syncStatus
    ? resolveSlot(
        slots?.syncStatus,
        <KeepSyncStatusBanner {...syncStatusProps} onResolveConflicts={view.openRecovery} />,
        state,
      )
    : null;
  const collection = resolveSlot(slots?.collection, <KeepCollection<TMeta> {...resolvedCollectionProps} />, state);
  const actions =
    view.modules.backup || view.modules.stalePrune
      ? resolveSlot(
          slots?.actions,
          <div data-keepkit="workspace-actions">
            {view.modules.stalePrune ? <KeepPruneStaleButton {...stalePruneProps} /> : null}
            {view.modules.backup ? <KeepBackup<TMeta> {...backupProps} /> : null}
          </div>,
          state,
        )
      : null;
  const undo = view.modules.undo ? resolveSlot(slots?.undo, <KeepUndo {...undoProps} />, state) : null;
  const recovery = view.modules.recovery
    ? resolveSlot(
        slots?.recovery,
        <KeepSyncRecoveryDialog<TMeta>
          {...recoveryProps}
          open={view.recoveryOpen}
          onOpenChange={view.setRecoveryOpen}
        />,
        state,
      )
    : null;
  const additionalContent = resolveOptionalSlot(children, state);
  const after = resolveOptionalSlot(slots?.after, state);

  return (
    <section
      {...props}
      className={className}
      data-keepkit="workspace"
      data-preset={preset}
      data-surface={surface !== undefined ? (typeof surface === "string" ? surface : "custom") : undefined}
      data-section-gap={sectionGap}
    >
      {region("before", before)}
      {region("syncStatus", syncStatus)}
      {region("collection", collection)}
      {region("actions", actions)}
      {region("undo", undo)}
      {region("recovery", recovery)}
      {region("children", additionalContent)}
      {region("after", after)}
    </section>
  );
}

function resolveSlot(
  slot: KeepWorkspaceContent | undefined,
  fallback: ReactNode,
  state: KeepWorkspaceState,
): ReactNode {
  if (slot === undefined) return fallback;
  return resolveContent(slot, state);
}

function resolveOptionalSlot(slot: KeepWorkspaceContent | undefined, state: KeepWorkspaceState): ReactNode {
  if (slot === undefined) return null;
  return resolveContent(slot, state);
}
