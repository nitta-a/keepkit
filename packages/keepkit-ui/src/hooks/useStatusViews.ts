import type { KeepChangeContext } from "@keepkit/core/core";
import { useKeepContext } from "@keepkit/core/react";
import { useEffect, useRef, useState } from "react";
import type { KeepAnnouncementsProps, KeepStatusState, KeepStatusValue } from "../status";
import { type KeepUiLabelKey, useUiLabel } from "../ui-context";

export function useKeepEmptyState() {
  return useUiLabel("noItems").replace(/\.$/, "");
}

export function useKeepStatus<TMeta>(status: KeepStatusValue | undefined) {
  const context = useKeepContext<TMeta>();
  const resolvedStatus = status ?? getDerivedStatus(context);
  const state: KeepStatusState<TMeta> = {
    status: resolvedStatus,
    error: context.error,
    pendingCount: context.syncState.pendingCount,
    items: context.items,
  };
  return { state, defaultLabel: useUiLabel(getStatusLabelKey(resolvedStatus)) };
}

export function useKeepAnnouncements<TMeta>(messages: KeepAnnouncementsProps["messages"]) {
  const context = useKeepContext<TMeta>();
  const savedMessage = useUiLabel("savedMessage", messages?.save);
  const removedMessage = useUiLabel("removedMessage", messages?.remove);
  const noteSavedMessage = useUiLabel("noteSavedMessage", messages?.note);
  const [message, setMessage] = useState("");
  const lastChangeRef = useRef<KeepChangeContext<TMeta> | undefined>(undefined);
  useEffect(() => {
    const change = context.lastChange;
    if (!change || change === lastChangeRef.current) return;
    lastChangeRef.current = change;
    if (change.action === "save") setMessage(savedMessage);
    else if (change.action === "remove" || change.action === "removeBatch") setMessage(removedMessage);
    else if (change.action === "updateNote") setMessage(noteSavedMessage);
  }, [context.lastChange, noteSavedMessage, removedMessage, savedMessage]);
  return message;
}

function getDerivedStatus<TMeta>(context: ReturnType<typeof useKeepContext<TMeta>>): KeepStatusValue {
  if (context.error) return "error";
  if (context.syncState.status === "pending" || context.syncState.status === "syncing") return "syncing";
  if (context.isMutating) return "saving";
  if (context.isLoading && !context.isHydrated) return "loading";
  if (context.isHydrated && context.items.length === 0) return "empty";
  return "idle";
}

function getStatusLabelKey(status: KeepStatusValue): KeepUiLabelKey {
  if (status === "empty") return "noItems";
  if (status === "loading") return "loadingItems";
  if (status === "error") return "error";
  if (status === "saving") return "saving";
  if (status === "syncing") return "syncing";
  return "saved";
}
