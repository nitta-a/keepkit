"use client";

import type { KeepChangeContext, KeepItem, KeepItemInput, KeepListOptions, KeepSyncStatus } from "@keepkit/core/core";
import type { UseKeepListResult } from "@keepkit/core/react";
import {
  KeepButton as CoreKeepButton,
  type KeepButtonProps as CoreKeepButtonProps,
  type KeepButtonState,
  useKeepContext,
  useKeepItem,
  useKeepList,
} from "@keepkit/core/react";
import {
  type ComponentType,
  cloneElement,
  createContext,
  type FormHTMLAttributes,
  type HTMLAttributes,
  type ImgHTMLAttributes,
  type InputHTMLAttributes,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type KeepUiLabelKey =
  | "save"
  | "saved"
  | "remove"
  | "loading"
  | "saving"
  | "syncing"
  | "error"
  | "allTags"
  | "filterTags"
  | "note"
  | "saveNote"
  | "noItems"
  | "loadingItems"
  | "errorItems"
  | "search"
  | "sort"
  | "newest"
  | "oldest"
  | "previousPage"
  | "nextPage"
  | "pagination"
  | "page"
  | "selectItems"
  | "selectedCount"
  | "deleteSelected"
  | "tagsToApply"
  | "applyTags"
  | "savedMessage"
  | "removedMessage"
  | "noteSavedMessage";

export type KeepUiLabels = Partial<Record<KeepUiLabelKey, string>>;

export type KeepUiLabelContext = {
  locale?: string;
  labels: Readonly<Record<KeepUiLabelKey, string>>;
  labelResolver?: (key: KeepUiLabelKey, context: { locale?: string }) => string | undefined;
};

const DEFAULT_LABELS: Record<KeepUiLabelKey, string> = {
  save: "Save",
  saved: "Saved",
  remove: "Remove",
  loading: "Loading…",
  saving: "Saving…",
  syncing: "Syncing…",
  error: "Something went wrong.",
  allTags: "All",
  filterTags: "Filter saved items by tag",
  note: "Note",
  saveNote: "Save note",
  noItems: "No saved items.",
  loadingItems: "Loading saved items…",
  errorItems: "Could not load saved items.",
  search: "Search saved items",
  sort: "Sort saved items",
  newest: "Newest first",
  oldest: "Oldest first",
  previousPage: "Previous page",
  nextPage: "Next page",
  pagination: "Pagination",
  page: "Page",
  selectItems: "Select saved items",
  selectedCount: "selected",
  deleteSelected: "Delete selected",
  tagsToApply: "Tags to apply",
  applyTags: "Apply tags",
  savedMessage: "Item saved.",
  removedMessage: "Item removed.",
  noteSavedMessage: "Note saved.",
};

const KeepUiLabelsContext = createContext<KeepUiLabelContext>({ labels: DEFAULT_LABELS });

export type KeepUiProviderProps = {
  labels?: KeepUiLabels;
  locale?: string;
  labelResolver?: KeepUiLabelContext["labelResolver"];
  children?: ReactNode;
};

/** Provides one locale-aware label source to every UI primitive. */
export function KeepUiProvider({ labels, locale, labelResolver, children }: KeepUiProviderProps) {
  const value = useMemo<KeepUiLabelContext>(() => {
    const resolved = { ...DEFAULT_LABELS, ...labels };
    return { locale, labels: resolved, labelResolver };
  }, [labelResolver, labels, locale]);
  return <KeepUiLabelsContext.Provider value={value}>{children}</KeepUiLabelsContext.Provider>;
}

export function useKeepUiLabels(): KeepUiLabelContext {
  return useContext(KeepUiLabelsContext);
}

function useUiLabel(key: KeepUiLabelKey, override?: string): string {
  const context = useKeepUiLabels();
  return override ?? context.labelResolver?.(key, { locale: context.locale }) ?? context.labels[key];
}

export type { KeepContextValue, KeepProviderProps } from "@keepkit/core/react";
export { KeepProvider, useKeepContext, useKeepItem, useKeepList } from "@keepkit/core/react";
export type { KeepItem, KeepItemInput, KeepListOptions, KeepSyncStatus };

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
  const buttonState = useKeepItem<TMeta>(props.item.id, {
    meta: props.item.meta,
    targetType: props.item.targetType,
    note: props.item.note,
    tags: props.item.tags,
  });
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
      savedLabel: labels?.saved ?? savedLabel,
      unsavedLabel: labels?.unsaved ?? saveLabel,
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
    savedLabel: labels?.saved ?? savedLabel,
    unsavedLabel: labels?.unsaved ?? saveLabel,
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
  const itemState = useKeepItem<TMeta>(item.id);
  const contentChildren = asChild && isValidElement(children) ? undefined : children;
  const state: KeepItemCardState<TMeta> = {
    item,
    isSaved: itemState.isSaved,
    isMutating: itemState.isMutating,
    error: itemState.error,
    remove: itemState.remove,
  };
  const resolvedTitle = typeof title === "function" ? title(item) : (title ?? getMetaTitle(item.meta) ?? item.id);
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
  options?: KeepListOptions<TMeta>;
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
  options,
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
  const state = useKeepList<TMeta>(options);
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
  listOptions?: KeepListOptions<TMeta>;
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

/** An ARIA button group for tag filtering; consumers can connect value to KeepList options. */
export function KeepTagFilter<TMeta = Record<string, unknown>>({
  listOptions,
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
  const list = useKeepList<TMeta>(listOptions);
  const contentChildren = asChild && isValidElement(children) ? undefined : children;
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const value = controlledValue ?? uncontrolledValue;
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
  const itemState = useKeepItem<TMeta>(item.id);
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

export type KeepSearchInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange"
> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

/** A controlled/uncontrolled search field for wiring into useKeepList.searchQuery. */
export function KeepSearchInput({
  value: controlledValue,
  defaultValue = "",
  onValueChange,
  "aria-label": ariaLabel,
  placeholder,
  ...props
}: KeepSearchInputProps) {
  const label = useUiLabel("search");
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const value = controlledValue ?? uncontrolledValue;
  return (
    <input
      {...props}
      type="search"
      value={value}
      aria-label={ariaLabel ?? label}
      placeholder={placeholder ?? label}
      onChange={(event) => {
        const nextValue = event.currentTarget.value;
        if (controlledValue === undefined) setUncontrolledValue(nextValue);
        onValueChange?.(nextValue);
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
  onValueChange?: (value: KeepSortValue, sort: NonNullable<KeepListOptions["sort"]>) => void;
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
  const newestLabel = useUiLabel("newest");
  const savedLabel = useUiLabel("saved");
  const oldestLabel = useUiLabel("oldest");
  const [uncontrolledValue, setUncontrolledValue] = useState<KeepSortValue>(defaultValue);
  const value = controlledValue ?? uncontrolledValue;
  const options = children ?? (
    <>
      <option value="updatedAt:desc">{newestLabel}</option>
      <option value="savedAt:desc">{savedLabel}</option>
      <option value="updatedAt:asc">{oldestLabel}</option>
      <option value="savedAt:asc">{oldestLabel}</option>
    </>
  );
  return (
    <select
      {...props}
      value={value}
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

export type KeepPaginationProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  totalCount: number;
  pageSize: number;
  page?: number;
  onPageChange?: (page: number, offset: number) => void;
  render?: RenderProp<{ page: number; pageCount: number; goToPage: (page: number) => void }>;
};

/** A small accessible pagination control using one-based pages and zero-based offsets. */
export function KeepPagination({
  totalCount,
  pageSize,
  page = 1,
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
  if (render) return <nav {...props}>{render({ page: currentPage, pageCount, goToPage })}</nav>;
  return (
    <nav {...props} aria-label={props["aria-label"] ?? paginationLabel}>
      <button type="button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>
        {previousPageLabel}
      </button>
      <span aria-current="page">
        {pageLabel} {currentPage} / {pageCount}
      </span>
      <button type="button" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= pageCount}>
        {nextPageLabel}
      </button>
    </nav>
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
  const itemState = useKeepItem<TMeta>(item.id);
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

export type KeepBulkActionsProps<TMeta = Record<string, unknown>> = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  listOptions?: KeepListOptions<TMeta>;
  selectedIds?: string[];
  defaultSelectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  renderItem?: (item: KeepItem<TMeta>, selected: boolean) => ReactNode;
  onCompleted?: (action: "remove" | "tags", ids: string[]) => void;
};

/** Selects visible items and performs one storage operation for the whole selection. */
export function KeepBulkActions<TMeta = Record<string, unknown>>({
  listOptions,
  selectedIds: controlledSelectedIds,
  defaultSelectedIds = [],
  onSelectedIdsChange,
  renderItem,
  onCompleted,
  ...props
}: KeepBulkActionsProps<TMeta>) {
  const selectItemsLabel = useUiLabel("selectItems");
  const selectedCountLabel = useUiLabel("selectedCount");
  const deleteSelectedLabel = useUiLabel("deleteSelected");
  const tagsLabel = useUiLabel("tagsToApply");
  const applyTagsLabel = useUiLabel("applyTags");
  const list = useKeepList<TMeta>(listOptions);
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
  return (
    <section {...props} aria-busy={list.isMutating || props["aria-busy"]}>
      <fieldset>
        <legend>{selectItemsLabel}</legend>
        <label>
          <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          {selectedIds.length} {selectedCountLabel}
        </label>
        {list.items.map((item) => (
          <label key={item.id}>
            <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
            {renderItem ? renderItem(item, selected.has(item.id)) : (getMetaTitle(item.meta) ?? item.id)}
          </label>
        ))}
      </fieldset>
      <button type="button" onClick={() => void remove()} disabled={selectedIds.length === 0 || list.isMutating}>
        {deleteSelectedLabel}
      </button>
      <label>
        {tagsLabel}
        <input value={tagsInput} onChange={(event) => setTagsInput(event.currentTarget.value)} />
      </label>
      <button type="button" onClick={() => void updateTags()} disabled={selectedIds.length === 0 || list.isMutating}>
        {applyTagsLabel}
      </button>
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

function toKeepButtonItem<TMeta>(item: KeepItem<TMeta>): KeepItemInput<TMeta> & { id: string } {
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
