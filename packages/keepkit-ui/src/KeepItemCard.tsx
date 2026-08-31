"use client";

import type { KeepItem } from "@keepkit/core/core";
import { useKeepItem } from "@keepkit/core/react";
import {
  type ComponentType,
  type HTMLAttributeAnchorTarget,
  type HTMLAttributes,
  type ImgHTMLAttributes,
  isValidElement,
  type MouseEvent,
  type ReactNode,
} from "react";
import { KeepButton, type KeepButtonLabels } from "./KeepButton";
import { KeepStaleNotice } from "./KeepStaleNotice";
import { getMetaTitle, type RenderProp, renderRoot, toKeepButtonItem } from "./shared";
import { useUiLabel } from "./ui-context";

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
  const saveActionLabel = useUiLabel("save");
  const savedAtLabel = useUiLabel("saved");
  const errorLabel = useUiLabel("error");
  const removeActionLabel = useUiLabel("remove");
  const itemState = useKeepItem<TMeta>(item);
  const contentChildren = asChild && isValidElement(children) ? undefined : children;
  const state: KeepItemCardState<TMeta> = {
    item,
    isSaved: itemState.isSaved,
    isMutating: itemState.isMutating,
    error: itemState.error,
    remove: itemState.remove,
    status: item.status,
  };
  const resolvedTitle =
    typeof title === "function" ? title(item) : (title ?? getTitle?.(item) ?? getMetaTitle(item.meta) ?? item.id);
  const imageProps = getImageProps?.(item, resolvedTitle);
  const href = typeof hrefOption === "function" ? hrefOption(item) : hrefOption;
  const isAvailable = item.status === undefined || item.status === "available";
  const statusLabelKey = item.status && item.status !== "available" ? getStatusLabelKey(item.status) : "statusUnknown";
  const unavailableLabel = useUiLabel(statusLabelKey);
  const tagsLabel = useUiLabel("tags");
  const statusLabel = item.status && item.status !== "available" ? unavailableLabel : undefined;

  function renderLink(content: ReactNode): ReactNode {
    if (!href || !isAvailable) return content;
    const linkProps: KeepItemCardLinkProps = {
      href,
      target: linkTargetAttribute,
      rel: linkRel,
      onClick: (event) => onOpen?.(item, event),
      children: content,
    };
    return LinkComponent ? <LinkComponent {...linkProps} /> : <a {...linkProps} />;
  }

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
            <h3>{linkTarget === "title" ? renderLink(resolvedTitle) : resolvedTitle}</h3>
            {showSavedAt ? (
              <div data-card-meta>
                <span>{savedAtLabel}:</span>{" "}
                <time dateTime={new Date(item.savedAt).toISOString()}>{formatSavedAt(item.savedAt)}</time>
              </div>
            ) : null}
            {showTags && (item.tags?.length ?? 0) > 0 ? (
              renderTags ? (
                renderTags(item.tags ?? [], item)
              ) : (
                <ul aria-label={tagsLabel}>
                  {item.tags?.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
              )
            ) : null}
            {itemState.error ? <p role="alert">{getErrorMessage(itemState.error, errorLabel)}</p> : null}
            {statusLabel ? <KeepStaleNotice item={item} onRetry={onRetry} onRemoved={onRemoved} /> : null}
            {showSaveButton && !statusLabel ? (
              <KeepButton
                item={toKeepButtonItem(item)}
                labels={saveButtonLabels}
                getAriaLabel={(buttonState) =>
                  `${buttonState.isSaved ? removeActionLabel : saveActionLabel} ${String(resolvedTitle)}`
                }
              />
            ) : null}
            {!statusLabel ? (
              <button type="button" onClick={() => void handleRemove()} disabled={itemState.isMutating}>
                {removeLabel ?? removeActionLabel}
              </button>
            ) : null}
          </>
        ));

  const linkedBody = linkTarget === "card" ? renderLink(body) : body;
  return renderRoot(
    asChild,
    isValidElement(children) ? children : undefined,
    {
      ...rootProps,
      className,
      "data-keepkit": "card",
      "aria-busy": itemState.isMutating || rootProps["aria-busy"],
      "data-state": itemState.error ? "error" : itemState.isSaved ? "saved" : "unsaved",
      "data-status": item.status ?? "available",
      "data-loading": itemState.isMutating ? "true" : undefined,
    },
    linkedBody,
    "KeepItemCard",
  );
}

function getStatusLabelKey(
  status: NonNullable<KeepItem["status"]>,
): "statusExpired" | "statusRemoved" | "statusDeleted" | "statusPrivate" | "statusUnknown" {
  switch (status) {
    case "expired":
      return "statusExpired";
    case "removed":
      return "statusRemoved";
    case "deleted":
      return "statusDeleted";
    case "private":
      return "statusPrivate";
    default:
      return "statusUnknown";
  }
}

function formatSavedAt(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
