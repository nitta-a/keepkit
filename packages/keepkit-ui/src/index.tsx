"use client";

import type { KeepItem, KeepItemInput, KeepListQuery } from "@keepkit/core/core";
import {
  type CreateKeepKitOptions as CoreCreateKeepKitOptions,
  KeepProvider as CoreKeepProvider,
  createKeepKit as createCoreKeepKit,
  type KeepProviderProps,
  type KeepShortcutOptions,
  type useKeepContext,
  type useKeepItem,
  type useKeepList,
} from "@keepkit/core/react";
import type { ComponentType, ReactNode } from "react";
import { KeepBulkActions, type KeepBulkActionsProps, type KeepBulkActionsState } from "./KeepBulkActions";
import { KeepButton, type KeepButtonLabels, type KeepButtonProps } from "./KeepButton";
import { KeepCollection, type KeepCollectionFeature, type KeepCollectionProps } from "./KeepCollection";
import { type KeepImageProps, KeepItemCard, type KeepItemCardProps, type KeepItemCardState } from "./KeepItemCard";
import { KeepItemCheckbox, type KeepItemCheckboxProps } from "./KeepItemCheckbox";
import { KeepList, type KeepListProps, type KeepListState } from "./KeepList";
import { KeepNoteEditor, type KeepNoteEditorProps, type KeepNoteEditorState } from "./KeepNoteEditor";
import { KeepTagEditor, type KeepTagEditorProps, type KeepTagEditorState } from "./KeepTagEditor";
import { KeepTagFilter, type KeepTagFilterProps, type KeepTagFilterState } from "./KeepTagFilter";
import {
  KeepPagination,
  type KeepPaginationProps,
  type KeepPaginationState,
  KeepSearchInput,
  type KeepSearchInputProps,
  KeepSortSelect,
  type KeepSortSelectProps,
  type KeepSortValue,
} from "./query-controls";
import {
  KeepAnnouncements,
  type KeepAnnouncementsProps,
  KeepAnnouncer,
  KeepEmptyState,
  type KeepEmptyStateProps,
  KeepStatus,
  type KeepStatusLabels,
  type KeepStatusProps,
  type KeepStatusState,
  type KeepStatusValue,
} from "./status";
import {
  type KeepUiLabelContext,
  type KeepUiLabelKey,
  type KeepUiLabels,
  KeepUiProvider,
  type KeepUiProviderProps,
  useKeepUiLabels,
} from "./ui-context";

export type KeepKitProviderProps<TMeta = Record<string, unknown>> = Omit<KeepProviderProps<TMeta>, "children"> &
  Omit<KeepUiProviderProps, "children"> & { children?: ReactNode };

/** Combines the core store, UI labels, and the global live announcer. */
export function KeepKitProvider<TMeta = Record<string, unknown>>({
  labels,
  locale,
  labelResolver,
  children,
  ...providerProps
}: KeepKitProviderProps<TMeta>) {
  return (
    <KeepUiProvider labels={labels} locale={locale} labelResolver={labelResolver}>
      <CoreKeepProvider<TMeta> {...providerProps}>
        {children}
        <KeepAnnouncements />
      </CoreKeepProvider>
    </KeepUiProvider>
  );
}

