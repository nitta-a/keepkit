import { useEffect } from "react";
import type { KeepItemInput } from "../types";
import { useKeepItem } from "./useKeepItem";

export type KeepShortcutModifier = "meta" | "ctrl" | "alt" | "shift";

export type KeepShortcutOptions<TMeta = Record<string, unknown>> = {
  key: string;
  modifier?: KeepShortcutModifier;
  id?: string;
  itemPayload?: KeepItemInput<TMeta>;
  action?: "toggle" | "save" | "remove";
  enabled?: boolean;
  preventDefault?: boolean;
  allowInEditable?: boolean;
  onTrigger?: (event: KeyboardEvent) => void | Promise<void>;
  onError?: (error: unknown) => void;
};

/** Bind a keyboard shortcut to a Keep action or an arbitrary command. */
export function useKeepShortcut<TMeta = Record<string, unknown>>(options: KeepShortcutOptions<TMeta>): void {
  const item = useKeepItem(options.id ?? "", options.itemPayload);
  const {
    action = "toggle",
    allowInEditable = false,
    enabled = true,
    key,
    modifier,
    onError,
    onTrigger,
    preventDefault = true,
  } = options;

  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!allowInEditable && isEditableTarget(event.target)) return;
      if (!matchesShortcut(event, key, modifier)) return;
      if (preventDefault) event.preventDefault();
      const run = onTrigger
        ? onTrigger(event)
        : options.id
          ? action === "save"
            ? item.save()
            : action === "remove"
              ? item.remove()
              : item.toggle()
          : undefined;
      if (run) void Promise.resolve(run).catch((error) => onError?.(error));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    action,
    allowInEditable,
    enabled,
    item.remove,
    item.save,
    item.toggle,
    key,
    modifier,
    onError,
    onTrigger,
    options.id,
    preventDefault,
  ]);
}

function matchesShortcut(event: KeyboardEvent, key: string, modifier?: KeepShortcutModifier): boolean {
  if (event.key.toLocaleLowerCase() !== key.toLocaleLowerCase()) return false;
  const modifiers = {
    meta: event.metaKey,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
  };
  if (modifier ? !modifiers[modifier] : Object.values(modifiers).some(Boolean)) return false;
  return Object.entries(modifiers).every(([name, pressed]) => name === modifier || !pressed);
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
