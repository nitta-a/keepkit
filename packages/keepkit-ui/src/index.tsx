"use client";

import type { KeepChangeContext, KeepItem, KeepItemInput, KeepListQuery, KeepSyncStatus } from "@keepkit/core/core";
import type { UseKeepListResult } from "@keepkit/core/react";
import {
  type CreateKeepKitOptions as CoreCreateKeepKitOptions,
  KeepButton as CoreKeepButton,
  type KeepButtonProps as CoreKeepButtonProps,
  KeepProvider as CoreKeepProvider,
  createKeepKit as createCoreKeepKit,
  type KeepButtonState,
  type KeepProviderProps,
  type KeepShortcutOptions,
  useKeepContext,
  useKeepItem,
  useKeepList,
} from "@keepkit/core/react";
import {
  type ComponentType,
  cloneElement,
  type FormHTMLAttributes,
  type HTMLAttributes,
  type ImgHTMLAttributes,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { KeepItemCheckbox } from "./KeepItemCheckbox";
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
  type KeepUiLabelContext,
  type KeepUiLabelKey,
  type KeepUiLabels,
  KeepUiProvider,
  type KeepUiProviderProps,
  useKeepUiLabels,
  useUiLabel,
} from "./ui-context";

export type KeepKitProviderProps<TMeta = Record<string, unknown>> = Omit<KeepProviderProps<TMeta>, "children"> &
  Omit<KeepUiProviderProps, "children"> & {
    children?: ReactNode;
  };

/** Combines the core store and UI labels into the default application provider. */
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

export type { KeepContextValue, KeepProviderProps } from "@keepkit/core/react";
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
export type { KeepItemCheckboxProps } from "./KeepItemCheckbox";
export type {
  KeepItem,
  KeepItemInput,
  KeepListQuery,
  KeepPaginationProps,
  KeepPaginationState,
  KeepSearchInputProps,
  KeepShortcutOptions,
  KeepSortSelectProps,
  KeepSortValue,
  KeepSyncStatus,
  KeepUiLabelContext,
  KeepUiLabelKey,
  KeepUiLabels,
  KeepUiProviderProps,
};
export { KeepItemCheckbox, KeepPagination, KeepSearchInput, KeepSortSelect, KeepUiProvider, useKeepUiLabels };

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
  useList: (query?: KeepListQuery<TMeta>) => UseKeepListResult<TMeta>;
  useShortcut: (options: KeepShortcutOptions<TMeta>) => void;
};

/** Create one typed application API for the core and the standard UI layer. */
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

export type RenderProp<TState> = (state: TState) => ReactNode;

export type KeepButtonLabels = {
  saved?: ReactNode;
  unsaved?: ReactNode;
  loading?: ReactNode;
  error?: ReactNode;
  savedAriaLabel?: string;
  unsavedAriaLabel?: string;
};

export type KeepButtonProps<TMeta = Record<string, unknown>> = CoreKeepButtonProps<TMeta> & {
  labels?: KeepButtonLabels;
};

/** A style-free save toggle with localized labels and the core button's ARIA/asChild behavior. */
export function KeepButton<TMeta = Record<string, unknown>>({ labels, ...props }: KeepButtonProps<TMeta>) {
  const saveLabel = useUiLabel("save", typeof labels?.unsaved === "string" ? labels.unsaved : undefined);
  const savedLabel = useUiLabel("saved", typeof labels?.saved === "string" ? labels.saved : undefined);
  const loadingLabel = useUiLabel("loading", typeof labels?.loading === "string" ? labels.loading : undefined);
  const errorLabel = useUiLabel("error", typeof labels?.error === "string" ? labels.error : undefined);
  const buttonState = useKeepItem<TMeta>(props.item);
  const customStateLabel = labels?.loading !== undefined || labels?.error !== undefined;
  const getStateContent = (state: KeepButtonState<TMeta>): ReactNode => {
    if (state.error) return labels?.error ?? errorLabel;
    if (state.isMutating) return labels?.loading ?? loadingLabel;
    if (typeof props.children === "function") return props.children(state);
    if (props.children !== undefined) return props.children;
    return state.isSaved ? (labels?.saved ?? savedLabel) : (labels?.unsaved ?? saveLabel);
  };
  if (props.asChild === true) {
    const sharedProps = {
      ...props,
      "aria-busy": props["aria-busy"] ?? (buttonState.isLoading || buttonState.isMutating),
      savedLabel: labels?.saved ?? props.savedLabel ?? savedLabel,
      unsavedLabel: labels?.unsaved ?? props.unsavedLabel ?? saveLabel,
      savedAriaLabel: labels?.savedAriaLabel ?? props.savedAriaLabel,
      unsavedAriaLabel: labels?.unsavedAriaLabel ?? props.unsavedAriaLabel,
    };
    if (!customStateLabel) return <CoreKeepButton<TMeta> {...sharedProps} />;
    const statefulProps = {
      ...sharedProps,
      children: (state: KeepButtonState<TMeta>) => <>{getStateContent(state)}</>,
    };
    return <CoreKeepButton<TMeta> {...statefulProps} />;
  }
  const sharedProps = {
    ...props,
    "aria-busy": props["aria-busy"] ?? (buttonState.isLoading || buttonState.isMutating),
    savedLabel: labels?.saved ?? props.savedLabel ?? savedLabel,
    unsavedLabel: labels?.unsaved ?? props.unsavedLabel ?? saveLabel,
    savedAriaLabel: labels?.savedAriaLabel ?? props.savedAriaLabel,
    unsavedAriaLabel: labels?.unsavedAriaLabel ?? props.unsavedAriaLabel,
  };
  if (!customStateLabel) return <CoreKeepButton<TMeta> {...sharedProps} />;
  const statefulProps = { ...sharedProps, children: (state: KeepButtonState<TMeta>) => getStateContent(state) };
  return <CoreKeepButton<TMeta> {...statefulProps} />;
}

