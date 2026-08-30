import {
  type ButtonHTMLAttributes,
  Children,
  cloneElement,
  isValidElement,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
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
  children?: ReactNode | ((state: KeepButtonState<TMeta>) => ReactNode);
  asChild?: boolean;
  savedLabel?: ReactNode;
  unsavedLabel?: ReactNode;
  onToggleError?: (error: unknown) => void;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
};

export type KeepButtonState<TMeta = Record<string, unknown>> = {
  item: ReturnType<typeof useKeepItem<TMeta>>["item"];
  isSaved: boolean;
  isLoading: boolean;
  error: unknown | null;
  save: () => Promise<void>;
  remove: () => Promise<void>;
  toggle: () => Promise<void>;
  updateNote: (note?: string) => Promise<void>;
};

/** A style-free accessible save toggle. Consumers provide all visual styling. */
export function KeepButton<TMeta = Record<string, unknown>>({
  item,
  children,
  savedLabel = "Saved",
  unsavedLabel = "Save",
  asChild = false,
  onToggleError,
  onClick,
  disabled,
  ...buttonProps
}: KeepButtonProps<TMeta>) {
  const state = useKeepItem(item.id, {
    meta: item.meta,
    targetType: item.targetType,
    note: item.note,
    tags: item.tags,
  });
  const { isSaved, toggle } = state;

  async function handleClick(event: MouseEvent<HTMLButtonElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;
    try {
      await toggle();
    } catch (error) {
      onToggleError?.(error);
    }
  }

  const content =
    typeof children === "function"
      ? children(state)
      : (children ?? (isSaved ? savedLabel : unsavedLabel));
  function handleElementClick(event: MouseEvent<HTMLElement>) {
    if (
      asChild &&
      isValidElement<{ onClick?: (event: MouseEvent<HTMLElement>) => void }>(content)
    ) {
      content.props.onClick?.(event);
    }
    if (!event.defaultPrevented) void handleClick(event as MouseEvent<HTMLButtonElement>);
  }

  const commonProps = {
    ...buttonProps,
    "aria-pressed": isSaved,
    "aria-label": buttonProps["aria-label"] ?? (isSaved ? "Remove saved item" : "Save item"),
    disabled,
    onClick: handleElementClick,
  };

  if (asChild) {
    const child = Children.only(content);
    if (!isValidElement(child)) {
      throw new Error("KeepButton with asChild requires a single React element child.");
    }
    return cloneElement(child as ReactElement, commonProps);
  }

  return (
    <button {...commonProps} type={buttonProps.type ?? "button"}>
      {content}
    </button>
  );
}
