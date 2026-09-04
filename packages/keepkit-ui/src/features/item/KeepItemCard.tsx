"use client";

import type { KeepItem } from "@keepkit/core/core";
import {
  type ButtonHTMLAttributes,
  type ComponentType,
  createContext,
  createElement,
  type HTMLAttributeAnchorTarget,
  type HTMLAttributes,
  type ImgHTMLAttributes,
  isValidElement,
  type MouseEvent,
  type ReactNode,
  type Ref,
  type SyntheticEvent,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  KeepHighlight,
  type RenderProp,
  renderRoot,
  toKeepButtonItem,
  useKeepSearchQuery,
} from "../../foundation/shared";
import {
  KeepArchiveButton,
  type KeepArchiveButtonProps,
  KeepPinButton,
  type KeepPinButtonProps,
} from "../actions/KeepArchiveButton";
import { KeepButton, type KeepButtonLabels, type KeepButtonProps } from "../actions/KeepButton";
import type { KeepLayoutPreset } from "../collection/KeepCollection";
import { KeepStaleNotice } from "../status/KeepStaleNotice";
import { useKeepItemCard } from "./hooks/useKeepItemCard";

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

export type KeepImageProps = ImgHTMLAttributes<HTMLImageElement> & { src: string; alt: string };

export type KeepItemCardProps<TMeta = Record<string, unknown>> = Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "title"
> & {
  ref?: Ref<HTMLElement> | { readonly current: unknown };
  item: KeepItem<TMeta>;
  title?: ReactNode | ((item: KeepItem<TMeta>) => ReactNode);
  getTitle?: (item: KeepItem<TMeta>) => ReactNode;
  getImageProps?: (item: KeepItem<TMeta>, title: ReactNode) => KeepImageProps | undefined;
  imageComponent?: ComponentType<KeepImageProps>;
  renderImage?: (props: KeepImageProps, item: KeepItem<TMeta>) => ReactNode;
  renderTags?: (tags: string[], item: KeepItem<TMeta>) => ReactNode;
  showTags?: boolean;
  showSavedAt?: boolean;
  collectionLabels?: Record<string, string>;
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
  highlightQuery?: string;
};

export type KeepItemCardMediaProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  children?: ReactNode;
  fallback?: ReactNode;
};
export type KeepItemCardContentProps = HTMLAttributes<HTMLDivElement>;
export type KeepItemCardTitleProps = Omit<HTMLAttributes<HTMLHeadingElement>, "title"> & {
  as?: "h2" | "h3" | "h4" | "h5" | "h6";
};
export type KeepItemCardTagsProps = HTMLAttributes<HTMLUListElement>;
export type KeepItemCardActionsProps = HTMLAttributes<HTMLDivElement>;
export type KeepItemCardSkeletonProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  layout?: KeepLayoutPreset;
};

type KeepItemCardCompoundContext = {
  item: KeepItem<unknown>;
  collectionLabel?: string;
  resolvedTitle: ReactNode;
  renderTitle: (content: ReactNode) => ReactNode;
  image: ReactNode | null;
  imageStatus: "loaded" | "error" | "loading";
  fallbackLabel: string;
  tags: string[];
  tagsLabel: string;
  renderedTags: ReactNode | null;
  meta: ReactNode | null;
  error: ReactNode | null;
  actions: ReactNode;
  saveButtonLabels?: KeepButtonLabels;
  removeLabel: string;
  remove: () => Promise<void>;
  isMutating: boolean;
  saveAriaLabel: string;
  renderText: (content: ReactNode) => ReactNode;
};

const KeepItemCardContext = createContext<KeepItemCardCompoundContext | null>(null);

function useKeepItemCardCompound(part: string): KeepItemCardCompoundContext {
  const context = useContext(KeepItemCardContext);
  if (!context) throw new Error(`KeepItemCard.${part} must be rendered inside KeepItemCard.`);
  return context;
}