export type KeepItemCardState<TMeta = Record<string, unknown>> = {
  item: KeepItem<TMeta>;
  isSaved: boolean;
  isMutating: boolean;
  error: unknown | null;
  remove: () => Promise<void>;
};

export type KeepImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  alt: string;
};

export type KeepItemCardProps<TMeta = Record<string, unknown>> = Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "title"
> & {
  item: KeepItem<TMeta>;
  title?: ReactNode | ((item: KeepItem<TMeta>) => ReactNode);
  getTitle?: (item: KeepItem<TMeta>) => ReactNode;
  getImageProps?: (item: KeepItem<TMeta>, title: ReactNode) => KeepImageProps | undefined;
  imageComponent?: ComponentType<KeepImageProps>;
  renderImage?: (props: KeepImageProps, item: KeepItem<TMeta>) => ReactNode;
  imageAlt?: string;
  render?: RenderProp<KeepItemCardState<TMeta>>;
  children?: ReactNode | RenderProp<KeepItemCardState<TMeta>>;
  removeLabel?: string;
  onRemoveError?: (error: unknown) => void;
  onRemoved?: (item: KeepItem<TMeta>) => void;
  showSaveButton?: boolean;
  saveButtonLabels?: KeepButtonLabels;
  asChild?: boolean;
};

/** A low-dependency item presentation primitive. The default markup can be replaced with render props. */
export function KeepItemCard<TMeta = Record<string, unknown>>({
  item,
  title,
  getTitle,
  getImageProps,
  imageComponent: ImageComponent,
  renderImage,
  imageAlt,
  render,
  children,
  removeLabel,
  onRemoveError,
  onRemoved,
  showSaveButton = true,
  saveButtonLabels,
  asChild = false,
  className,
  ...rootProps
}: KeepItemCardProps<TMeta>) {
  const saveActionLabel = useUiLabel("save");
  const removeActionLabel = useUiLabel("remove");
  const itemState = useKeepItem<TMeta>(item);
  const contentChildren = asChild && isValidElement(children) ? undefined : children;
  const state: KeepItemCardState<TMeta> = {
    item,
    isSaved: itemState.isSaved,
    isMutating: itemState.isMutating,
    error: itemState.error,
    remove: itemState.remove,
  };
  const resolvedTitle =
    typeof title === "function" ? title(item) : (title ?? getTitle?.(item) ?? getMetaTitle(item.meta) ?? item.id);
  const imageProps = getImageProps?.(item, resolvedTitle);

  async function handleRemove() {
    try {
      await itemState.remove();
      onRemoved?.(item);
    } catch (error) {
      onRemoveError?.(error);
    }
  }

  const body = render
    ? render(state)
    : typeof contentChildren === "function"
      ? contentChildren(state)
      : (contentChildren ?? (
          <>
            {imageProps
              ? (renderImage?.({ ...imageProps, alt: imageAlt ?? imageProps.alt }, item) ??
                (ImageComponent ? (
                  <ImageComponent {...imageProps} alt={imageAlt ?? imageProps.alt} />
                ) : (
                  <img {...imageProps} alt={imageAlt ?? imageProps.alt} />
                )))
              : null}
            <h3>{resolvedTitle}</h3>
            {showSaveButton ? (
              <KeepButton
                item={toKeepButtonItem(item)}
                labels={saveButtonLabels}
                getAriaLabel={(buttonState) =>
                  `${buttonState.isSaved ? removeActionLabel : saveActionLabel} ${String(resolvedTitle)}`
                }
              />
            ) : null}
            <button type="button" onClick={() => void handleRemove()} disabled={itemState.isMutating}>
              {removeLabel ?? removeActionLabel}
            </button>
          </>
        ));

  return renderRoot(
    asChild,
    isValidElement(children) ? children : undefined,
    { ...rootProps, className, "aria-busy": itemState.isMutating || rootProps["aria-busy"] },
    body,
    "KeepItemCard",
  );
}

