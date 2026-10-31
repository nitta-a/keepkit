"use client";

import type { KeepListQuery } from "@keepkit/core/core";
import { type HTMLAttributes, isValidElement, type ReactNode } from "react";
import { type RenderProp, renderRoot } from "../../foundation/shared";
import { useUiLabelVisibility } from "../../foundation/ui-context";
import { useKeepTagFilter } from "./hooks/useKeepTagFilter";

export type KeepTagFilterState = {
  tags: string[];
  tagCounts: Record<string, number>;
  value?: string;
  values: string[];
  select: (tag?: string) => void;
  toggle: (tag: string) => void;
};

export type KeepTagFilterProps<TMeta = Record<string, unknown>> = Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "onChange"
> & {
  query?: KeepListQuery<TMeta>;
  value?: string;
  defaultValue?: string;
  values?: readonly string[];
  defaultValues?: readonly string[];
  onChange?: (tag?: string) => void;
  onValueChange?: (tag?: string) => void;
  onValuesChange?: (tags: string[]) => void;
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
  values: controlledValues,
  defaultValues,
  onChange,
  onValueChange,
  onValuesChange,
  allLabel,
  ariaLabel,
  renderTag,
  render,
  children,
  asChild = false,
  className,
  ...rootProps
}: KeepTagFilterProps<TMeta>) {
  const view = useKeepTagFilter<TMeta>({
    query,
    controlledValue,
    defaultValue,
    controlledValues,
    defaultValues,
    onChange,
    onValueChange,
    onValuesChange,
  });
  const showFilterLabel = useUiLabelVisibility("filterTags");
  const showAllTagsLabel = useUiLabelVisibility("allTags");
  const isMulti = controlledValues !== undefined || defaultValues !== undefined || onValuesChange !== undefined;
  const contentChildren = asChild && isValidElement(children) ? undefined : children;
  const body = render
    ? render(view.state)
    : typeof contentChildren === "function"
      ? contentChildren(view.state)
      : (contentChildren ?? (
          <fieldset aria-label={showFilterLabel ? undefined : (ariaLabel ?? view.labels.aria)}>
            {showFilterLabel ? <legend>{ariaLabel ?? view.labels.aria}</legend> : null}
            <button
              type="button"
              data-keep-action="filter-all-tags"
              aria-pressed={view.state.values.length === 0}
              aria-label={showAllTagsLabel ? undefined : view.labels.all}
              onClick={() => view.state.select()}
            >
              {showAllTagsLabel ? (allLabel ?? view.labels.all) : null}
            </button>
            {view.state.tags.map((tag) => {
              const selected = view.state.values.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  data-keep-action="filter-tag"
                  aria-pressed={selected}
                  onClick={() => (isMulti ? view.state.toggle(tag) : view.state.select(tag))}
                >
                  {renderTag ? renderTag(tag, view.state.tagCounts[tag] ?? 0, selected) : tag}
                  <span> ({view.state.tagCounts[tag] ?? 0})</span>
                </button>
              );
            })}
          </fieldset>
        ));
  return renderRoot(
    asChild,
    isValidElement(children) ? children : undefined,
    {
      ...rootProps,
      className,
      "data-keepkit": "tag-filter",
      "data-state": view.state.values.length === 0 ? "all" : "filtered",
      "data-loading": view.isLoading ? "true" : undefined,
    },
    body,
    "KeepTagFilter",
  );
}
