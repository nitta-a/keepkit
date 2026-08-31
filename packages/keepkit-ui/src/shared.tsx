"use client";

import type { KeepItem, KeepItemInput, KeepListQuery } from "@keepkit/core/core";
import {
  type ComponentType,
  cloneElement,
  type HTMLAttributes,
  type ImgHTMLAttributes,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

export type RenderProp<TState> = (state: TState) => ReactNode;

export type KeepButtonLabels = {
  saved?: ReactNode;
  unsaved?: ReactNode;
  loading?: ReactNode;
  error?: ReactNode;
  savedAriaLabel?: string;
  unsavedAriaLabel?: string;
};

export type KeepButtonIconProps = { "aria-hidden"?: boolean; className?: string };
export type KeepButtonIcon = ReactNode | ComponentType<KeepButtonIconProps>;
export type KeepButtonIcons = {
  save?: KeepButtonIcon;
  saved?: KeepButtonIcon;
  remove?: KeepButtonIcon;
  loading?: KeepButtonIcon;
  error?: KeepButtonIcon;
};

export type KeepImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  alt: string;
};

export function toKeepButtonItem<TMeta>(item: KeepItem<TMeta>): KeepItemInput<TMeta> {
  return {
    id: item.id,
    meta: item.meta,
    targetType: item.targetType,
    note: item.note,
    tags: item.tags,
  };
}

export function getMetaTitle<TMeta>(meta: TMeta): string | undefined {
  if (typeof meta !== "object" || meta === null || !("title" in meta)) return undefined;
  const title = (meta as { title?: unknown }).title;
  return typeof title === "string" && title.trim() ? title.trim() : undefined;
}

export function normalizeUiTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

export function sortToValue(sort: KeepListQuery["sort"]): `${"savedAt" | "updatedAt"}:${"asc" | "desc"}` {
  return `${sort?.by ?? "updatedAt"}:${sort?.direction ?? "desc"}`;
}

export function resolveContent<TState>(content: ReactNode | RenderProp<TState>, state: TState): ReactNode {
  return typeof content === "function" ? content(state) : content;
}

export function renderRoot(
  asChild: boolean,
  child: ReactNode,
  props: HTMLAttributes<HTMLElement> & Record<string, unknown>,
  body: ReactNode,
  componentName: string,
): ReactElement {
  if (asChild) {
    if (!isValidElement(child)) throw new Error(`${componentName} with asChild requires a single React element child.`);
    return cloneElement(child as ReactElement<Record<string, unknown>>, { ...props, children: body });
  }
  return <div {...props}>{body}</div>;
}