/** A low-dependency item presentation primitive with composable card parts. */
function KeepItemCardRoot<TMeta = Record<string, unknown>>({
  item,
  title,
  getTitle,
  getImageProps,
  imageComponent: ImageComponent,
  renderImage,
  renderTags,
  showTags = true,
  showSavedAt = true,
  collectionLabels,
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
  highlightQuery,
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
  const contextQuery = useKeepSearchQuery();
  const searchQuery = highlightQuery ?? contextQuery;
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

  function renderTitle(content: ReactNode): ReactNode {
    if (linkTarget !== "title") return content;
    if (view.isAvailable) return renderLink(content);
    return view.href ? (
      <span aria-disabled="true" data-link-disabled="true">
        {content}
      </span>
    ) : (
      content
    );
  }

  const resolvedImageProps = view.imageProps ? { ...view.imageProps, alt: imageAlt ?? view.imageProps.alt } : undefined;
  const imageSource = resolvedImageProps?.src;
  const [imageStatus, setImageStatus] = useState<"loaded" | "error" | "loading">(imageSource ? "loading" : "error");
  useEffect(() => {
    setImageStatus(imageSource ? "loading" : "error");
  }, [imageSource]);
  let image: ReactNode = null;
  if (resolvedImageProps) {
    const imagePropsWithHandlers: KeepImageProps = {
      ...resolvedImageProps,
      src: resolvedImageProps.src,
      alt: imageAlt ?? resolvedImageProps.alt,
      onLoad: (event: SyntheticEvent<HTMLImageElement, Event>) => {
        resolvedImageProps.onLoad?.(event);
        setImageStatus("loaded");
      },
      onError: (event: SyntheticEvent<HTMLImageElement, Event>) => {
        resolvedImageProps.onError?.(event);
        setImageStatus("error");
      },
    };
    image =
      renderImage?.(imagePropsWithHandlers, item) ??
      (ImageComponent ? (
        <ImageComponent {...imagePropsWithHandlers} />
      ) : (
        <img {...imagePropsWithHandlers} alt={imagePropsWithHandlers.alt} />
      ));
  }
  const tags = showTags ? (item.tags ?? []) : [];
  const renderedTags = showTags && tags.length > 0 ? (renderTags?.(tags, item) ?? null) : null;
  const meta = showSavedAt ? (
    <div data-card-meta>
      <span>{view.labels.savedAt}:</span>{" "}
      <time dateTime={new Date(item.savedAt).toISOString()}>{formatSavedAt(item.savedAt)}</time>
    </div>
  ) : null;
  const error = view.itemState.error ? (
    <p role="alert">{getErrorMessage(view.itemState.error, view.labels.error)}</p>
  ) : null;
  const actions = view.statusLabel ? (
    <KeepStaleNotice item={item} onRetry={onRetry} onRemoved={onRemoved} />
  ) : (
    <>
      {showSaveButton ? <KeepItemCardSave /> : null}
      <KeepItemCardRemove />
    </>
  );
  const compoundValue: KeepItemCardCompoundContext = {
    item,
    collectionLabel: item.collectionId ? (collectionLabels?.[item.collectionId] ?? item.collectionId) : undefined,
    resolvedTitle: view.resolvedTitle,
    renderTitle,
    image: imageStatus === "error" ? null : image,
    imageStatus,
    fallbackLabel: String(view.resolvedTitle),
    tags,
    tagsLabel: view.labels.tags,
    renderedTags,
    meta,
    error,
    actions,
    saveButtonLabels,
    removeLabel: removeLabel ?? view.labels.remove,
    remove: view.remove,
    isMutating: view.itemState.isMutating,
    saveAriaLabel: `${view.labels.remove} ${String(view.resolvedTitle)}`,
    renderText: (content) => <KeepHighlight query={searchQuery}>{content}</KeepHighlight>,
  };
  const defaultBody = (
    <>
      <KeepItemCardMedia />
      <KeepItemCardContent />
      <KeepItemCardActions />
    </>
  );
  const body = render
    ? render(view.state)
    : typeof contentChildren === "function"
      ? contentChildren(view.state)
      : (contentChildren ?? defaultBody);
  const linkedBody = linkTarget === "card" && view.isAvailable ? renderLink(body) : body;
  const root = renderRoot(
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
  return <KeepItemCardContext.Provider value={compoundValue}>{root}</KeepItemCardContext.Provider>;
}

function KeepItemCardMedia({ children, fallback, ...props }: KeepItemCardMediaProps) {
  const context = useKeepItemCardCompound("Media");
  return (
    <div {...props} data-keep-card-part="media" data-media-status={context.imageStatus} data-aspect-ratio="1/1">
      {children ?? context.image ?? (
        <span role="img" aria-label={context.fallbackLabel} data-keep-card-fallback="true">
          {fallback ?? <KeepMediaPlaceholderIcon />}
        </span>
      )}
    </div>
  );
}

function KeepItemCardContent({ children, ...props }: KeepItemCardContentProps) {
  const context = useKeepItemCardCompound("Content");
  return (
    <div {...props} data-keep-card-part="content">
      {children === undefined ? (
        <>
          <KeepItemCardTitle />
          {context.meta}
          <KeepItemCardTags />
          {context.error}
        </>
      ) : (
        context.renderText(children)
      )}
    </div>
  );
}

function KeepItemCardTitle({ as = "h3", children, ...props }: KeepItemCardTitleProps) {
  const context = useKeepItemCardCompound("Title");
  return createElement(
    as,
    { ...props, "data-keep-card-part": "title", "data-line-clamp": "2" },
    context.renderTitle(context.renderText(children ?? context.resolvedTitle)),
  );
}

function KeepMediaPlaceholderIcon() {
  return (
    <svg data-media-fallback-icon="true" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13Z"
        fill="none"
        stroke="currentColor"
      />
      <circle cx="9" cy="9" r="1.5" fill="currentColor" />
      <path d="m5.5 18 4.5-4.5 3 3 2-2L19 18" fill="none" stroke="currentColor" />
    </svg>
  );
}

function KeepItemCardTags({ children, ...props }: KeepItemCardTagsProps) {
  const context = useKeepItemCardCompound("Tags");
  if (children === undefined && context.renderedTags) return context.renderedTags;
  if (children === undefined && context.tags.length === 0) return null;
  return (
    <ul {...props} aria-label={props["aria-label"] ?? context.tagsLabel} data-keep-card-part="tags">
      {children ?? context.tags.map((tag) => <li key={tag}>{tag}</li>)}
    </ul>
  );
}

function KeepItemCardActions({ children, ...props }: KeepItemCardActionsProps) {
  const context = useKeepItemCardCompound("Actions");
  return (
    <div {...props} data-keep-card-part="actions">
      {children ?? context.actions}
    </div>
  );
}

export type KeepItemCardActionSlotProps = Omit<KeepPinButtonProps<unknown>, "item" | "children"> & {
  children?: ReactNode;
};
export type KeepItemCardSaveProps = Omit<KeepButtonProps<unknown>, "item" | "asChild"> & { asChild?: false };
export type KeepItemCardRemoveProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  children?: ReactNode;
};
export type KeepItemCardBadgeProps = HTMLAttributes<HTMLSpanElement>;

function KeepItemCardSave({ labels, getAriaLabel, ...props }: KeepItemCardSaveProps) {
  const context = useKeepItemCardCompound("Save");
  return (
    <KeepButton<unknown>
      {...props}
      item={toKeepButtonItem(context.item)}
      asChild={false}
      labels={labels ?? context.saveButtonLabels}
      getAriaLabel={getAriaLabel ?? (() => context.saveAriaLabel)}
    />
  );
}

function KeepItemCardRemove({ children, disabled, onClick, ...props }: KeepItemCardRemoveProps) {
  const context = useKeepItemCardCompound("Remove");
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      data-keep-action="remove-item"
      disabled={disabled ?? context.isMutating}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) void context.remove();
      }}
    >
      {children ?? context.removeLabel}
    </button>
  );
}

