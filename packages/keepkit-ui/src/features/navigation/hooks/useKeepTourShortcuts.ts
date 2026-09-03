import { useEffect } from "react";

export type KeepTourShortcutsOptions = {
  onNext: () => void | Promise<void>;
  onPrev: () => void | Promise<void>;
  enabled?: boolean;
  allowInEditable?: boolean;
  preventDefault?: boolean;
  nextKeys?: readonly string[];
  prevKeys?: readonly string[];
  onError?: (error: unknown) => void;
};

/** Bind J/]/K/[ (or custom keys) to previous/next tour actions. */
export function useKeepTourShortcuts({
  onNext,
  onPrev,
  enabled = true,
  allowInEditable = false,
  preventDefault = true,
  nextKeys = ["j", "]"],
  prevKeys = ["k", "["],
  onError,
}: KeepTourShortcutsOptions): void {
  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!allowInEditable && isEditableTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const key = event.key.toLocaleLowerCase();
      const action = nextKeys.some((candidate) => candidate.toLocaleLowerCase() === key)
        ? onNext
        : prevKeys.some((candidate) => candidate.toLocaleLowerCase() === key)
          ? onPrev
          : undefined;
      if (!action) return;
      if (preventDefault) event.preventDefault();
      void Promise.resolve(action()).catch((error) => onError?.(error));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [allowInEditable, enabled, nextKeys, onError, onNext, onPrev, preventDefault, prevKeys]);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}