export type KeepListState<TMeta = Record<string, unknown>> = UseKeepListResult<TMeta>;

export type KeepListProps<TMeta = Record<string, unknown>> = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  query?: KeepListQuery<TMeta>;
  children?: ReactNode | RenderProp<KeepListState<TMeta>>;
  renderItem?: (item: KeepItem<TMeta>, state: KeepListState<TMeta>) => ReactNode;
  loading?: ReactNode | RenderProp<KeepListState<TMeta>>;
  empty?: ReactNode | RenderProp<KeepListState<TMeta>>;
  error?: ReactNode | RenderProp<KeepListState<TMeta>>;
  itemCardProps?: Omit<KeepItemCardProps<TMeta>, "item" | "children" | "render">;
  asChild?: boolean;
};

/** A list primitive with built-in loading, empty, error, and removal states. */
export function KeepList<TMeta = Record<string, unknown>>({
  query,
  children,
  renderItem,
  loading,
  empty,
  error: errorContent,
  itemCardProps,
  asChild = false,
  className,
  ...rootProps
}: KeepListProps<TMeta>) {
  const defaultLoading = useUiLabel("loadingItems");
  const defaultEmpty = useUiLabel("noItems");
  const defaultError = useUiLabel("errorItems");
  const state = useKeepList<TMeta>(query);
  const body = getListBody(state, {
    children,
    renderItem,
    loading: loading ?? defaultLoading,
    empty: empty ?? defaultEmpty,
    error: errorContent ?? defaultError,
    itemCardProps,
  });
  const root = asChild && isValidElement(children) ? children : undefined;
  return renderRoot(
    asChild,
    root,
    { ...rootProps, className, "aria-busy": state.isLoading || rootProps["aria-busy"] },
    body,
    "KeepList",
  );
}

function getListBody<TMeta>(
  state: KeepListState<TMeta>,
  options: {
    children?: ReactNode | RenderProp<KeepListState<TMeta>>;
    renderItem?: (item: KeepItem<TMeta>, state: KeepListState<TMeta>) => ReactNode;
    loading: ReactNode | RenderProp<KeepListState<TMeta>>;
    empty: ReactNode | RenderProp<KeepListState<TMeta>>;
    error: ReactNode | RenderProp<KeepListState<TMeta>>;
    itemCardProps?: Omit<KeepItemCardProps<TMeta>, "item" | "children" | "render">;
  },
): ReactNode {
  if (state.error && state.items.length === 0) return resolveContent(options.error, state);
  if (state.isLoading && !state.isHydrated) return resolveContent(options.loading, state);
  if (state.isHydrated && state.items.length === 0) return resolveContent(options.empty, state);
  if (typeof options.children === "function") return options.children(state);
  if (options.children !== undefined && !isValidElement(options.children)) return options.children;
  const items = state.items.map((item) =>
    options.renderItem ? (
      options.renderItem(item, state)
    ) : (
      <li key={item.id}>
        <KeepItemCard item={item} {...options.itemCardProps} />
      </li>
    ),
  );
  return <ul>{items}</ul>;
}

export type KeepCollectionFeature = "search" | "sort" | "pagination" | "tagFilter" | "bulkActions";

export type KeepCollectionProps<TMeta = Record<string, unknown>> = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  query?: KeepListQuery<TMeta>;
  pageSize?: number;
  features?: Partial<Record<KeepCollectionFeature, boolean>>;
  renderItem?: (item: KeepItem<TMeta>, state: KeepListState<TMeta>) => ReactNode;
  itemCardProps?: Omit<KeepItemCardProps<TMeta>, "item" | "children" | "render">;
  loading?: ReactNode | RenderProp<KeepListState<TMeta>>;
  empty?: ReactNode | RenderProp<KeepListState<TMeta>>;
  error?: ReactNode | RenderProp<KeepListState<TMeta>>;
};

