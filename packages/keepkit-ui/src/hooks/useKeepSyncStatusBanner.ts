import { useKeepContext } from "@keepkit/core/react";
import type { ReactNode } from "react";
import { useUiLabel } from "../ui-context";

type KeepSyncStatusBannerOptions = {
  onRetry: (() => void | Promise<void>) | undefined;
  children: ReactNode;
};

export function useKeepSyncStatusBanner({ onRetry, children }: KeepSyncStatusBannerOptions) {
  const context = useKeepContext();
  const retryLabel = useUiLabel("retrySync");
  const resolveLabel = useUiLabel("resolveSync");
  const conflictLabel = useUiLabel("syncConflict");
  const pendingLabel = useUiLabel("syncPending");
  const syncedLabel = useUiLabel("syncSynced");
  const status = context.syncState.status;
  const hasConflicts = (context.syncState.conflicts?.length ?? 0) > 0 || context.syncState.conflictIds.length > 0;
  const message =
    children ??
    (status === "error"
      ? getErrorMessage(context.syncState.error)
      : status === "conflict" || hasConflicts
        ? conflictLabel
        : status === "pending" || status === "syncing"
          ? pendingLabel
          : syncedLabel);

  return {
    status,
    hasConflicts,
    message,
    isMutating: context.isMutating,
    role: status === "error" || status === "conflict" || hasConflicts ? "alert" : "status",
    showRetry: status === "error" || status === "pending" || status === "syncing",
    retryLabel,
    resolveLabel,
    retry: async () => {
      if (onRetry) {
        await onRetry();
        return;
      }
      await context.flushSync();
    },
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Sync failed.";
}
