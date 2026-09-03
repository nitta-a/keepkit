"use client";

import type { HTMLAttributes, ReactNode } from "react";

export type KeepShortcutHintProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  shortcut: string | readonly string[];
  separator?: ReactNode;
};

/** Displays a keyboard shortcut using semantic kbd elements. */
export function KeepShortcutHint({ shortcut, separator = "+", ...props }: KeepShortcutHintProps) {
  const keys: readonly string[] = typeof shortcut === "string" ? shortcut.split("+") : [...shortcut];
  const occurrences = new Map<string, number>();
  const keyedKeys = keys.map((key) => {
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    return { id: `${key}-${occurrence}`, value: key };
  });
  return (
    <span {...props} data-keepkit="shortcut-hint" aria-hidden={props["aria-hidden"] ?? true}>
      {keyedKeys.map((key, index) => (
        <span key={key.id}>
          {index > 0 ? <span data-shortcut-separator="true">{separator}</span> : null}
          <kbd>{key.value.trim()}</kbd>
        </span>
      ))}
    </span>
  );
}
