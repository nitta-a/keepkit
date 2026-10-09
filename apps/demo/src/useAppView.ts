import { useEffect, useState } from "react";

export type LibraryView = "all" | "inbox" | "pinned" | "unread" | "archive" | "collections" | "settings";

export function useAppView() {
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const [view, setView] = useState<LibraryView>("all");
  const [selectedCollection, setSelectedCollection] = useState<string>();
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const [areFiltersOpen, setAreFiltersOpen] = useState(false);
  const isApplePlatform =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    const openCapture = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      setIsCaptureOpen(true);
    };
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    window.addEventListener("keydown", openCapture);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      window.removeEventListener("keydown", openCapture);
    };
  }, []);

  return {
    isOnline,
    shortcutLabel: isApplePlatform ? "⌘K" : "Ctrl+K",
    view,
    setView,
    selectedCollection,
    setSelectedCollection,
    isCaptureOpen,
    setIsCaptureOpen,
    isManaging,
    setIsManaging,
    areFiltersOpen,
    setAreFiltersOpen,
  };
}
