"use client";

import type {
  KeepItem,
  KeepItemInput,
  KeepListQuery,
  KeepScope,
  KeepUndoState,
  KeepUrlSyncOptions,
} from "@keepkit/core/core";
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
import { KeepBackup, type KeepBackupProps } from "./KeepBackup";
import { KeepBulkActions, type KeepBulkActionsProps, type KeepBulkActionsState } from "./KeepBulkActions";
import {
  KeepButton,
  type KeepButtonIcon,
  type KeepButtonIconProps,
  type KeepButtonIcons,
  type KeepButtonLabels,
  type KeepButtonProps,
} from "./KeepButton";
import {
  KeepCollection,
  type KeepCollectionFeature,
  type KeepCollectionProps,
  type KeepLayoutPreset,
} from "./KeepCollection";
import {
  type KeepImageProps,
  KeepItemCard,
  type KeepItemCardLinkProps,
  type KeepItemCardProps,
  type KeepItemCardState,
} from "./KeepItemCard";
import { KeepItemCheckbox, type KeepItemCheckboxProps } from "./KeepItemCheckbox";
import { type KeepDisplayStatus, KeepItemStatusBadge, type KeepItemStatusBadgeProps } from "./KeepItemStatusBadge";
import { KeepLayout, type KeepLayoutProps } from "./KeepLayout";
import { KeepList, type KeepListProps, type KeepListState } from "./KeepList";
import { KeepNoteEditor, type KeepNoteEditorProps, type KeepNoteEditorState } from "./KeepNoteEditor";
import {
  KeepPruneStaleButton,
  type KeepPruneStaleButtonProps,
  KeepStaleNotice,
  type KeepStaleNoticeProps,
} from "./KeepStaleNotice";
import { KeepSyncRecoveryDialog, type KeepSyncRecoveryDialogProps } from "./KeepSyncRecoveryDialog";
import { KeepSyncStatusBanner, type KeepSyncStatusBannerProps } from "./KeepSyncStatusBanner";
import { KeepTagEditor, type KeepTagEditorProps, type KeepTagEditorState } from "./KeepTagEditor";
import { KeepTagFilter, type KeepTagFilterProps, type KeepTagFilterState } from "./KeepTagFilter";
import { KeepUndo, type KeepUndoProps } from "./KeepUndo";
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
  type KeepThemeDensity,
  type KeepThemeMode,
  type KeepThemeName,
  KeepThemeProvider,
  type KeepThemeProviderProps,
  type KeepThemeRadius,
  type KeepThemeVariables,
} from "./theme";
import {
  getKeepLocaleLabels,
  type KeepUiLabelContext,
  type KeepUiLabelKey,
  type KeepUiLabels,
  type KeepUiLocale,
  type KeepUiLocaleLabels,
  KeepUiProvider,
  type KeepUiProviderProps,
  useKeepUiLabels,
} from "./ui-context";
import {
  createNextPagesRouterAdapter,
  type KeepPagesRouterLike,
  type KeepUrlAdapter,
  useKeepUrlSync,
} from "./url-sync";

export type KeepKitProviderProps<TMeta = Record<string, unknown>> = Omit<KeepProviderProps<TMeta>, "children"> &
  Omit<KeepUiProviderProps, "children"> &
  Omit<KeepThemeProviderProps, "children"> & { children?: ReactNode };

/** Combines the core store, UI labels, and the global live announcer. */
export function KeepKitProvider<TMeta = Record<string, unknown>>({
  labels,
  locale,
  labelResolver,
  theme,
  mode,
  density,
  radius,
  accentColor,
  highContrast,
  reducedMotion,
  variables,
  className: themeClassName,
  style: themeStyle,
  asChild: themeAsChild,
  children,
  ...providerProps
}: KeepKitProviderProps<TMeta>) {
  return (
    <KeepUiProvider labels={labels} locale={locale} labelResolver={labelResolver}>
      <KeepThemeProvider
        theme={theme}
        mode={mode}
        density={density}
        radius={radius}
        accentColor={accentColor}
        highContrast={highContrast}
        reducedMotion={reducedMotion}
        variables={variables}
        className={themeClassName}
        style={themeStyle}
        asChild={themeAsChild}
      >
        <CoreKeepProvider<TMeta> {...providerProps}>
          {children}
          <KeepAnnouncements />
        </CoreKeepProvider>
      </KeepThemeProvider>
    </KeepUiProvider>
  );
}

