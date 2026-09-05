import type { KeepItem } from "@keepkit/core/core";
import { useKeepContext, useKeepList, useKeepShortcut } from "@keepkit/ui";
import { useEffect, useState } from "react";
import type { DemoMeta } from "./main";

export interface AppViewState {
  isOnline: boolean;
  savedItemCount: number;
  syncLabel: string;
  shortcutLabel: string;
  showArchived: boolean;
  setShowArchived: (show: boolean) => void;
  isManaging: boolean;
  setIsManaging: (managing: boolean) => void;
  areFiltersOpen: boolean;
  setAreFiltersOpen: (open: boolean) => void;
  openNoteId: string | null;
  setOpenNoteId: (id: string | null) => void;
}

export function useAppView(shortcutItem: KeepItem<DemoMeta>): AppViewState {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [showArchived, setShowArchived] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const [areFiltersOpen, setAreFiltersOpen] = useState(false);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const { items } = useKeepList<DemoMeta>();
  const { syncState } = useKeepContext<DemoMeta>();
  const isApplePlatform =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

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
    modifier: isApplePlatform ? "meta" : "ctrl",
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
    shortcutLabel: isApplePlatform ? "⌘K" : "Ctrl+K",
    showArchived,
    setShowArchived,
    isManaging,
    setIsManaging,
    areFiltersOpen,
    setAreFiltersOpen,
    openNoteId,
    setOpenNoteId,
  };
}
