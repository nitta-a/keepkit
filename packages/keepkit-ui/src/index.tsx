"use client";

import type { KeepItem, KeepItemInput, KeepListOptions, KeepSyncStatus } from "@keepkit/core/core";
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
  cloneElement,
  type FormHTMLAttributes,
  type HTMLAttributes,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

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
  const buttonState = useKeepItem<TMeta>(props.item.id, {
    meta: props.item.meta,
    targetType: props.item.targetType,
    note: props.item.note,
    tags: props.item.tags,
  });
  const customStateLabel = labels?.loading !== undefined || labels?.error !== undefined;
  const getStateContent = (state: KeepButtonState<TMeta>): ReactNode => {
    if (state.error && labels?.error !== undefined) return labels.error;
    if (state.isMutating && labels?.loading !== undefined) return labels.loading;
    if (typeof props.children === "function") return props.children(state);
    if (props.children !== undefined) return props.children;
    return state.isSaved ? (labels?.saved ?? "Saved") : (labels?.unsaved ?? "Save");
  };
  if (props.asChild === true) {
    const sharedProps = {
      ...props,
      "aria-busy": props["aria-busy"] ?? (buttonState.isLoading || buttonState.isMutating),
      savedLabel: labels?.saved ?? props.savedLabel,
      unsavedLabel: labels?.unsaved ?? props.unsavedLabel,
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
    savedLabel: labels?.saved ?? props.savedLabel,
    unsavedLabel: labels?.unsaved ?? props.unsavedLabel,
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

export type KeepItemCardProps<TMeta = Record<string, unknown>> = Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "title"
> & {
  item: KeepItem<TMeta>;
  title?: ReactNode | ((item: KeepItem<TMeta>) => ReactNode);
  getImageUrl?: (item: KeepItem<TMeta>) => string | undefined;
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
  getImageUrl,
  imageAlt,
  render,
  children,
  removeLabel = "Remove",
  onRemoveError,
  onRemoved,
  showSaveButton = true,
  saveButtonLabels,
  asChild = false,
  className,
  ...rootProps
}: KeepItemCardProps<TMeta>) {
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
  const imageUrl = getImageUrl?.(item);

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
            {imageUrl ? <img src={imageUrl} alt={imageAlt ?? String(resolvedTitle)} /> : null}
            <h3>{resolvedTitle}</h3>
            {showSaveButton ? (
              <KeepButton
                item={toKeepButtonItem(item)}
                labels={saveButtonLabels}
                getAriaLabel={(buttonState) => `${buttonState.isSaved ? "Remove" : "Save"} ${String(resolvedTitle)}`}
              />
            ) : null}
            <button type="button" onClick={() => void handleRemove()} disabled={itemState.isMutating}>
              {removeLabel}
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
  loading = "Loading saved items…",
  empty = "No saved items.",
  error: errorContent = "Could not load saved items.",
  itemCardProps,
  asChild = false,
  className,
  ...rootProps
}: KeepListProps<TMeta>) {
  const state = useKeepList<TMeta>(options);
  const body = getListBody(state, { children, renderItem, loading, empty, error: errorContent, itemCardProps });
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
  allLabel = "All",
  ariaLabel = "Filter saved items by tag",
  renderTag,
  render,
  children,
  asChild = false,
  className,
  ...rootProps
}: KeepTagFilterProps<TMeta>) {
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
            <legend>{ariaLabel}</legend>
            <button type="button" aria-pressed={value === undefined} onClick={() => select()}>
              {allLabel}
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
  label = "Note",
  saveLabel = "Save note",
  placeholder,
  onSaved,
  onSaveError,
  render,
  children,
  asChild = false,
  className,
  ...formProps
}: KeepNoteEditorProps<TMeta>) {
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
              {label}
              <textarea
                value={note}
                onChange={(event) => setNote(event.currentTarget.value)}
                placeholder={placeholder}
                disabled={itemState.isMutating}
              />
            </label>
            <button type="submit" disabled={itemState.isMutating} aria-busy={itemState.isMutating}>
              {saveLabel}
            </button>
          </>
        ));
  const handleSubmit: FormHTMLAttributes<HTMLFormElement>["onSubmit"] = (event) => {
    event.preventDefault();
    void save().catch(() => undefined);
  };
  return renderRoot(
    asChild,
    isValidElement(children) ? children : undefined,
    { ...formProps, className, onSubmit: handleSubmit, "aria-busy": itemState.isMutating || formProps["aria-busy"] },
    body,
    "KeepNoteEditor",
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
  title = "No saved items",
  description,
  action,
  children,
  asChild = false,
  className,
  ...rootProps
}: KeepEmptyStateProps) {
  const contentChildren = asChild && isValidElement(children) ? undefined : children;
  const body = contentChildren ?? (
    <>
      <h2>{title}</h2>
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
      : (contentChildren ?? labels?.[resolvedStatus] ?? getDefaultStatusLabel(resolvedStatus));
  const role = rootProps.role ?? (resolvedStatus === "error" ? "alert" : "status");
  return renderRoot(
    asChild,
    isValidElement(children) ? children : undefined,
    { ...rootProps, className, role, "aria-live": rootProps["aria-live"] ?? "polite" },
    body,
    "KeepStatus",
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

function getDefaultStatusLabel(status: KeepStatusValue): string {
  if (status === "empty") return "No saved items.";
  if (status === "loading") return "Loading saved items…";
  if (status === "saving") return "Saving…";
  if (status === "syncing") return "Syncing…";
  if (status === "error") return "Something went wrong.";
  return "";
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
