import type { KeepListQuery } from "@keepkit/core/core";
import { useKeepList } from "@keepkit/core/react";
import { useCallback, useMemo, useState } from "react";
import type { KeepTagFilterState } from "../KeepTagFilter";
import { useUiLabel } from "../ui-context";

type KeepTagFilterOptions<TMeta> = {
  query: KeepListQuery<TMeta> | undefined;
  controlledValue: string | undefined;
  defaultValue: string | undefined;
  onChange: ((tag?: string) => void) | undefined;
  onValueChange: ((tag?: string) => void) | undefined;
};

export function useKeepTagFilter<TMeta>(options: KeepTagFilterOptions<TMeta>) {
  const { query, controlledValue, defaultValue, onChange, onValueChange } = options;
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

  return {
    state,
    isLoading: list.isLoading,
    labels: { all: useUiLabel("allTags"), aria: useUiLabel("filterTags") },
  };
}
