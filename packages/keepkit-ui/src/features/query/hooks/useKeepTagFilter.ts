import type { KeepListQuery } from "@keepkit/core/core";
import { useKeepList } from "@keepkit/core/react";
import { useCallback, useMemo, useState } from "react";
import { normalizeUiTags } from "../../../foundation/shared";
import { useUiLabel } from "../../../foundation/ui-context";
import type { KeepTagFilterState } from "../KeepTagFilter";

type KeepTagFilterOptions<TMeta> = {
  query: KeepListQuery<TMeta> | undefined;
  controlledValue: string | undefined;
  defaultValue: string | undefined;
  controlledValues: readonly string[] | undefined;
  defaultValues: readonly string[] | undefined;
  onChange: ((tag?: string) => void) | undefined;
  onValueChange: ((tag?: string) => void) | undefined;
  onValuesChange: ((tags: string[]) => void) | undefined;
};

export function useKeepTagFilter<TMeta>(options: KeepTagFilterOptions<TMeta>) {
  const {
    query,
    controlledValue,
    defaultValue,
    controlledValues,
    defaultValues,
    onChange,
    onValueChange,
    onValuesChange,
  } = options;
  const [uncontrolledValues, setUncontrolledValues] = useState<string[]>(() =>
    defaultValues ? normalizeUiTags(defaultValues) : defaultValue ? [defaultValue] : [],
  );
  const resolvedValues = useMemo(
    () =>
      controlledValues !== undefined
        ? normalizeUiTags(controlledValues)
        : controlledValue !== undefined
          ? [controlledValue]
          : uncontrolledValues,
    [controlledValue, controlledValues, uncontrolledValues],
  );
  const resolvedValue = resolvedValues[0];
  const list = useKeepList<TMeta>({
    ...query,
    tags: resolvedValues.length > 0 ? normalizeUiTags([...(query?.tags ?? []), ...resolvedValues]) : query?.tags,
  });
  const applyValues = useCallback(
    (next: string[]) => {
      const normalized = normalizeUiTags(next);
      if (controlledValues === undefined && controlledValue === undefined) setUncontrolledValues(normalized);
      const first = normalized[0];
      onChange?.(first);
      onValueChange?.(first);
      onValuesChange?.(normalized);
    },
    [controlledValue, controlledValues, onChange, onValueChange, onValuesChange],
  );
  const select = useCallback(
    (tag?: string) => {
      applyValues(tag ? [tag] : []);
    },
    [applyValues],
  );
  const toggle = useCallback(
    (tag: string) => {
      applyValues(
        resolvedValues.includes(tag) ? resolvedValues.filter((current) => current !== tag) : [...resolvedValues, tag],
      );
    },
    [applyValues, resolvedValues],
  );
  const state = useMemo<KeepTagFilterState>(
    () => ({
      tags: list.tags,
      tagCounts: list.tagCounts,
      value: resolvedValue,
      values: resolvedValues,
      select,
      toggle,
    }),
    [list.tagCounts, list.tags, resolvedValue, resolvedValues, select, toggle],
  );

  return {
    state,
    isLoading: list.isLoading,
    labels: { all: useUiLabel("allTags"), aria: useUiLabel("filterTags") },
  };
}
