import type { FocusEvent, KeyboardEvent, RefObject } from "react";
import { useCallback, useEffect, useRef } from "react";

type RovingHandlers<TElement extends HTMLElement> = {
  ref: RefObject<TElement | null>;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onFocusCapture: (event: FocusEvent<HTMLElement>) => void;
};

/** Keeps cards in a group reachable through one tab stop and arrow-key movement. */
export function useRovingTabIndex<TElement extends HTMLElement>(): RovingHandlers<TElement> {
  const ref = useRef<TElement | null>(null);

  const getItems = useCallback((): HTMLElement[] => {
    const root = ref.current;
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>('[data-keepkit="card"]')).filter(
      (item) => item.getAttribute("aria-hidden") !== "true" && item.getAttribute("data-roving-disabled") !== "true",
    );
  }, []);

  const syncTabIndices = useCallback(() => {
    const items = getItems();
    if (items.length === 0) return;
    const activeElement = document.activeElement;
    const activeItem = items.find((item) => item === activeElement || item.contains(activeElement));
    const activeIndex = activeItem ? items.indexOf(activeItem) : 0;
    items.forEach((item, index) => {
      item.tabIndex = index === activeIndex ? 0 : -1;
    });
  }, [getItems]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    syncTabIndices();
    const observer = new MutationObserver(syncTabIndices);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [syncTabIndices]);

  const onFocusCapture = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      if (!(event.target instanceof HTMLElement)) return;
      const item = event.target.closest<HTMLElement>('[data-keepkit="card"]');
      if (!item || !ref.current?.contains(item)) return;
      getItems().forEach((candidate) => {
        candidate.tabIndex = candidate === item ? 0 : -1;
      });
    },
    [getItems],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.defaultPrevented) return;
      const items = getItems();
      if (!(event.target instanceof HTMLElement)) return;
      const current = event.target.closest<HTMLElement>('[data-keepkit="card"]');
      if (!current || current !== event.target || !ref.current?.contains(current)) return;
      const currentIndex = items.indexOf(current);
      if (currentIndex < 0) return;

      let nextIndex: number | undefined;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = items.length - 1;
      if (event.key === "ArrowRight" || event.key === "ArrowDown")
        nextIndex = Math.min(currentIndex + 1, items.length - 1);
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = Math.max(currentIndex - 1, 0);
      if (nextIndex === undefined) return;

      event.preventDefault();
      if (nextIndex === currentIndex) return;
      items[nextIndex]?.focus();
    },
    [getItems],
  );

  return { ref, onKeyDown, onFocusCapture };
}