/** A batteries-included collection with query controls and accessible status feedback. */
export function KeepCollection<TMeta = Record<string, unknown>>({
  query = {},
  pageSize = 20,
  features,
  renderItem,
  itemCardProps,
  loading,
  empty,
  error,
  className,
  ...rootProps
}: KeepCollectionProps<TMeta>) {
  const enabled = {
    search: true,
    sort: true,
    pagination: true,
    tagFilter: false,
    bulkActions: false,
    ...features,
  };
  const [searchValue, setSearchValue] = useState(query.search?.query ?? "");
  const [sort, setSort] = useState(query.sort ?? { by: "updatedAt" as const, direction: "desc" as const });
  const [tag, setTag] = useState<string | undefined>(query.tags?.[0]);
  const [page, setPage] = useState(query.pagination?.page ?? 1);
  const resolvedPageSize = query.pagination?.pageSize ?? pageSize;
  const resolvedQuery = useMemo<KeepListQuery<TMeta>>(
    () => ({
      ...query,
      search: enabled.search ? { ...query.search, query: searchValue } : query.search,
      sort: enabled.sort ? sort : query.sort,
      tags: tag ? [...new Set([...(query.tags ?? []), tag])] : query.tags,
      pagination: enabled.pagination ? { ...query.pagination, page, pageSize: resolvedPageSize } : query.pagination,
    }),
    [enabled.pagination, enabled.search, enabled.sort, page, query, resolvedPageSize, searchValue, sort, tag],
  );
  const list = useKeepList<TMeta>(resolvedQuery);

  useEffect(() => {
    if (searchValue !== undefined || sort.by !== undefined || sort.direction !== undefined || tag !== undefined) {
      setPage(1);
    }
  }, [searchValue, sort.by, sort.direction, tag]);

  return (
    <section
      {...rootProps}
      className={className}
      aria-busy={list.isLoading || list.isMutating || rootProps["aria-busy"]}
    >
      <div>
        {enabled.search ? <KeepSearchInput value={searchValue} onValueChange={setSearchValue} /> : null}
        {enabled.sort ? (
          <KeepSortSelect value={sortToValue(sort)} onValueChange={(_value, nextSort) => setSort(nextSort)} />
        ) : null}
        {enabled.tagFilter ? <KeepTagFilter<TMeta> query={query} value={tag} onValueChange={setTag} /> : null}
      </div>
      <KeepList<TMeta>
        query={resolvedQuery}
        renderItem={renderItem}
        itemCardProps={itemCardProps}
        loading={loading}
        empty={empty}
        error={error}
      />
      {enabled.pagination ? (
        <KeepPagination
          totalCount={list.totalCount}
          pageSize={resolvedPageSize}
          page={list.page}
          onPageChange={(_nextPage, nextPageOffset) => setPage(Math.floor(nextPageOffset / resolvedPageSize) + 1)}
        />
      ) : null}
      {enabled.bulkActions ? <KeepBulkActions<TMeta> query={resolvedQuery} /> : null}
    </section>
  );
}

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
  const defaultAllLabel = allLabel ?? uiAllLabel;
  const defaultAriaLabel = ariaLabel ?? uiAriaLabel;
  const contentChildren = asChild && isValidElement(children) ? undefined : children;
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const value = controlledValue ?? uncontrolledValue;
  const list = useKeepList<TMeta>({ ...query, tags: value ? [...(query?.tags ?? []), value] : query?.tags });
  const select = useCallback(
    (tag?: string) => {
      if (controlledValue === undefined) setUncontrolledValue(tag);
      onChange?.(tag);
      onValueChange?.(tag);
    },
    [controlledValue, onChange, onValueChange],
  );
  const state = useMemo<KeepTagFilterState>(
    () => ({ tags: list.tags, tagCounts: list.tagCounts, value, select }),
    [list.tagCounts, list.tags, select, value],
  );
  const body = render
    ? render(state)
    : typeof contentChildren === "function"
      ? contentChildren(state)
      : (contentChildren ?? (
          <fieldset>
            <legend>{defaultAriaLabel}</legend>
            <button type="button" aria-pressed={value === undefined} onClick={() => select()}>
              {defaultAllLabel}
            </button>
            {list.tags.map((tag) => (
              <button key={tag} type="button" aria-pressed={value === tag} onClick={() => select(tag)}>
                {renderTag ? renderTag(tag, list.tagCounts[tag] ?? 0, value === tag) : tag}
                <span> ({list.tagCounts[tag] ?? 0})</span>
              </button>
            ))}
          </fieldset>
        ));
  return renderRoot(
    asChild,
    isValidElement(children) ? children : undefined,
    { ...rootProps, className },
    body,
    "KeepTagFilter",
  );
}

