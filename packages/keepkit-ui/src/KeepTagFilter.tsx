"use client";

import type { KeepListQuery } from "@keepkit/core/core";
import { useKeepList } from "@keepkit/core/react";
import { type HTMLAttributes, isValidElement, type ReactNode, useCallback, useMemo, useState } from "react";
import { type RenderProp, renderRoot } from "./shared";
import { useUiLabel } from "./ui-context";

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
  const uiAllLabel = useUiLabel("allTags");
  const uiAriaLabel = useUiLabel("filterTags");
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const resolvedValue = controlledValue ?? uncontrolledValue;
  const list = useKeepList<TMeta>({
    ...query,
    tags: resolvedValue ? [...(query?.tags ?? []), resolvedValue] : query?.tags,
  });
  const select = useCallback(
    (tag?: string) => {
      if (controlledValue === undefined) setUncontrolledValue(tag);
      onChange?.(tag);
      onValueChange?.(tag);
    },
    [controlledValue, onChange, onValueChange],
  );
  const state = useMemo<KeepTagFilterState>(
    () => ({ tags: list.tags, tagCounts: list.tagCounts, value: resolvedValue, select }),
    [list.tagCounts, list.tags, resolvedValue, select],
  );
  const contentChildren = asChild && isValidElement(children) ? undefined : children;
  const body = render
    ? render(state)
    : typeof contentChildren === "function"
      ? contentChildren(state)
      : (contentChildren ?? (
          <fieldset>
            <legend>{ariaLabel ?? uiAriaLabel}</legend>
            <button type="button" aria-pressed={resolvedValue === undefined} onClick={() => select()}>
              {allLabel ?? uiAllLabel}
            </button>
            {list.tags.map((tag) => (
              <button key={tag} type="button" aria-pressed={resolvedValue === tag} onClick={() => select(tag)}>
                {renderTag ? renderTag(tag, list.tagCounts[tag] ?? 0, resolvedValue === tag) : tag}
                <span> ({list.tagCounts[tag] ?? 0})</span>
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
      "data-state": resolvedValue === undefined ? "all" : "filtered",
      "data-loading": list.isLoading ? "true" : undefined,
    },
    body,
    "KeepTagFilter",
  );
}
