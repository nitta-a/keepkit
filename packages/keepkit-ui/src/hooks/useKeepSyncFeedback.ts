import type { KeepSyncStatus } from "@keepkit/core/core";
import { useKeepContext } from "@keepkit/core/react";
import { useEffect, useRef } from "react";
import { useKeepUiFeedback, useUiLabel } from "../ui-context";

/** Observes provider-level synchronization transitions for the feedback event bus. */
export function useKeepSyncFeedback() {
  const { syncState } = useKeepContext();
  const emitFeedback = useKeepUiFeedback();
  const completedMessage = useUiLabel("syncSynced");
  const failedMessage = useUiLabel("syncFailedMessage");
  const previousStatus = useRef<KeepSyncStatus>("idle");

  useEffect(() => {
    const previous = previousStatus.current;
    previousStatus.current = syncState.status;
    if (syncState.status === "error" && previous !== "error") {
      emitFeedback({ type: "sync-failed", error: syncState.error, message: failedMessage });
      return;
    }
    if (
      syncState.status === "synced" &&
      (previous === "pending" || previous === "syncing" || previous === "conflict" || previous === "error")
    ) {
      emitFeedback({ type: "sync-completed", message: completedMessage });
    }
  }, [completedMessage, emitFeedback, failedMessage, syncState.error, syncState.status]);
}