export type KeepNoteEditorState<TMeta = Record<string, unknown>> = {
  item: KeepItem<TMeta>;
  note: string;
  setNote: (note: string) => void;
  isDirty: boolean;
  isSaving: boolean;
  error: unknown | null;
  save: () => Promise<void>;
};

export type KeepNoteEditorProps<TMeta = Record<string, unknown>> = Omit<
  FormHTMLAttributes<HTMLFormElement>,
  "children" | "onSubmit"
> & {
  item: KeepItem<TMeta>;
  label?: ReactNode;
  saveLabel?: ReactNode;
  placeholder?: string;
  onSaved?: (note?: string) => void;
  onSaveError?: (error: unknown) => void;
  render?: RenderProp<KeepNoteEditorState<TMeta>>;
  children?: ReactNode | RenderProp<KeepNoteEditorState<TMeta>>;
  asChild?: boolean;
};

/** A controlled-by-default note editor that persists through useKeepItem. */
export function KeepNoteEditor<TMeta = Record<string, unknown>>({
  item,
  label,
  saveLabel,
  placeholder,
  onSaved,
  onSaveError,
  render,
  children,
  asChild = false,
  className,
  ...formProps
}: KeepNoteEditorProps<TMeta>) {
  const defaultLabel = useUiLabel("note");
  const defaultSaveLabel = useUiLabel("saveNote");
  const itemState = useKeepItem<TMeta>(item);
  const contentChildren = asChild && isValidElement(children) ? undefined : children;
  const [note, setNote] = useState(item.note ?? "");
  useEffect(() => setNote(itemState.item?.note ?? item.note ?? ""), [item.note, itemState.item?.note]);
  const save = useCallback(async () => {
    const nextNote = note.trim() || undefined;
    try {
      await itemState.updateNote(nextNote);
      onSaved?.(nextNote);
    } catch (error) {
      onSaveError?.(error);
      throw error;
    }
  }, [itemState, note, onSaveError, onSaved]);
  const state: KeepNoteEditorState<TMeta> = {
    item,
    note,
    setNote,
    isDirty: note !== (itemState.item?.note ?? item.note ?? ""),
    isSaving: itemState.isMutating,
    error: itemState.error,
    save,
  };
  const body = render
    ? render(state)
    : typeof contentChildren === "function"
      ? contentChildren(state)
      : (contentChildren ?? (
          <>
            <label>
              {label ?? defaultLabel}
              <textarea
                value={note}
                onChange={(event) => setNote(event.currentTarget.value)}
                placeholder={placeholder}
                disabled={itemState.isMutating}
              />
            </label>
            <button type="submit" disabled={itemState.isMutating} aria-busy={itemState.isMutating}>
              {saveLabel ?? defaultSaveLabel}
            </button>
          </>
        ));
  const handleSubmit: FormHTMLAttributes<HTMLFormElement>["onSubmit"] = (event) => {
    event.preventDefault();
    void save().catch(() => undefined);
  };
  if (!asChild) {
    return (
      <form
        {...formProps}
        className={className}
        onSubmit={handleSubmit}
        aria-busy={itemState.isMutating || formProps["aria-busy"]}
      >
        {body}
      </form>
    );
  }
  return renderRoot(
    true,
    isValidElement(children) ? children : undefined,
    { ...formProps, className, onSubmit: handleSubmit, "aria-busy": itemState.isMutating || formProps["aria-busy"] },
    body,
    "KeepNoteEditor",
  );
}

export type KeepTagEditorProps<TMeta = Record<string, unknown>> = Omit<
  FormHTMLAttributes<HTMLFormElement>,
  "children" | "onSubmit"
> & {
  item: KeepItem<TMeta>;
  availableTags?: string[];
  onSaved?: (tags?: string[]) => void;
  onSaveError?: (error: unknown) => void;
  render?: RenderProp<{
    tags: string[];
    setTags: (tags: string[]) => void;
    save: () => Promise<void>;
    isSaving: boolean;
  }>;
};