function KeepItemCardPin({ children, ...props }: KeepItemCardActionSlotProps) {
  const context = useKeepItemCardCompound("Pin");
  return (
    <KeepPinButton<unknown> {...props} item={context.item}>
      {children}
    </KeepPinButton>
  );
}

function KeepItemCardArchive({
  children,
  ...props
}: Omit<KeepArchiveButtonProps<unknown>, "item" | "children"> & { children?: ReactNode }) {
  const context = useKeepItemCardCompound("Archive");
  return (
    <KeepArchiveButton<unknown> {...props} item={context.item}>
      {children}
    </KeepArchiveButton>
  );
}

function KeepItemCardCollectionBadge({ children, ...props }: KeepItemCardBadgeProps) {
  const context = useKeepItemCardCompound("CollectionBadge");
  if (!context.item.collectionId) return null;
  return (
    <span {...props} data-keep-card-part="collection-badge">
      {children ?? context.collectionLabel}
    </span>
  );
}

export const KeepItemCard = Object.assign(KeepItemCardRoot, {
  Media: KeepItemCardMedia,
  Content: KeepItemCardContent,
  Title: KeepItemCardTitle,
  Tags: KeepItemCardTags,
  Actions: KeepItemCardActions,
  Save: KeepItemCardSave,
  Remove: KeepItemCardRemove,
  Pin: KeepItemCardPin,
  Archive: KeepItemCardArchive,
  CollectionBadge: KeepItemCardCollectionBadge,
});

/** A non-interactive placeholder that preserves the selected card layout while data loads. */
export function KeepItemCardSkeleton({ layout = "list", ...props }: KeepItemCardSkeletonProps) {
  return (
    <article {...props} aria-hidden="true" data-keepkit="card-skeleton" data-layout={layout} data-state="loading">
      <span data-skeleton-part="media" />
      <span data-skeleton-part="title" />
      <span data-skeleton-part="meta" />
      <span data-skeleton-part="tag" />
      <span data-skeleton-part="tag" />
    </article>
  );
}

function formatSavedAt(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
