import type { KeepItem } from "@keepkit/core/core";
import { useKeepContext, useKeepList, useKeepShortcut } from "@keepkit/ui";
import { useEffect, useState } from "react";
import type { DemoMeta } from "./main";

export interface AppViewState {
  isOnline: boolean;
  savedItemCount: number;
  syncLabel: string;
  clearAll: () => void;
}

export function useAppView(shortcutItem: KeepItem<DemoMeta>): AppViewState {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const { items, clear } = useKeepList<DemoMeta>();
  const { syncState } = useKeepContext<DemoMeta>();

  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useKeepShortcut({
    key: "k",
    modifier: "meta",
    item: {
      id: shortcutItem.id,
      meta: shortcutItem.meta,
      tags: ["shortcut"],
      ...(shortcutItem.targetType === undefined ? {} : { targetType: shortcutItem.targetType }),
    },
  });

  const syncLabel = !isOnline
    ? "Offline · changes are queued locally"
    : syncState.status === "pending"
      ? `${syncState.pendingCount} change${syncState.pendingCount === 1 ? "" : "s"} waiting to sync`
      : syncState.status === "syncing"
        ? "Syncing changes…"
        : syncState.status === "error"
          ? "Sync paused · will retry when online"
          : "All changes synced";

  return {
    isOnline,
    savedItemCount: items.length,
    syncLabel,
    clearAll: () => void clear(),
  };
}