/** Edits one item's normalized tag set and exposes a render-prop escape hatch. */
export function KeepTagEditor<TMeta = Record<string, unknown>>({
  item,
  availableTags = [],
  onSaved,
  onSaveError,
  render,
  ...props
}: KeepTagEditorProps<TMeta>) {
  const tagsLabel = useUiLabel("tagsToApply");
  const removeLabel = useUiLabel("remove");
  const applyTagsLabel = useUiLabel("applyTags");
  const itemState = useKeepItem<TMeta>(item);
  const [tags, setTags] = useState(item.tags ?? []);
  const [input, setInput] = useState("");
  useEffect(() => setTags(itemState.item?.tags ?? item.tags ?? []), [item.tags, itemState.item?.tags]);
  const save = useCallback(async () => {
    const nextTags = normalizeUiTags(tags);
    try {
      await itemState.updateTags(nextTags);
      setTags(nextTags);
      onSaved?.(nextTags);
    } catch (error) {
      onSaveError?.(error);
      throw error;
    }
  }, [itemState, onSaveError, onSaved, tags]);
  const addTag = (tag: string) => {
    const next = normalizeUiTags([...tags, tag]);
    setTags(next);
    setInput("");
  };
  const body = render ? (
    render({ tags, setTags, save, isSaving: itemState.isMutating })
  ) : (
    <>
      <label>
        {tagsLabel}
        <input
          value={input}
          list={availableTags.length > 0 ? `keep-tags-${item.id}` : undefined}
          onChange={(event) => setInput(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (input.trim()) addTag(input);
            } else if (event.key === "Backspace" && input.length === 0 && tags.length > 0) {
              event.preventDefault();
              setTags(tags.slice(0, -1));
            }
          }}
        />
      </label>
      {availableTags.length > 0 ? (
        <datalist id={`keep-tags-${item.id}`}>
          {availableTags.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
      ) : null}
      <ul aria-label={tagsLabel}>
        {tags.map((tag) => (
          <li key={tag}>
            {tag}
            <button type="button" onClick={() => setTags(tags.filter((current) => current !== tag))}>
              {removeLabel}
            </button>
          </li>
        ))}
      </ul>
      <button type="submit" disabled={itemState.isMutating} aria-busy={itemState.isMutating}>
        {applyTagsLabel}
      </button>
    </>
  );
  return (
    <form
      {...props}
      onSubmit={(event) => {
        event.preventDefault();
        void save().catch(() => undefined);
      }}
      aria-busy={itemState.isMutating || props["aria-busy"]}
    >
      {body}
    </form>
  );
}

export type KeepBulkActionsState<TMeta = Record<string, unknown>> = {
  items: KeepItem<TMeta>[];
  selectedIds: string[];
  selectedCount: number;
  allSelected: boolean;
  tagsInput: string;
  setTagsInput: (value: string) => void;
  toggle: (id: string) => void;
  toggleAll: () => void;
  remove: () => Promise<void>;
  updateTags: () => Promise<void>;
  isMutating: boolean;
};

export type KeepBulkActionsProps<TMeta = Record<string, unknown>> = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  query?: KeepListQuery<TMeta>;
  selectedIds?: string[];
  defaultSelectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  renderItem?: (item: KeepItem<TMeta>, selected: boolean) => ReactNode;
  onCompleted?: (action: "remove" | "tags", ids: string[]) => void;
  render?: RenderProp<KeepBulkActionsState<TMeta>>;
  children?: ReactNode | RenderProp<KeepBulkActionsState<TMeta>>;
};

