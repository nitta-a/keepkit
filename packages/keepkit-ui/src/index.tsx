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
  type UseKeepNavigatorOptions,
  type UseKeepNavigatorResult,
  type useKeepContext,
  type useKeepItem,
  type useKeepList,
} from "@keepkit/core/react";
import type { ComponentType, ReactNode } from "react";
import {
  createNextPagesRouterAdapter,
  type KeepPagesRouterLike,
  type KeepUrlAdapter,
  useKeepUrlSync,
} from "./adapters/url-sync";
import { KeepBackup, type KeepBackupProps } from "./features/actions/KeepBackup";
import {
  KeepBulkActions,
  type KeepBulkActionsProps,
  type KeepBulkActionsState,
} from "./features/actions/KeepBulkActions";
import {
  KeepButton,
  type KeepButtonIcon,
  type KeepButtonIconProps,
  type KeepButtonIcons,
  type KeepButtonLabels,
  type KeepButtonProps,
} from "./features/actions/KeepButton";
import { KeepItemCheckbox, type KeepItemCheckboxProps } from "./features/actions/KeepItemCheckbox";
import { KeepUndo, type KeepUndoProps } from "./features/actions/KeepUndo";
import {
  KeepCollection,
  type KeepCollectionFeature,
  type KeepCollectionProps,
  type KeepLayoutPreset,
} from "./features/collection/KeepCollection";
import { KeepLayout, type KeepLayoutProps } from "./features/collection/KeepLayout";
import { KeepList, type KeepListProps, type KeepListState } from "./features/collection/KeepList";
import {
  type KeepReorderableItemState,
  KeepReorderableList,
  type KeepReorderableListProps,
} from "./features/collection/KeepReorderableList";
import { KeepNoteEditor, type KeepNoteEditorProps, type KeepNoteEditorState } from "./features/editor/KeepNoteEditor";
import { KeepTagEditor, type KeepTagEditorProps, type KeepTagEditorState } from "./features/editor/KeepTagEditor";
import {
  type KeepToastFeedbackOptions,
  type KeepToastHandler,
  useKeepToastFeedback,
} from "./features/feedback/useKeepToastFeedback";
import {
  type KeepImageProps,
  KeepItemCard,
  type KeepItemCardActionsProps,
  type KeepItemCardContentProps,
  type KeepItemCardLinkProps,
  type KeepItemCardMediaProps,
  type KeepItemCardProps,
  KeepItemCardSkeleton,
  type KeepItemCardSkeletonProps,
  type KeepItemCardState,
  type KeepItemCardTagsProps,
  type KeepItemCardTitleProps,
} from "./features/item/KeepItemCard";
import {
  type KeepDisplayStatus,
  KeepItemStatusBadge,
  type KeepItemStatusBadgeProps,
} from "./features/item/KeepItemStatusBadge";
import { KeepNavigator, KeepTourBar, type KeepTourBarProps } from "./features/navigation/KeepTourBar";
import { KeepTagFilter, type KeepTagFilterProps, type KeepTagFilterState } from "./features/query/KeepTagFilter";
import {
  KeepPagination,
  type KeepPaginationProps,
  type KeepPaginationState,
  KeepSearchInput,
  type KeepSearchInputProps,
  KeepSortSelect,
  type KeepSortSelectProps,
  type KeepSortValue,
} from "./features/query/query-controls";
import {
  KeepPruneStaleButton,
  type KeepPruneStaleButtonProps,
  KeepStaleNotice,
  type KeepStaleNoticeProps,
} from "./features/status/KeepStaleNotice";
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
} from "./features/status/status";
import { KeepSyncFeedbackObserver } from "./features/sync/KeepSyncFeedbackObserver";
import { KeepSyncRecoveryDialog, type KeepSyncRecoveryDialogProps } from "./features/sync/KeepSyncRecoveryDialog";
import { KeepSyncStatusBanner, type KeepSyncStatusBannerProps } from "./features/sync/KeepSyncStatusBanner";
import {
  type KeepThemeDensity,
  type KeepThemeMode,
  type KeepThemeName,
  KeepThemeProvider,
  type KeepThemeProviderProps,
  type KeepThemeRadius,
  type KeepThemeVariables,
  keepThemeNames,
} from "./foundation/theme";
import {
  getKeepLocaleLabels,
  type KeepUiFeedbackEvent,
  type KeepUiLabelContext,
  type KeepUiLabelKey,
  type KeepUiLabels,
  type KeepUiLocale,
  type KeepUiLocaleLabels,
  KeepUiProvider,
  type KeepUiProviderProps,
  useKeepUiLabels,
} from "./foundation/ui-context";