export type { KeepItem, KeepItemInput, KeepListQuery, KeepSyncStatus } from "@keepkit/core/core";
export type { KeepButtonState, KeepContextValue, KeepProviderProps, KeepShortcutOptions } from "@keepkit/core/react";
export { KeepProvider, useKeepContext, useKeepItem, useKeepList, useKeepShortcut } from "@keepkit/core/react";
export {
  createBrowserStorageAdapter,
  createStorageAdapter,
  FallbackStorageAdapter,
  IndexedDBAdapter,
  IndexedDBSyncQueueAdapter,
  LocalStorageAdapter,
  LocalStorageSyncQueueAdapter,
  SyncStorageAdapter,
} from "@keepkit/core/storage";
export type { RenderProp } from "./shared";
export type {
  KeepAnnouncementsProps,
  KeepBulkActionsProps,
  KeepBulkActionsState,
  KeepButtonLabels,
  KeepButtonProps,
  KeepCollectionFeature,
  KeepCollectionProps,
  KeepEmptyStateProps,
  KeepImageProps,
  KeepItemCardProps,
  KeepItemCardState,
  KeepItemCheckboxProps,
  KeepListProps,
  KeepListState,
  KeepNoteEditorProps,
  KeepNoteEditorState,
  KeepPaginationProps,
  KeepPaginationState,
  KeepSearchInputProps,
  KeepSortSelectProps,
  KeepSortValue,
  KeepStatusLabels,
  KeepStatusProps,
  KeepStatusState,
  KeepStatusValue,
  KeepTagEditorProps,
  KeepTagEditorState,
  KeepTagFilterProps,
  KeepTagFilterState,
  KeepUiLabelContext,
  KeepUiLabelKey,
  KeepUiLabels,
  KeepUiProviderProps,
};
export {
  KeepAnnouncements,
  KeepAnnouncer,
  KeepBulkActions,
  KeepButton,
  KeepCollection,
  KeepEmptyState,
  KeepItemCard,
  KeepItemCheckbox,
  KeepList,
  KeepNoteEditor,
  KeepPagination,
  KeepSearchInput,
  KeepSortSelect,
  KeepStatus,
  KeepTagEditor,
  KeepTagFilter,
  KeepUiProvider,
  useKeepUiLabels,
};

export type CreateKeepKitOptions<TMeta = Record<string, unknown>> = CoreCreateKeepKitOptions<TMeta> &
  Omit<KeepUiProviderProps, "children"> & {
    getTitle?: (item: KeepItem<TMeta>) => ReactNode;
    getImageProps?: (item: KeepItem<TMeta>, title: ReactNode) => KeepImageProps | undefined;
  };

export type KeepKit<TMeta = Record<string, unknown>> = {
  Provider: ComponentType<KeepKitProviderProps<TMeta>>;
  Button: ComponentType<KeepButtonProps<TMeta>>;
  Collection: ComponentType<KeepCollectionProps<TMeta>>;
  useContext: () => ReturnType<typeof useKeepContext<TMeta>>;
  useItem: (item?: KeepItemInput<TMeta>) => ReturnType<typeof useKeepItem<TMeta>>;
  useList: (query?: KeepListQuery<TMeta>) => ReturnType<typeof useKeepList<TMeta>>;
  useShortcut: (options: KeepShortcutOptions<TMeta>) => void;
};

/** Create one typed application API for the core and standard UI layer. */
export function createKeepKit<TMeta = Record<string, unknown>>(
  options: CreateKeepKitOptions<TMeta> = {},
): KeepKit<TMeta> {
  const { labels, locale, labelResolver, getTitle, getImageProps, ...coreOptions } = options;
  const coreKit = createCoreKeepKit<TMeta>(coreOptions);
  return {
    Provider: (props) => (
      <KeepKitProvider<TMeta>
        {...coreOptions}
        labels={labels}
        locale={locale}
        labelResolver={labelResolver}
        {...props}
      />
    ),
    Button: (props) => <KeepButton<TMeta> {...props} />,
    Collection: (props) => (
      <KeepCollection<TMeta>
        {...props}
        itemCardProps={{
          ...(getTitle ? { getTitle } : {}),
          ...(getImageProps ? { getImageProps } : {}),
          ...props.itemCardProps,
        }}
      />
    ),
    useContext: () => coreKit.useContext(),
    useItem: (item) => coreKit.useItem(item),
    useList: (query) => coreKit.useList(query),
    useShortcut: (shortcutOptions) => coreKit.useShortcut(shortcutOptions),
  };
}