/** Selects visible items and performs one storage operation for the whole selection. */
export function KeepBulkActions<TMeta = Record<string, unknown>>({
  query,
  selectedIds: controlledSelectedIds,
  defaultSelectedIds = [],
  onSelectedIdsChange,
  renderItem,
  onCompleted,
  render,
  children,
  ...props
}: KeepBulkActionsProps<TMeta>) {
  const selectItemsLabel = useUiLabel("selectItems");
  const selectedCountLabel = useUiLabel("selectedCount");
  const deleteSelectedLabel = useUiLabel("deleteSelected");
  const tagsLabel = useUiLabel("tagsToApply");
  const applyTagsLabel = useUiLabel("applyTags");
  const list = useKeepList<TMeta>(query);
  const [uncontrolledSelectedIds, setUncontrolledSelectedIds] = useState(defaultSelectedIds);
  const selectedIds = controlledSelectedIds ?? uncontrolledSelectedIds;
  const selected = new Set(selectedIds);
  const [tagsInput, setTagsInput] = useState("");
  const setSelectedIds = (ids: string[]) => {
    if (controlledSelectedIds === undefined) setUncontrolledSelectedIds(ids);
    onSelectedIdsChange?.(ids);
  };
  const toggle = (id: string) =>
    setSelectedIds(selected.has(id) ? selectedIds.filter((current) => current !== id) : [...selectedIds, id]);
  const allSelected = list.items.length > 0 && list.items.every((item) => selected.has(item.id));
  const toggleAll = () => setSelectedIds(allSelected ? [] : list.items.map((item) => item.id));
  const remove = async () => {
    await list.removeBatch(selectedIds);
    onCompleted?.("remove", selectedIds);
    setSelectedIds([]);
  };
  const updateTags = async () => {
    const tags = normalizeUiTags(tagsInput.split(","));
    await list.updateTagsBatch(selectedIds, tags);
    onCompleted?.("tags", selectedIds);
    setSelectedIds([]);
  };
  const state: KeepBulkActionsState<TMeta> = {
    items: list.items,
    selectedIds,
    selectedCount: selectedIds.length,
    allSelected,
    tagsInput,
    setTagsInput,
    toggle,
    toggleAll,
    remove,
    updateTags,
    isMutating: list.isMutating,
  };
  const body = render
    ? render(state)
    : typeof children === "function"
      ? children(state)
      : (children ?? (
          <>
            <fieldset>
              <legend>{selectItemsLabel}</legend>
              <label>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label={selectItemsLabel} />
                {selectedIds.length} {selectedCountLabel}
              </label>
              {list.items.map((item) => (
                <span key={item.id}>
                  <KeepItemCheckbox
                    item={item}
                    checked={selected.has(item.id)}
                    onCheckedChange={() => toggle(item.id)}
                  />
                  {renderItem ? renderItem(item, selected.has(item.id)) : (getMetaTitle(item.meta) ?? item.id)}
                </span>
              ))}
            </fieldset>
            <button type="button" onClick={() => void remove()} disabled={selectedIds.length === 0 || list.isMutating}>
              {deleteSelectedLabel}
            </button>
            <label>
              {tagsLabel}
              <input value={tagsInput} onChange={(event) => setTagsInput(event.currentTarget.value)} />
            </label>
            <button
              type="button"
              onClick={() => void updateTags()}
              disabled={selectedIds.length === 0 || list.isMutating}
            >
              {applyTagsLabel}
            </button>
          </>
        ));
  return (
    <section {...props} aria-busy={list.isMutating || props["aria-busy"]}>
      {body}
    </section>
  );
}

export type KeepEmptyStateProps = Omit<HTMLAttributes<HTMLElement>, "children" | "title"> & {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  asChild?: boolean;
};

/** A style-free, reusable empty collection state. */
export function KeepEmptyState({
  title,
  description,
  action,
  children,
  asChild = false,
  className,
  ...rootProps
}: KeepEmptyStateProps) {
  const defaultTitle = useUiLabel("noItems").replace(/\.$/, "");
  const contentChildren = asChild && isValidElement(children) ? undefined : children;
  const body = contentChildren ?? (
    <>
      <h2>{title ?? defaultTitle}</h2>
      {description ? <p>{description}</p> : null}
      {action}
    </>
  );
  return renderRoot(asChild, children, { ...rootProps, className }, body, "KeepEmptyState");
}

export type KeepStatusValue = "idle" | "empty" | "loading" | "saving" | "syncing" | "error";

export type KeepStatusLabels = Partial<Record<KeepStatusValue, ReactNode>>;

export type KeepStatusState<TMeta = Record<string, unknown>> = {
  status: KeepStatusValue;
  error: unknown | null;
  pendingCount: number;
  items: KeepItem<TMeta>[];
};

export type KeepStatusProps<TMeta = Record<string, unknown>> = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  status?: KeepStatusValue;
  labels?: KeepStatusLabels;
  children?: ReactNode | RenderProp<KeepStatusState<TMeta>>;
  render?: RenderProp<KeepStatusState<TMeta>>;
  asChild?: boolean;
};

