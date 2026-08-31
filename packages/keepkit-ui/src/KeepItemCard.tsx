"use client";

import type { KeepItem } from "@keepkit/core/core";
import { useKeepItem } from "@keepkit/core/react";
import { type ComponentType, type HTMLAttributes, type ImgHTMLAttributes, isValidElement, type ReactNode } from "react";
import { KeepButton, type KeepButtonLabels } from "./KeepButton";
import { getMetaTitle, type RenderProp, renderRoot, toKeepButtonItem } from "./shared";
import { useUiLabel } from "./ui-context";

export type KeepItemCardState<TMeta = Record<string, unknown>> = {
  item: KeepItem<TMeta>;
  isSaved: boolean;
  isMutating: boolean;
  error: unknown | null;
  remove: () => Promise<void>;
};

export type KeepImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  alt: string;
};

export type KeepItemCardProps<TMeta = Record<string, unknown>> = Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "title"
> & {
  item: KeepItem<TMeta>;
  title?: ReactNode | ((item: KeepItem<TMeta>) => ReactNode);
  getTitle?: (item: KeepItem<TMeta>) => ReactNode;
  getImageProps?: (item: KeepItem<TMeta>, title: ReactNode) => KeepImageProps | undefined;
  imageComponent?: ComponentType<KeepImageProps>;
  renderImage?: (props: KeepImageProps, item: KeepItem<TMeta>) => ReactNode;
  imageAlt?: string;
  render?: RenderProp<KeepItemCardState<TMeta>>;
  children?: ReactNode | RenderProp<KeepItemCardState<TMeta>>;
  removeLabel?: string;
  onRemoveError?: (error: unknown) => void;
  onRemoved?: (item: KeepItem<TMeta>) => void;
  showSaveButton?: boolean;
  saveButtonLabels?: KeepButtonLabels;
  asChild?: boolean;
};

/** A low-dependency item presentation primitive. The default markup can be replaced with render props. */
export function KeepItemCard<TMeta = Record<string, unknown>>({
  item,
  title,
  getTitle,
  getImageProps,
  imageComponent: ImageComponent,
  renderImage,
  imageAlt,
  render,
  children,
  removeLabel,
  onRemoveError,
  onRemoved,
  showSaveButton = true,
  saveButtonLabels,
  asChild = false,
  className,
  ...rootProps
}: KeepItemCardProps<TMeta>) {
  const saveActionLabel = useUiLabel("save");
  const removeActionLabel = useUiLabel("remove");
  const itemState = useKeepItem<TMeta>(item);
  const contentChildren = asChild && isValidElement(children) ? undefined : children;
  const state: KeepItemCardState<TMeta> = {
    item,
    isSaved: itemState.isSaved,
    isMutating: itemState.isMutating,
    error: itemState.error,
    remove: itemState.remove,
  };
  const resolvedTitle =
    typeof title === "function" ? title(item) : (title ?? getTitle?.(item) ?? getMetaTitle(item.meta) ?? item.id);
  const imageProps = getImageProps?.(item, resolvedTitle);

  async function handleRemove() {
    try {
      await itemState.remove();
      onRemoved?.(item);
    } catch (error) {
      onRemoveError?.(error);
    }
  }

  const body = render
    ? render(state)
    : typeof contentChildren === "function"
      ? contentChildren(state)
      : (contentChildren ?? (
          <>
            {imageProps
              ? (renderImage?.({ ...imageProps, alt: imageAlt ?? imageProps.alt }, item) ??
                (ImageComponent ? (
                  <ImageComponent {...imageProps} alt={imageAlt ?? imageProps.alt} />
                ) : (
                  <img {...imageProps} alt={imageAlt ?? imageProps.alt} />
                )))
              : null}
            <h3>{resolvedTitle}</h3>
            {showSaveButton ? (
              <KeepButton
                item={toKeepButtonItem(item)}
                labels={saveButtonLabels}
                getAriaLabel={(buttonState) =>
                  `${buttonState.isSaved ? removeActionLabel : saveActionLabel} ${String(resolvedTitle)}`
                }
              />
            ) : null}
            <button type="button" onClick={() => void handleRemove()} disabled={itemState.isMutating}>
              {removeLabel ?? removeActionLabel}
            </button>
          </>
        ));

  return renderRoot(
    asChild,
    isValidElement(children) ? children : undefined,
    {
      ...rootProps,
      className,
      "aria-busy": itemState.isMutating || rootProps["aria-busy"],
      "data-state": itemState.isSaved ? "saved" : "unsaved",
      "data-loading": itemState.isMutating ? "true" : undefined,
    },
    body,
    "KeepItemCard",
  );
}
