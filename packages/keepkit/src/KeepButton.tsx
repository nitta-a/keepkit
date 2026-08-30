import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";
import { useKeepItem } from "./hooks/useKeepItem";
import type { KeepItemInput } from "./types";

export type KeepButtonItem<TMeta = Record<string, unknown>> = KeepItemInput<TMeta> & {
  id: string;
};

export type KeepButtonProps<TMeta = Record<string, unknown>> = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "onClick" | "aria-pressed"
> & {
  item: KeepButtonItem<TMeta>;
  children?: ReactNode;
  savedLabel?: ReactNode;
  unsavedLabel?: ReactNode;
  onToggleError?: (error: unknown) => void;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
};

/** A style-free accessible save toggle. Consumers provide all visual styling. */
export function KeepButton<TMeta = Record<string, unknown>>({
  item,
  children,
  savedLabel = "Saved",
  unsavedLabel = "Save",
  onToggleError,
  onClick,
  disabled,
  ...buttonProps
}: KeepButtonProps<TMeta>) {
  const { isSaved, toggle } = useKeepItem(item.id, {
    meta: item.meta,
    targetType: item.targetType,
    note: item.note,
  });

  async function handleClick(event: MouseEvent<HTMLButtonElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;
    try {
      await toggle();
    } catch (error) {
      onToggleError?.(error);
    }
  }

  return (
    <button
      {...buttonProps}
      aria-pressed={isSaved}
      aria-label={buttonProps["aria-label"] ?? (isSaved ? "Remove saved item" : "Save item")}
      disabled={disabled}
      onClick={(event) => void handleClick(event)}
      type={buttonProps.type ?? "button"}
    >
      {children ?? (isSaved ? savedLabel : unsavedLabel)}
    </button>
  );
}
