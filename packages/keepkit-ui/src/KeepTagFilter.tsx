"use client";

import type { KeepListQuery } from "@keepkit/core/core";
import { type HTMLAttributes, isValidElement, type ReactNode } from "react";
import { useKeepTagFilter } from "./hooks/useKeepTagFilter";
import { type RenderProp, renderRoot } from "./shared";

export type KeepTagFilterState = {
  tags: string[];
  tagCounts: Record<string, number>;
  value?: string;
  select: (tag?: string) => void;
};

export type KeepTagFilterProps<TMeta = Record<string, unknown>> = Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "onChange"
> & {
  query?: KeepListQuery<TMeta>;
  value?: string;
  defaultValue?: string;
  onChange?: (tag?: string) => void;
  onValueChange?: (tag?: string) => void;
  allLabel?: ReactNode;
  ariaLabel?: string;
  renderTag?: (tag: string, count: number, selected: boolean) => ReactNode;
  render?: RenderProp<KeepTagFilterState>;
  children?: ReactNode | RenderProp<KeepTagFilterState>;
  asChild?: boolean;
};

/** An ARIA button group for tag filtering; consumers can connect value to a collection query. */
export function KeepTagFilter<TMeta = Record<string, unknown>>({
  query,
  value: controlledValue,
  defaultValue,
  onChange,
  onValueChange,
  allLabel,
  ariaLabel,
  renderTag,
  render,
  children,
  asChild = false,
  className,
  ...rootProps
}: KeepTagFilterProps<TMeta>) {
  const view = useKeepTagFilter<TMeta>({ query, controlledValue, defaultValue, onChange, onValueChange });
  const contentChildren = asChild && isValidElement(children) ? undefined : children;
  const body = render
    ? render(view.state)
    : typeof contentChildren === "function"
      ? contentChildren(view.state)
      : (contentChildren ?? (
          <fieldset>
            <legend>{ariaLabel ?? view.labels.aria}</legend>
            <button
              type="button"
              data-keep-action="filter-all-tags"
              aria-pressed={view.state.value === undefined}
              onClick={() => view.state.select()}
            >
              {allLabel ?? view.labels.all}
            </button>
            {view.state.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                data-keep-action="filter-tag"
                aria-pressed={view.state.value === tag}
                onClick={() => view.state.select(tag)}
              >
                {renderTag ? renderTag(tag, view.state.tagCounts[tag] ?? 0, view.state.value === tag) : tag}
                <span> ({view.state.tagCounts[tag] ?? 0})</span>
              </button>
            ))}
          </fieldset>
        ));
  return renderRoot(
    asChild,
    isValidElement(children) ? children : undefined,
    {
      ...rootProps,
      className,
      "data-keepkit": "tag-filter",
      "data-state": view.state.value === undefined ? "all" : "filtered",
      "data-loading": view.isLoading ? "true" : undefined,
    },
    body,
    "KeepTagFilter",
  );
}
