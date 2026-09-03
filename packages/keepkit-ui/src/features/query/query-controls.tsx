"use client";

import type { KeepListQuery } from "@keepkit/core/core";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { useKeepPagination, useKeepSearchInput, useKeepSortSelect } from "./hooks/useQueryControls";

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
  const view = useKeepSearchInput({ controlledValue, defaultValue, debounceMs, onValueChange });

  return (
    <input
      {...props}
      data-keepkit="search-input"
      data-keep-action="search"
      type="search"
      value={view.value}
      data-state={view.value ? "active" : "idle"}
      data-disabled={props.disabled ? "true" : undefined}
      aria-label={ariaLabel ?? view.label}
      placeholder={placeholder ?? view.label}
      onChange={view.change}
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
  const view = useKeepSortSelect({ controlledValue, defaultValue, onValueChange });
  const options = children ?? (
    <>
      <option value="updatedAt:desc">{view.labels.updatedNewest}</option>
      <option value="updatedAt:asc">{view.labels.updatedOldest}</option>
      <option value="savedAt:desc">{view.labels.savedNewest}</option>
      <option value="savedAt:asc">{view.labels.savedOldest}</option>
    </>
  );
  return (
    <select
      {...props}
      data-keepkit="sort-select"
      data-keep-action="sort"
      value={view.value}
      data-state="selected"
      data-disabled={props.disabled ? "true" : undefined}
      aria-label={ariaLabel ?? view.labels.sort}
      onChange={view.change}
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
  const view = useKeepPagination({ totalCount, pageSize, page, maxPageButtons, onPageChange });
  const navProps = {
    ...props,
    "data-keepkit": "pagination",
    "aria-label": props["aria-label"] ?? view.labels.pagination,
    "data-state": view.pageCount > 1 ? "active" : "idle",
  };
  if (render)
    return (
      <nav {...navProps}>{render({ page: view.currentPage, pageCount: view.pageCount, goToPage: view.goToPage })}</nav>
    );
  return (
    <nav {...navProps}>
      <button
        type="button"
        data-keep-action="previous-page"
        onClick={() => view.goToPage(view.currentPage - 1)}
        disabled={view.currentPage <= 1}
      >
        {view.labels.previous}
      </button>
      {view.visiblePages.map((nextPage) => (
        <button
          key={nextPage}
          type="button"
          data-keep-action="select-page"
          aria-current={nextPage === view.currentPage ? "page" : undefined}
          aria-label={`${view.labels.page} ${nextPage}`}
          onClick={() => view.goToPage(nextPage)}
        >
          {nextPage}
        </button>
      ))}
      <button
        type="button"
        data-keep-action="next-page"
        onClick={() => view.goToPage(view.currentPage + 1)}
        disabled={view.currentPage >= view.pageCount}
      >
        {view.labels.next}
      </button>
    </nav>
  );
}
