"use client";

import type { KeepListQuery } from "@keepkit/core/core";
import { type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, useEffect, useState } from "react";
import { useUiLabel } from "./ui-context";

export type KeepSearchInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange"
> & {
  value?: string;
  defaultValue?: string;
  /** Delay before notifying consumers; set to 0 to disable debouncing. */
  debounceMs?: number;
  onValueChange?: (value: string) => void;
};

/** A controlled/uncontrolled search field with a small built-in debounce. */
export function KeepSearchInput({
  value: controlledValue,
  defaultValue = "",
  debounceMs = 300,
  onValueChange,
  "aria-label": ariaLabel,
  placeholder,
  ...props
}: KeepSearchInputProps) {
  const label = useUiLabel("search");
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

  return (
    <input
      {...props}
      data-keepkit="search-input"
      type="search"
      value={value}
      data-state={value ? "active" : "idle"}
      data-disabled={props.disabled ? "true" : undefined}
      aria-label={ariaLabel ?? label}
      placeholder={placeholder ?? label}
      onChange={(event) => {
        const nextValue = event.currentTarget.value;
        if (controlledValue === undefined) setUncontrolledValue(nextValue);
      }}
    />
  );
}

export type KeepSortValue = "savedAt:desc" | "savedAt:asc" | "updatedAt:desc" | "updatedAt:asc";

export type KeepSortSelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "value" | "defaultValue" | "onChange"
> & {
  value?: KeepSortValue;
  defaultValue?: KeepSortValue;
  onValueChange?: (value: KeepSortValue, sort: NonNullable<KeepListQuery["sort"]>) => void;
};

/** Emits a normalized sort descriptor that can be passed directly to useKeepList. */
export function KeepSortSelect({
  value: controlledValue,
  defaultValue = "updatedAt:desc",
  onValueChange,
  "aria-label": ariaLabel,
  children,
  ...props
}: KeepSortSelectProps) {
  const label = useUiLabel("sort");
  const updatedNewestLabel = useUiLabel("updatedNewest");
  const updatedOldestLabel = useUiLabel("updatedOldest");
  const savedNewestLabel = useUiLabel("savedNewest");
  const savedOldestLabel = useUiLabel("savedOldest");
  const [uncontrolledValue, setUncontrolledValue] = useState<KeepSortValue>(defaultValue);
  const value = controlledValue ?? uncontrolledValue;
  const options = children ?? (
    <>
      <option value="updatedAt:desc">{updatedNewestLabel}</option>
      <option value="updatedAt:asc">{updatedOldestLabel}</option>
      <option value="savedAt:desc">{savedNewestLabel}</option>
      <option value="savedAt:asc">{savedOldestLabel}</option>
    </>
  );
  return (
    <select
      {...props}
      data-keepkit="sort-select"
      value={value}
      data-state="selected"
      data-disabled={props.disabled ? "true" : undefined}
      aria-label={ariaLabel ?? label}
      onChange={(event) => {
        const nextValue = event.currentTarget.value as KeepSortValue;
        if (controlledValue === undefined) setUncontrolledValue(nextValue);
        const [by, direction] = nextValue.split(":") as ["savedAt" | "updatedAt", "asc" | "desc"];
        onValueChange?.(nextValue, { by, direction });
      }}
    >
      {options}
    </select>
  );
}

export type KeepPaginationState = { page: number; pageCount: number; goToPage: (page: number) => void };

export type KeepPaginationProps = Omit<React.HTMLAttributes<HTMLElement>, "children"> & {
  totalCount: number;
  pageSize: number;
  page?: number;
  maxPageButtons?: number;
  onPageChange?: (page: number, offset: number) => void;
  render?: (state: KeepPaginationState) => ReactNode;
};

/** Accessible pagination with previous/next controls and numbered page buttons. */
export function KeepPagination({
  totalCount,
  pageSize,
  page = 1,
  maxPageButtons = 7,
  onPageChange,
  render,
  ...props
}: KeepPaginationProps) {
  const previousPageLabel = useUiLabel("previousPage");
  const nextPageLabel = useUiLabel("nextPage");
  const pageLabel = useUiLabel("page");
  const paginationLabel = useUiLabel("pagination");
  const pageCount = Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize)));
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const goToPage = (nextPage: number) => {
    const next = Math.min(Math.max(1, nextPage), pageCount);
    onPageChange?.(next, (next - 1) * pageSize);
  };
  const navProps = {
    ...props,
    "data-keepkit": "pagination",
    "aria-label": props["aria-label"] ?? paginationLabel,
    "data-state": pageCount > 1 ? "active" : "idle",
  };
  if (render) return <nav {...navProps}>{render({ page: currentPage, pageCount, goToPage })}</nav>;
  const visiblePages = getVisiblePages(currentPage, pageCount, Math.max(1, maxPageButtons));
  return (
    <nav {...navProps}>
      <button type="button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>
        {previousPageLabel}
      </button>
      {visiblePages.map((nextPage) => (
        <button
          key={nextPage}
          type="button"
          aria-current={nextPage === currentPage ? "page" : undefined}
          aria-label={`${pageLabel} ${nextPage}`}
          onClick={() => goToPage(nextPage)}
        >
          {nextPage}
        </button>
      ))}
      <button type="button" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= pageCount}>
        {nextPageLabel}
      </button>
    </nav>
  );
}

function getVisiblePages(currentPage: number, pageCount: number, maxPageButtons: number): number[] {
  if (pageCount <= maxPageButtons) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const half = Math.floor(maxPageButtons / 2);
  const start = Math.min(Math.max(1, currentPage - half), pageCount - maxPageButtons + 1);
  return Array.from({ length: maxPageButtons }, (_, index) => start + index);
}
