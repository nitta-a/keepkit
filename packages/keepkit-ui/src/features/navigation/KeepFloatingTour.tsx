"use client";

import type { KeepItem } from "@keepkit/core/core";
import type { UseKeepNavigatorResult } from "@keepkit/core/react";
import { useKeepList } from "@keepkit/core/react";
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { KeepThemeProvider, useKeepTheme } from "../../foundation/theme";
import { useKeepUiLabels } from "../../foundation/ui-context";
import { KeepTourBar } from "./KeepTourBar";
import { useKeepTour } from "./tour-context";

export type KeepFloatingTourProps<TMeta = Record<string, unknown>> = {
  currentId?: string;
  getItemHref?: (item: KeepItem<TMeta>) => string;
  getBackHref?: () => string;
  onNavigate?: (direction: "prev" | "next", item: KeepItem<TMeta>) => void;
  onBack?: () => void | Promise<void>;
  position?: "bottom-center" | "bottom-left" | "bottom-right";
  offset?: number | string;
  zIndex?: number;
  className?: string;
  style?: CSSProperties;
  keyboardShortcuts?: boolean;
  showShortcutHint?: boolean;
  children?: ReactNode;
};

/** A fixed, portal-rendered tour bar that does not consume host layout space. */
export function KeepFloatingTour<TMeta = Record<string, unknown>>({
  currentId,
  getItemHref,
  getBackHref,
  onNavigate,
  onBack,
  position = "bottom-center",
  offset = 16,
  zIndex = 1000,
  className,
  style,
  keyboardShortcuts = false,
  showShortcutHint = false,
}: KeepFloatingTourProps<TMeta>) {
  const tour = useKeepTour<TMeta>({ currentId });
  const { items } = useKeepList<TMeta>();
  const theme = useKeepTheme();
  const [mounted, setMounted] = useState(false);
  const { labels } = useKeepUiLabels();
  const collapseLabel = labels.previousPage === "前のページ" ? "折りたたむ" : "Collapse tour";
  const expandLabel = labels.previousPage === "前のページ" ? "展開" : "Expand tour";
  const endLabel = labels.previousPage === "前のページ" ? "終了" : "End tour";
  const expandRef = useRef<HTMLButtonElement>(null);
  const collapseRef = useRef<HTMLButtonElement>(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted || !tour.active) return;
    const button = tour.collapsed ? expandRef.current : collapseRef.current;
    if (button) button.focus();
  }, [mounted, tour.active, tour.collapsed]);
  const activeId = currentId ?? tour.currentId;
  const navigation = useMemo<UseKeepNavigatorResult<TMeta>>(() => {
    const tourItems = tour.itemIds
      .map((id) => items.find((item) => item.id === id))
      .filter((item): item is KeepItem<TMeta> => item !== undefined);
    const currentIndex = activeId ? tourItems.findIndex((item) => item.id === activeId) : -1;
    const currentItem = currentIndex >= 0 ? (tourItems[currentIndex] ?? null) : null;
    return {
      items: tourItems,
      currentIndex,
      currentPosition: currentIndex >= 0 ? currentIndex + 1 : null,
      currentItem,
      hasNext: currentIndex >= 0 && currentIndex < tourItems.length - 1,
      hasPrev: currentIndex > 0,
      nextItem: currentIndex >= 0 ? (tourItems[currentIndex + 1] ?? null) : null,
      prevItem: currentIndex > 0 ? (tourItems[currentIndex - 1] ?? null) : null,
      goToNext: tour.goNext,
      goToPrev: tour.goPrev,
      goToIndex: (index) => {
        const item = tourItems[index];
        if (!item) return null;
        tour.setCurrentId(item.id);
        return item;
      },
      goToItem: (id) => tourItems.find((item) => item.id === id) ?? null,
    };
  }, [activeId, items, tour]);
  if (!mounted || !tour.active || typeof document === "undefined" || !activeId) return null;
  const placementStyle = {
    "--keep-tour-offset": typeof offset === "number" ? `${offset}px` : offset,
    "--keep-tour-z-index": zIndex,
    ...style,
  } as CSSProperties;
  const content = tour.collapsed ? (
    <button
      ref={expandRef}
      type="button"
      className="keep-floating-tour__expand"
      data-keep-action="tour-expand"
      aria-label={`${expandLabel} (${tour.itemIds.indexOf(activeId) + 1} / ${tour.itemIds.length})`}
      onClick={() => tour.expand()}
    >
      {tour.itemIds.indexOf(activeId) + 1} / {tour.itemIds.length}
    </button>
  ) : (
    <>
      <KeepTourBar<TMeta>
        className="keep-floating-tour__bar"
        navigation={navigation}
        currentId={activeId}
        getItemHref={getItemHref ?? tour.getItemHref}
        getBackHref={getBackHref ?? tour.getBackHref}
        onNavigate={onNavigate ?? tour.onNavigate}
        onBack={() => {
          tour.end();
          return onBack?.();
        }}
        keyboardShortcuts={keyboardShortcuts}
        showShortcutHint={showShortcutHint}
      />
      <button
        ref={collapseRef}
        type="button"
        className="keep-floating-tour__control"
        data-keep-action="tour-collapse"
        aria-label={collapseLabel}
        onClick={() => tour.collapse()}
      >
        −
      </button>
      <button
        type="button"
        className="keep-floating-tour__control"
        data-keep-action="tour-end"
        aria-label={endLabel}
        onClick={() => tour.end()}
      >
        ×
      </button>
    </>
  );
  return createPortal(
    <KeepThemeProvider {...theme}>
      <aside
        className={["keep-floating-tour", `keep-floating-tour--${position}`, className].filter(Boolean).join(" ")}
        style={placementStyle}
        data-keepkit="floating-tour"
        data-state={tour.collapsed ? "collapsed" : "expanded"}
        data-persistence={tour.persistenceStatus}
        aria-label="KeepKit tour"
      >
        {content}
      </aside>
    </KeepThemeProvider>,
    document.body,
  );
}
