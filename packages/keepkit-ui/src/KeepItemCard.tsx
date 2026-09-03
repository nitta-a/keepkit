"use client";

import type { KeepItem } from "@keepkit/core/core";
import {
  type ComponentType,
  type HTMLAttributeAnchorTarget,
  type HTMLAttributes,
  type ImgHTMLAttributes,
  isValidElement,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useKeepItemCard } from "./hooks/useKeepItemCard";
import { KeepButton, type KeepButtonLabels } from "./KeepButton";
import { KeepStaleNotice } from "./KeepStaleNotice";
import { type RenderProp, renderRoot, toKeepButtonItem } from "./shared";

export type KeepItemCardState<TMeta = Record<string, unknown>> = {
  item: KeepItem<TMeta>;
  isSaved: boolean;
  isMutating: boolean;
  error: unknown | null;
  remove: () => Promise<void>;
  status: KeepItem["status"];
};

export type KeepItemCardLinkProps = {
  href: string;
  children?: ReactNode;
  target?: HTMLAttributeAnchorTarget;
  rel?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
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
  renderTags?: (tags: string[], item: KeepItem<TMeta>) => ReactNode;
  showTags?: boolean;
  showSavedAt?: boolean;
  imageAlt?: string;
  render?: RenderProp<KeepItemCardState<TMeta>>;
  children?: ReactNode | RenderProp<KeepItemCardState<TMeta>>;
  removeLabel?: string;
  onRemoveError?: (error: unknown) => void;
  onRemoved?: (item: KeepItem<TMeta>) => void;
  onRetry?: (item: KeepItem<TMeta>) => void | Promise<void>;
  showSaveButton?: boolean;
  saveButtonLabels?: KeepButtonLabels;
  asChild?: boolean;
  href?: string | ((item: KeepItem<TMeta>) => string | undefined);
  onOpen?: (item: KeepItem<TMeta>, event: MouseEvent<HTMLElement>) => void;
  linkTarget?: "title" | "card";
  linkComponent?: ComponentType<KeepItemCardLinkProps>;
  linkTargetAttribute?: HTMLAttributeAnchorTarget;
  linkRel?: string;
};

/** A low-dependency item presentation primitive. The default markup can be replaced with render props. */
export function KeepItemCard<TMeta = Record<string, unknown>>({
  item,
  title,
  getTitle,
  getImageProps,
  imageComponent: ImageComponent,
  renderImage,
  renderTags,
  showTags = true,
  showSavedAt = true,
  imageAlt,
  render,
  children,
  removeLabel,
  onRemoveError,
  onRemoved,
  onRetry,
  showSaveButton = true,
  saveButtonLabels,
  asChild = false,
  href: hrefOption,
  onOpen,
  linkTarget = "title",
  linkComponent: LinkComponent,
  linkTargetAttribute,
  linkRel,
  className,
  ...rootProps
}: KeepItemCardProps<TMeta>) {
  const view = useKeepItemCard<TMeta>({
    item,
    title,
    getTitle,
    getImageProps,
    href: hrefOption,
    linkTargetAttribute,
    linkRel,
    onRemoveError,
    onRemoved,
  });
  const contentChildren = asChild && isValidElement(children) ? undefined : children;

  function renderLink(content: ReactNode): ReactNode {
    if (!view.href || !view.isAvailable) return content;
    const linkProps: KeepItemCardLinkProps = {
      href: view.href,
      target: view.resolvedLinkTarget,
      rel: view.resolvedLinkRel,
      onClick: (event) => onOpen?.(item, event),
      children: content,
    };
    return LinkComponent ? <LinkComponent {...linkProps} /> : <a {...linkProps} />;
  }

  const body = render
    ? render(view.state)
    : typeof contentChildren === "function"
      ? contentChildren(view.state)
      : (contentChildren ?? (
          <>
            {view.imageProps
              ? (renderImage?.({ ...view.imageProps, alt: imageAlt ?? view.imageProps.alt }, item) ??
                (ImageComponent ? (
                  <ImageComponent {...view.imageProps} alt={imageAlt ?? view.imageProps.alt} />
                ) : (
                  <img {...view.imageProps} alt={imageAlt ?? view.imageProps.alt} />
                )))
              : null}
            <h3>
              {linkTarget === "title" ? (
                view.isAvailable ? (
                  renderLink(view.resolvedTitle)
                ) : view.href ? (
                  <span aria-disabled="true" data-link-disabled="true">
                    {view.resolvedTitle}
                  </span>
                ) : (
                  view.resolvedTitle
                )
              ) : (
                view.resolvedTitle
              )}
            </h3>
            {showSavedAt ? (
              <div data-card-meta>
                <span>{view.labels.savedAt}:</span>{" "}
                <time dateTime={new Date(item.savedAt).toISOString()}>{formatSavedAt(item.savedAt)}</time>
              </div>
            ) : null}
            {showTags && (item.tags?.length ?? 0) > 0 ? (
              renderTags ? (
                renderTags(item.tags ?? [], item)
              ) : (
                <ul aria-label={view.labels.tags}>
                  {item.tags?.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
              )
            ) : null}
            {view.itemState.error ? (
              <p role="alert">{getErrorMessage(view.itemState.error, view.labels.error)}</p>
            ) : null}
            {view.statusLabel ? <KeepStaleNotice item={item} onRetry={onRetry} onRemoved={onRemoved} /> : null}
            {showSaveButton && !view.statusLabel ? (
              <KeepButton
                item={toKeepButtonItem(item)}
                labels={saveButtonLabels}
                getAriaLabel={(buttonState) =>
                  `${buttonState.isSaved ? view.labels.remove : view.labels.save} ${String(view.resolvedTitle)}`
                }
              />
            ) : null}
            {!view.statusLabel ? (
              <button
                type="button"
                data-keep-action="remove-item"
                onClick={() => void view.remove()}
                disabled={view.itemState.isMutating}
              >
                {removeLabel ?? view.labels.remove}
              </button>
            ) : null}
          </>
        ));

  const linkedBody = linkTarget === "card" && view.isAvailable ? renderLink(body) : body;
  return renderRoot(
    asChild,
    isValidElement(children) ? children : undefined,
    {
      ...rootProps,
      className,
      "data-keepkit": "card",
      "aria-busy": view.itemState.isMutating || rootProps["aria-busy"],
      "aria-disabled": rootProps["aria-disabled"] ?? (!view.isAvailable ? "true" : undefined),
      "data-state": view.itemState.error ? "error" : view.itemState.isSaved ? "saved" : "unsaved",
      "data-status": item.status ?? "available",
      "data-item-status": view.displayStatus,
      "data-loading": view.itemState.isMutating ? "true" : undefined,
    },
    linkedBody,
    "KeepItemCard",
  );
}

function formatSavedAt(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
