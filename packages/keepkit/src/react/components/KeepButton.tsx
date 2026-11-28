import {
  type ButtonHTMLAttributes,
  Children,
  cloneElement,
  type HTMLAttributes,
  isValidElement,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
  type RefCallback,
  useState,
} from "react";
import type { KeepItemInput } from "../../features/items/types";
import { useKeepItem } from "../hooks/useKeepItem";

export type KeepButtonItem<TMeta = Record<string, unknown>> = KeepItemInput<TMeta>;

type KeepButtonSharedProps<TMeta> = {
  item: KeepButtonItem<TMeta>;
  children?: ReactNode | ((state: KeepButtonState<TMeta>) => ReactNode);
  savedLabel?: ReactNode;
  unsavedLabel?: ReactNode;
  savedAriaLabel?: string;
  unsavedAriaLabel?: string;
  getAriaLabel?: (state: KeepButtonState<TMeta>) => string;
  disabled?: boolean;
  onToggleError?: (error: unknown) => void;
  /** Record removals for the provider's undo action. */
  undoable?: boolean;
  ref?: Ref<HTMLElement> | { readonly current: unknown };
};

export type KeepButtonProps<TMeta = Record<string, unknown>> = KeepButtonSharedProps<TMeta> &
  (
    | (Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "onClick" | "aria-pressed"> & {
        asChild?: false;
        onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
      })
    | (Omit<HTMLAttributes<HTMLElement>, "children" | "onClick" | "aria-pressed"> & {
        asChild: true;
        children: ReactElement | ((state: KeepButtonState<TMeta>) => ReactElement);
        onClick?: (event: MouseEvent<HTMLElement>) => void;
      })
  );

export type KeepButtonState<TMeta = Record<string, unknown>> = {
  item: ReturnType<typeof useKeepItem<TMeta>>["item"];
  isSaved: boolean;
  isLoading: boolean;
  isMutating: boolean;
  error: unknown | null;
  save: () => Promise<void>;
  remove: () => Promise<void>;
  toggle: () => Promise<void>;
  updateNote: (note?: string) => Promise<void>;
  updateTags: (tags?: string[]) => Promise<void>;
};

/** A style-free accessible save toggle. Consumers provide all visual styling. */
export function KeepButton<TMeta = Record<string, unknown>>({
  item,
  children,
  savedLabel = "Saved",
  unsavedLabel = "Save",
  savedAriaLabel,
  unsavedAriaLabel,
  getAriaLabel,
  asChild = false,
  onToggleError,
  undoable = false,
  onClick,
  disabled,
  ref: providedRef,
  ...buttonProps
}: KeepButtonProps<TMeta>) {
  const itemState = useKeepItem(item);
  const [failure, setFailure] = useState<{ id: string; error: unknown } | null>(null);
  const state = { ...itemState, error: failure?.id === item.id ? failure.error : null };
  const { isSaved, toggle } = state;
  const isDisabled = Boolean(disabled || state.isLoading || state.isMutating);

  async function handleClick(event: MouseEvent<HTMLElement>) {
    if (isDisabled) return;
    if (asChild) {
      (onClick as ((event: MouseEvent<HTMLElement>) => void) | undefined)?.(event);
    } else {
      (onClick as ((event: MouseEvent<HTMLButtonElement>) => void) | undefined)?.(
        event as MouseEvent<HTMLButtonElement>,
      );
    }
    if (event.defaultPrevented) return;
    setFailure(null);
    try {
      await (undoable && isSaved ? itemState.removeWithUndo() : toggle());
    } catch (error) {
      setFailure({ id: item.id, error });
      onToggleError?.(error);
    }
  }

  const content =
    typeof children === "function" ? children(state) : (children ?? (isSaved ? savedLabel : unsavedLabel));
  function handleElementClick(event: MouseEvent<HTMLElement>) {
    if (isDisabled) {
      if (asChild) event.preventDefault();
      return;
    }
    if (asChild && isValidElement<{ onClick?: (event: MouseEvent<HTMLElement>) => void }>(content)) {
      content.props.onClick?.(event);
    }
    if (!event.defaultPrevented) {
      void handleClick(event);
      if (asChild && event.currentTarget instanceof HTMLAnchorElement) event.preventDefault();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (asChild && isValidElement<{ onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void }>(content)) {
      content.props.onKeyDown?.(event);
    }
    (buttonProps as { onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void }).onKeyDown?.(event);
    if (!event.defaultPrevented && !isDisabled && asChild && (event.key === "Enter" || event.key === " ")) {
      void handleClick(event as unknown as MouseEvent<HTMLElement>);
      event.preventDefault();
    }
  }

  const child = asChild ? Children.only(content) : undefined;
  if (asChild && !isValidElement(child)) {
    throw new Error("KeepButton with asChild requires a single React element child.");
  }
  const childRef = asChild && isValidElement(child) ? (child.props as { ref?: Ref<HTMLElement> }).ref : undefined;

  const commonProps = {
    ...buttonProps,
    "aria-pressed": isSaved,
    "data-state": failure?.id === item.id ? "error" : isSaved ? "saved" : "unsaved",
    "data-loading": state.isLoading || state.isMutating ? "true" : undefined,
    "data-disabled": isDisabled ? "true" : undefined,
    "aria-label":
      ("aria-label" in buttonProps ? buttonProps["aria-label"] : undefined) ??
      getAriaLabel?.(state) ??
      (isSaved ? savedAriaLabel : unsavedAriaLabel) ??
      getAccessibleLabel(item, asChild),
    ...(asChild
      ? {
          "aria-disabled": isDisabled,
          role: buttonProps.role ?? "button",
          tabIndex: isDisabled ? -1 : (buttonProps.tabIndex ?? 0),
        }
      : { disabled: isDisabled }),
    onClick: handleElementClick,
    onKeyDown: handleKeyDown,
    ...(asChild ? { ref: composeRefs(childRef, providedRef) } : {}),
  };

  if (asChild) {
    return cloneElement(child as ReactElement, commonProps);
  }

  return (
    <button
      {...commonProps}
      ref={providedRef as Ref<HTMLButtonElement>}
      type={"type" in buttonProps ? (buttonProps.type ?? "button") : "button"}
    >
      {content}
    </button>
  );
}

function composeRefs<T>(...refs: Array<Ref<T> | { readonly current: unknown } | null | undefined>): RefCallback<T> {
  return (value) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(value);
      else if (ref) (ref as { current: T | null }).current = value;
    }
  };
}

function getAccessibleLabel<TMeta>(item: KeepButtonItem<TMeta>, asChild: boolean): string {
  if (!asChild) return "Save item";
  const title = getMetaTitle(item.meta);
  const subject = title ? `${item.targetType ?? "item"}: ${title}` : (item.targetType ?? "item");
  return `Save ${subject}`;
}

function getMetaTitle<TMeta>(meta: TMeta): string | undefined {
  if (typeof meta !== "object" || meta === null || !("title" in meta)) return undefined;
  const title = (meta as { title?: unknown }).title;
  return typeof title === "string" && title.trim() ? title.trim() : undefined;
}
