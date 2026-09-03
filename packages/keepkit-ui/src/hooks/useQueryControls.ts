import type { KeepListQuery } from "@keepkit/core/core";
import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import type { KeepSortValue } from "../query-controls";
import { useUiLabel } from "../ui-context";

type KeepSearchInputOptions = {
  controlledValue: string | undefined;
  defaultValue: string;
  debounceMs: number;
  onValueChange: ((value: string) => void) | undefined;
};

export function useKeepSearchInput(options: KeepSearchInputOptions) {
  const { controlledValue, defaultValue, debounceMs, onValueChange } = options;
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const value = controlledValue ?? uncontrolledValue;
  useEffect(() => {
    if (!onValueChange) return;
    if (debounceMs <= 0) {
      onValueChange(value);
      return;
    }
    const timer = window.setTimeout(() => onValueChange(value), debounceMs);
    return () => window.clearTimeout(timer);
  }, [debounceMs, onValueChange, value]);

  return {
    value,
    label: useUiLabel("search"),
    change: (event: ChangeEvent<HTMLInputElement>) => {
      if (controlledValue === undefined) setUncontrolledValue(event.currentTarget.value);
    },
  };
}

type KeepSortSelectOptions = {
  controlledValue: KeepSortValue | undefined;
  defaultValue: KeepSortValue;
  onValueChange: ((value: KeepSortValue, sort: NonNullable<KeepListQuery["sort"]>) => void) | undefined;
};

export function useKeepSortSelect(options: KeepSortSelectOptions) {
  const { controlledValue, defaultValue, onValueChange } = options;
  const [uncontrolledValue, setUncontrolledValue] = useState<KeepSortValue>(defaultValue);
  const value = controlledValue ?? uncontrolledValue;

  return {
    value,
    change: (event: ChangeEvent<HTMLSelectElement>) => {
      const nextValue = event.currentTarget.value as KeepSortValue;
      if (controlledValue === undefined) setUncontrolledValue(nextValue);
      const [by, direction] = nextValue.split(":") as ["savedAt" | "updatedAt", "asc" | "desc"];
      onValueChange?.(nextValue, { by, direction });
    },
    labels: {
      sort: useUiLabel("sort"),
      updatedNewest: useUiLabel("updatedNewest"),
      updatedOldest: useUiLabel("updatedOldest"),
      savedNewest: useUiLabel("savedNewest"),
      savedOldest: useUiLabel("savedOldest"),
    },
  };
}

type KeepPaginationOptions = {
  totalCount: number;
  pageSize: number;
  page: number;
  maxPageButtons: number;
  onPageChange: ((page: number, offset: number) => void) | undefined;
};

export function useKeepPagination(options: KeepPaginationOptions) {
  const { totalCount, pageSize, page, maxPageButtons, onPageChange } = options;
  const pageCount = Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize)));
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const goToPage = (nextPage: number) => {
    const next = Math.min(Math.max(1, nextPage), pageCount);
    onPageChange?.(next, (next - 1) * pageSize);
  };

  return {
    pageCount,
    currentPage,
    goToPage,
    visiblePages: getVisiblePages(currentPage, pageCount, Math.max(1, maxPageButtons)),
    labels: {
      previous: useUiLabel("previousPage"),
      next: useUiLabel("nextPage"),
      page: useUiLabel("page"),
      pagination: useUiLabel("pagination"),
    },
  };
}

function getVisiblePages(currentPage: number, pageCount: number, maxPageButtons: number): number[] {
  if (pageCount <= maxPageButtons) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const half = Math.floor(maxPageButtons / 2);
  const start = Math.min(Math.max(1, currentPage - half), pageCount - maxPageButtons + 1);
  return Array.from({ length: maxPageButtons }, (_, index) => start + index);
}
