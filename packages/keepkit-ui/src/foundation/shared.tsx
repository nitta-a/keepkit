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
  type Ref,
  type RefCallback,
  useContext,
  useMemo,
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
  const normalizedQuery = resolvedQuery?.trim() ?? "";
  return useMemo(() => {
    if (typeof children !== "string" || !normalizedQuery) return children ?? null;
    return highlightText(children, normalizedQuery);
  }, [children, normalizedQuery]);
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

type MergeableProps = Record<string, unknown>;

/** Combines callback and object refs while preserving every ref target. */
export function composeRefs<T>(...refs: Array<Ref<T> | null | undefined>): RefCallback<T> {
  return (value) => {
    for (const ref of refs) {
      if (typeof ref === "function") {
        ref(value);
      } else if (ref !== null && ref !== undefined) {
        ref.current = value;
      }
    }
  };
}

/** Chains child and component event handlers while preserving both handlers' event order. */
export function chainedFunction<T extends (...args: never[]) => unknown>(
  childHandler: T | undefined,
  parentHandler: T | undefined,
): T | undefined {
  if (!childHandler) return parentHandler;
  if (!parentHandler) return childHandler;
  return ((...args: never[]) => {
    childHandler(...args);
    parentHandler(...args);
  }) as T;
}

/** Merges slot props without dropping child classes, styles, ARIA attributes, or events. */
export function mergeProps<T extends MergeableProps>(childProps: T, parentProps: Partial<T> & MergeableProps): T {
  const merged: MergeableProps = { ...parentProps, ...childProps };
  if ("ref" in childProps || "ref" in parentProps) {
    merged.ref = composeRefs(
      childProps.ref as Ref<never> | null | undefined,
      parentProps.ref as Ref<never> | null | undefined,
    );
  }
  const className = mergeClassNames(childProps.className, parentProps.className);
  if (className) merged.className = className;
  const style = mergeStyles(childProps.style, parentProps.style);
  if (style) merged.style = style;

  for (const key of Object.keys(parentProps)) {
    if (!isEventProp(key)) continue;
    const chained = chainedFunction(getHandler(childProps[key]), getHandler(parentProps[key]));
    if (chained) merged[key] = chained;
  }

  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined && key.startsWith("aria-") && childProps[key] !== undefined) {
      merged[key] = childProps[key];
    }
  }
  return merged as T;
}

function getHandler(value: unknown): ((...args: never[]) => unknown) | undefined {
  return typeof value === "function" ? (value as (...args: never[]) => unknown) : undefined;
}

function isEventProp(key: string): boolean {
  return key.startsWith("on") && key.length > 2 && key[2] === key[2]?.toUpperCase();
}

function mergeClassNames(childClassName: unknown, parentClassName: unknown): string | undefined {
  const values = [childClassName, parentClassName].filter(
    (value): value is string => typeof value === "string" && Boolean(value),
  );
  return values.length > 0 ? values.join(" ") : undefined;
}

function mergeStyles(childStyle: unknown, parentStyle: unknown): Record<string, unknown> | undefined {
  if (!childStyle && !parentStyle) return undefined;
  return {
    ...(isObject(childStyle) ? childStyle : {}),
    ...(isObject(parentStyle) ? parentStyle : {}),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function createSlot(
  child: ReactElement<MergeableProps>,
  props: MergeableProps,
  body?: ReactNode,
): ReactElement<MergeableProps> {
  const nextProps = body === undefined ? props : { ...props, children: body };
  return cloneElement(child, mergeProps(child.props, nextProps));
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
    return createSlot(child as ReactElement<MergeableProps>, props, body);
  }
  return <div {...props}>{body}</div>;
}
