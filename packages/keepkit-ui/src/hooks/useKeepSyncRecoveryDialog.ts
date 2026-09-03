import type { KeepItem, KeepSyncConflict } from "@keepkit/core/core";
import { useKeepContext } from "@keepkit/core/react";
import { useEffect, useState } from "react";
import { useUiLabel } from "../ui-context";

type KeepSyncRecoveryDialogOptions<TMeta> = {
  open: boolean | undefined;
  onOpenChange: ((open: boolean) => void) | undefined;
  conflicts: KeepSyncConflict<TMeta>[] | undefined;
  onManualMerge: ((conflict: KeepSyncConflict<TMeta>) => KeepItem<TMeta> | Promise<KeepItem<TMeta>>) | undefined;
};

export function useKeepSyncRecoveryDialog<TMeta>(options: KeepSyncRecoveryDialogOptions<TMeta>) {
  const { open, onOpenChange, conflicts, onManualMerge } = options;
  const context = useKeepContext<TMeta>();
  const conflictList = conflicts ?? context.syncState.conflicts ?? [];
  const hasRecovery = conflictList.length > 0 || context.syncState.status === "error" || Boolean(context.error);
  const [dismissed, setDismissed] = useState(false);
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<unknown>();
  useEffect(() => {
    if (hasRecovery) setDismissed(false);
  }, [hasRecovery]);

  return {
    conflictList,
    isOpen: open ?? (hasRecovery && !dismissed),
    busyId,
    error,
    showBackupRecovery: context.syncState.status === "error" || Boolean(context.error),
    close: () => {
      setDismissed(true);
      onOpenChange?.(false);
    },
    resolve: async (conflict: KeepSyncConflict<TMeta>, resolution: "local" | "remote" | "manual") => {
      setError(undefined);
      setBusyId(conflict.id);
      try {
        const merged = resolution === "manual" ? await onManualMerge?.(conflict) : undefined;
        if (resolution === "manual" && !merged) throw new Error("A manual merge result is required.");
        await context.resolveSyncConflict(conflict.id, resolution, merged);
      } catch (cause) {
        setError(cause);
      } finally {
        setBusyId(undefined);
      }
    },
    labels: {
      close: useUiLabel("close"),
      title: useUiLabel("resolveSync"),
      conflict: useUiLabel("syncConflict"),
      keepLocal: useUiLabel("keepLocal"),
      useServer: useUiLabel("useServer"),
      manualMerge: useUiLabel("manualMerge"),
      localVersion: useUiLabel("localVersion"),
      remoteVersion: useUiLabel("remoteVersion"),
      updatedAt: useUiLabel("updatedAt"),
      note: useUiLabel("note"),
      backupRecovery: useUiLabel("backupRecovery"),
      backupRecoveryDescription: useUiLabel("backupRecoveryDescription"),
      error: useUiLabel("error"),
    },
  };
}
