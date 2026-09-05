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

  return (
    <section {...props} className={className} data-keepkit="workspace" data-preset={preset}>
      {resolveOptionalSlot(slots?.before, state)}
      {view.modules.syncStatus
        ? resolveSlot(
            slots?.syncStatus,
            <KeepSyncStatusBanner {...syncStatusProps} onResolveConflicts={view.openRecovery} />,
            state,
          )
        : null}
      {resolveSlot(slots?.collection, <KeepCollection<TMeta> {...resolvedCollectionProps} />, state)}
      {view.modules.backup || view.modules.stalePrune
        ? resolveSlot(
            slots?.actions,
            <div data-keepkit="workspace-actions">
              {view.modules.stalePrune ? <KeepPruneStaleButton {...stalePruneProps} /> : null}
              {view.modules.backup ? <KeepBackup<TMeta> {...backupProps} /> : null}
            </div>,
            state,
          )
        : null}
      {view.modules.undo ? resolveSlot(slots?.undo, <KeepUndo {...undoProps} />, state) : null}
      {view.modules.recovery
        ? resolveSlot(
            slots?.recovery,
            <KeepSyncRecoveryDialog<TMeta>
              {...recoveryProps}
              open={view.recoveryOpen}
              onOpenChange={view.setRecoveryOpen}
            />,
            state,
          )
        : null}
      {resolveOptionalSlot(children, state)}
      {resolveOptionalSlot(slots?.after, state)}
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