export type {
  AuthenticatedSyncAuthContext,
  AuthenticatedSyncKit,
  AuthenticatedSyncKitOptions,
  AuthenticatedSyncRequestContext,
  AuthenticatedSyncTransport,
  KeepItem,
  KeepItemInput,
  KeepListQuery,
  KeepSyncConflict,
  KeepSyncResolution,
  KeepSyncState,
  KeepSyncStatus,
} from "@keepkit/core/core";
export { createAuthenticatedSyncKit } from "@keepkit/core/core";
export type {
  KeepButtonState,
  KeepContextValue,
  KeepErrorBoundaryProps,
  KeepProviderProps,
  KeepShortcutOptions,
} from "@keepkit/core/react";
export {
  KeepErrorBoundary,
  KeepProvider,
  useKeepContext,
  useKeepItem,
  useKeepList,
  useKeepShortcut,
} from "@keepkit/core/react";
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
export type { KeepSelectionScope } from "./KeepBulkActions";
export { isAllSelected, toggleSelectAll } from "./KeepBulkActions";
export type { RenderProp } from "./shared";
export type {
  KeepAnnouncementsProps,
  KeepBackupProps,
  KeepBulkActionsProps,
  KeepBulkActionsState,
  KeepButtonIcon,
  KeepButtonIconProps,
  KeepButtonIcons,
  KeepButtonLabels,
  KeepButtonProps,
  KeepCollectionFeature,
  KeepCollectionProps,
  KeepDisplayStatus,
  KeepEmptyStateProps,
  KeepImageProps,
  KeepItemCardLinkProps,
  KeepItemCardProps,
  KeepItemCardState,
  KeepItemCheckboxProps,
  KeepItemStatusBadgeProps,
  KeepLayoutPreset,
  KeepLayoutProps,
  KeepListProps,
  KeepListState,
  KeepNoteEditorProps,
  KeepNoteEditorState,
  KeepPagesRouterLike,
  KeepPaginationProps,
  KeepPaginationState,
  KeepPruneStaleButtonProps,
  KeepScope,
  KeepSearchInputProps,
  KeepSortSelectProps,
  KeepSortValue,
  KeepStaleNoticeProps,
  KeepStatusLabels,
  KeepStatusProps,
  KeepStatusState,
  KeepStatusValue,
  KeepSyncRecoveryDialogProps,
  KeepSyncStatusBannerProps,
  KeepTagEditorProps,
  KeepTagEditorState,
  KeepTagFilterProps,
  KeepTagFilterState,
  KeepThemeDensity,
  KeepThemeMode,
  KeepThemeName,
  KeepThemeProviderProps,
  KeepThemeRadius,
  KeepThemeVariables,
  KeepUiLabelContext,
  KeepUiLabelKey,
  KeepUiLabels,
  KeepUiLocale,
  KeepUiLocaleLabels,
  KeepUiProviderProps,
  KeepUndoProps,
  KeepUndoState,
  KeepUrlAdapter,
  KeepUrlSyncOptions,
};
export {
  createNextPagesRouterAdapter,
  getKeepLocaleLabels,
  KeepAnnouncements,
  KeepAnnouncer,
  KeepBackup,
  KeepBulkActions,
  KeepButton,
  KeepCollection,
  KeepEmptyState,
  KeepItemCard,
  KeepItemCheckbox,
  KeepItemStatusBadge,
  KeepLayout,
  KeepList,
  KeepNoteEditor,
  KeepPagination,
  KeepPruneStaleButton,
  KeepSearchInput,
  KeepSortSelect,
  KeepStaleNotice,
  KeepStatus,
  KeepSyncRecoveryDialog,
  KeepSyncStatusBanner,
  KeepTagEditor,
  KeepTagFilter,
  KeepThemeProvider,
  KeepUiProvider,
  KeepUndo,
  useKeepUiLabels,
  useKeepUrlSync,
};

export type CreateKeepKitOptions<TMeta = Record<string, unknown>> = CoreCreateKeepKitOptions<TMeta> &
  Omit<KeepUiProviderProps, "children"> & {
    theme?: KeepThemeName;
    mode?: KeepThemeMode;
    density?: KeepThemeDensity;
    radius?: KeepThemeRadius;
    accentColor?: KeepThemeProviderProps["accentColor"];
    highContrast?: boolean;
    reducedMotion?: boolean;
    variables?: KeepThemeVariables;
    themeClassName?: string;
    themeStyle?: KeepThemeProviderProps["style"];
    getTitle?: (item: KeepItem<TMeta>) => ReactNode;
    getImageProps?: (item: KeepItem<TMeta>, title: ReactNode) => KeepImageProps | undefined;
  };

export type KeepKit<TMeta = Record<string, unknown>> = {
  Provider: ComponentType<KeepKitProviderProps<TMeta>>;
  Button: ComponentType<KeepButtonProps<TMeta>>;
  Backup: ComponentType<KeepBackupProps<TMeta>>;
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
  const {
    labels,
    locale,
    labelResolver,
    theme,
    mode,
    density,
    radius,
    accentColor,
    highContrast,
    reducedMotion,
    variables,
    themeClassName,
    themeStyle,
    getTitle,
    getImageProps,
    ...coreOptions
  } = options;
  const coreKit = createCoreKeepKit<TMeta>(coreOptions);
  return {
    Provider: (props) => (
      <KeepKitProvider<TMeta>
        {...coreOptions}
        labels={labels}
        locale={locale}
        labelResolver={labelResolver}
        theme={theme}
        mode={mode}
        density={density}
        radius={radius}
        accentColor={accentColor}
        highContrast={highContrast}
        reducedMotion={reducedMotion}
        variables={variables}
        className={themeClassName}
        style={themeStyle}
        {...props}
      />
    ),
    Button: (props) => <KeepButton<TMeta> {...props} />,
    Backup: (props) => <KeepBackup<TMeta> {...props} />,
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
