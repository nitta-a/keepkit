"use client";

import type { KeepItem, KeepItemInput, KeepListQuery } from "@keepkit/core/core";
import {
  type ComponentType,
  cloneElement,
  createContext,
  type HTMLAttributes,
  type ImgHTMLAttributes,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useContext,
} from "react";

export type RenderProp<TState> = (state: TState) => ReactNode;

const KeepSearchQueryContext = createContext<string | undefined>(undefined);

type KeepSearchQueryProviderProps = {
  query: string | undefined;
  children: ReactNode;
};

export function KeepSearchQueryProvider({ query, children }: KeepSearchQueryProviderProps) {
  return <KeepSearchQueryContext.Provider value={query}>{children}</KeepSearchQueryContext.Provider>;
}

export function useKeepSearchQuery(): string | undefined {
  return useContext(KeepSearchQueryContext);
}

export type KeepHighlightProps = {
  children?: ReactNode;
  query?: string;
};

/** Wraps case-insensitive, literal query matches in a style-free mark element. */
export function KeepHighlight({ children, query }: KeepHighlightProps): ReactNode {
  const contextQuery = useKeepSearchQuery();
  const resolvedQuery = query ?? contextQuery;
  if (typeof children !== "string" || !resolvedQuery?.trim()) return children ?? null;

  return highlightText(children, resolvedQuery);
}

export function highlightText(text: string, query: string): ReactNode {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return text;
  const matcher = new RegExp(escapeRegExp(normalizedQuery), "gi");
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let matchIndex = 0;

  while (true) {
    const match = matcher.exec(text);
    if (match === null) break;
    const index = match.index;
    if (index > lastIndex) parts.push(text.slice(lastIndex, index));
    parts.push(
      <mark key={`highlight-${matchIndex}`} className="keep-highlight" data-highlight="true">
        {match[0]}
      </mark>,
    );
    lastIndex = index + match[0].length;
    matchIndex += 1;
  }
  if (lastIndex === 0) return text;
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