export type { KeepTourShortcutsOptions } from "./features/navigation/hooks/useKeepTourShortcuts";
export { useKeepTourShortcuts } from "./features/navigation/hooks/useKeepTourShortcuts";

export type KeepKitProviderProps<TMeta = Record<string, unknown>> = Omit<KeepProviderProps<TMeta>, "children"> &
  Omit<KeepUiProviderProps<TMeta>, "children"> &
  Omit<KeepThemeProviderProps, "children"> & { children?: ReactNode };

/** Combines the core store, UI labels, and the global live announcer. */
export function KeepKitProvider<TMeta = Record<string, unknown>>({
  labels,
  locale,
  labelResolver,
  onFeedback,
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
    <KeepUiProvider<TMeta> labels={labels} locale={locale} labelResolver={labelResolver} onFeedback={onFeedback}>
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
          <KeepSyncFeedbackObserver />
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
  useKeepNavigator,
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
export type { KeepSelectionScope } from "./features/actions/KeepBulkActions";
export { isAllSelected, toggleSelectAll } from "./features/actions/KeepBulkActions";
export type { KeepHighlightProps, RenderProp } from "./foundation/shared";
export { highlightText, KeepHighlight } from "./foundation/shared";
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
  KeepItemCardActionsProps,
  KeepItemCardContentProps,
  KeepItemCardLinkProps,
  KeepItemCardMediaProps,
  KeepItemCardProps,
  KeepItemCardSkeletonProps,
  KeepItemCardState,
  KeepItemCardTagsProps,
  KeepItemCardTitleProps,
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
  KeepReorderableItemState,
  KeepReorderableListProps,
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
  KeepToastFeedbackOptions,
  KeepToastHandler,
  KeepTourBarProps,
  KeepUiFeedbackEvent,
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
  KeepItemCardSkeleton,
  KeepItemCheckbox,
  KeepItemStatusBadge,
  KeepLayout,
  KeepList,
  KeepNavigator,
  KeepNoteEditor,
  KeepPagination,
  KeepPruneStaleButton,
  KeepReorderableList,
  KeepSearchInput,
  KeepSortSelect,
  KeepStaleNotice,
  KeepStatus,
  KeepSyncRecoveryDialog,
  KeepSyncStatusBanner,
  KeepTagEditor,
  KeepTagFilter,
  KeepThemeProvider,
  KeepTourBar,
  KeepUiProvider,
  KeepUndo,
  keepThemeNames,
  useKeepToastFeedback,
  useKeepUiLabels,
  useKeepUrlSync,
};

export type CreateKeepKitOptions<TMeta = Record<string, unknown>> = CoreCreateKeepKitOptions<TMeta> &
  Omit<KeepUiProviderProps<TMeta>, "children"> & {
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
  useNavigator: (options?: UseKeepNavigatorOptions<TMeta>) => UseKeepNavigatorResult<TMeta>;
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
    onFeedback,
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
        onFeedback={onFeedback}
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
    useNavigator: (navigatorOptions) => coreKit.useNavigator(navigatorOptions),
    useShortcut: (shortcutOptions) => coreKit.useShortcut(shortcutOptions),
  };
}