/** Presents provider loading, mutation, synchronization, empty, and error states accessibly. */
export function KeepStatus<TMeta = Record<string, unknown>>({
  status,
  labels,
  children,
  render,
  asChild = false,
  className,
  ...rootProps
}: KeepStatusProps<TMeta>) {
  const context = useKeepContext<TMeta>();
  const contentChildren = asChild && isValidElement(children) ? undefined : children;
  const resolvedStatus = status ?? getDerivedStatus(context);
  const defaultLabel = useUiLabel(getStatusLabelKey(resolvedStatus));
  const state: KeepStatusState<TMeta> = {
    status: resolvedStatus,
    error: context.error,
    pendingCount: context.syncState.pendingCount,
    items: context.items,
  };
  const body = render
    ? render(state)
    : typeof contentChildren === "function"
      ? contentChildren(state)
      : (contentChildren ?? labels?.[resolvedStatus] ?? defaultLabel);
  const role = rootProps.role ?? (resolvedStatus === "error" ? "alert" : "status");
  return renderRoot(
    asChild,
    isValidElement(children) ? children : undefined,
    { ...rootProps, className, role, "aria-live": rootProps["aria-live"] ?? "polite" },
    body,
    "KeepStatus",
  );
}

export type KeepAnnouncementsProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  messages?: Partial<Record<"save" | "remove" | "note", string>>;
};

/** Announces successful save, remove, and note operations in a polite live region. */
export function KeepAnnouncements<TMeta = Record<string, unknown>>({ messages, ...props }: KeepAnnouncementsProps) {
  const context = useKeepContext<TMeta>();
  const savedMessage = useUiLabel("savedMessage", messages?.save);
  const removedMessage = useUiLabel("removedMessage", messages?.remove);
  const noteSavedMessage = useUiLabel("noteSavedMessage", messages?.note);
  const [message, setMessage] = useState("");
  const lastChangeRef = useRef<KeepChangeContext<TMeta> | undefined>(undefined);
  useEffect(() => {
    const change = context.lastChange;
    if (!change || change === lastChangeRef.current) return;
    lastChangeRef.current = change;
    if (change.action === "save") setMessage(savedMessage);
    else if (change.action === "remove" || change.action === "removeBatch") setMessage(removedMessage);
    else if (change.action === "updateNote") setMessage(noteSavedMessage);
  }, [context.lastChange, noteSavedMessage, removedMessage, savedMessage]);
  return (
    <div {...props} role={props.role ?? "status"} aria-live={props["aria-live"] ?? "polite"} aria-atomic="true">
      {message}
    </div>
  );
}

function getDerivedStatus<TMeta>(context: ReturnType<typeof useKeepContext<TMeta>>): KeepStatusValue {
  if (context.error) return "error";
  if (context.syncState.status === "pending" || context.syncState.status === "syncing") return "syncing";
  if (context.isMutating) return "saving";
  if (context.isLoading && !context.isHydrated) return "loading";
  if (context.isHydrated && context.items.length === 0) return "empty";
  return "idle";
}

function getStatusLabelKey(status: KeepStatusValue): KeepUiLabelKey {
  if (status === "empty") return "noItems";
  if (status === "loading") return "loadingItems";
  if (status === "error") return "error";
  if (status === "saving") return "saving";
  if (status === "syncing") return "syncing";
  return "saved";
}

function resolveContent<TState>(content: ReactNode | RenderProp<TState>, state: TState): ReactNode {
  return typeof content === "function" ? content(state) : content;
}

function toKeepButtonItem<TMeta>(item: KeepItem<TMeta>): KeepItemInput<TMeta> {
  return {
    id: item.id,
    meta: item.meta,
    targetType: item.targetType,
    note: item.note,
    tags: item.tags,
  };
}

function getMetaTitle<TMeta>(meta: TMeta): string | undefined {
  if (typeof meta !== "object" || meta === null || !("title" in meta)) return undefined;
  const title = (meta as { title?: unknown }).title;
  return typeof title === "string" && title.trim() ? title.trim() : undefined;
}

function normalizeUiTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

function sortToValue(sort: KeepListQuery["sort"]): KeepSortValue {
  return `${sort?.by ?? "updatedAt"}:${sort?.direction ?? "desc"}` as KeepSortValue;
}

function renderRoot(
  asChild: boolean,
  child: ReactNode,
  props: HTMLAttributes<HTMLElement> & Record<string, unknown>,
  body: ReactNode,
  componentName: string,
): ReactElement {
  if (asChild) {
    if (!isValidElement(child)) throw new Error(`${componentName} with asChild requires a single React element child.`);
    return cloneElement(child as ReactElement<Record<string, unknown>>, { ...props, children: body });
  }
  return <div {...props}>{body}</div>;
}
