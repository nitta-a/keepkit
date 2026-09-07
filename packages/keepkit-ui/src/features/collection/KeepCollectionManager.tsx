"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { useId } from "react";
import { hasRenderableContent } from "../../foundation/shared";
import { useUiLabel } from "../../foundation/ui-context";
import { useKeepCollectionManager } from "./hooks/useKeepCollectionManager";
import { KeepCollectionCreate } from "./KeepCollectionCreate";

export type KeepCollectionManagerProps = Omit<HTMLAttributes<HTMLElement>, "children" | "title" | "onError"> & {
  /** Enables the built-in collection creation form. */
  allowCreate?: boolean;
  /** Enables inline collection renaming. */
  allowRename?: boolean;
  /** Enables inline collection deletion with confirmation. */
  allowDelete?: boolean;
  /** Shows item counts beside collection names. */
  showCounts?: boolean;
  /** Optional heading content. Defaults to the localized management label. */
  title?: ReactNode;
  /** Optional description rendered below the heading. */
  description?: ReactNode;
  /** Optional content rendered when there are no collections. */
  empty?: ReactNode;
  /** Replaces derived collection names in the management list. */
  collectionLabels?: Record<string, string>;
  onCreated?: (id: string) => void;
  onRenamed?: (id: string, name: string) => void | Promise<void>;
  onDeleted?: (id: string) => void | Promise<void>;
  onError?: (error: unknown) => void;
};

/** A headless collection manager for creating, renaming, and removing collections. */
export function KeepCollectionManager<TMeta = Record<string, unknown>>({
  allowCreate = true,
  allowRename = true,
  allowDelete = true,
  showCounts = true,
  title,
  description,
  empty,
  collectionLabels,
  onCreated,
  onRenamed,
  onDeleted,
  onError,
  className,
  ...rootProps
}: KeepCollectionManagerProps) {
  const manager = useKeepCollectionManager<TMeta>({ onError, onRenamed, onDeleted });
  const headingId = useId();
  const renameLabel = useUiLabel("renameCollection");
  const renameSubmitLabel = useUiLabel("renameCollectionSubmit");
  const deleteLabel = useUiLabel("deleteCollection");
  const deleteConfirmLabel = useUiLabel("deleteCollectionConfirm");
  const deleteSubmitLabel = useUiLabel("deleteCollectionSubmit");
  const cancelLabel = useUiLabel("cancel");
  const itemLabel = useUiLabel("collectionItem");
  const itemsLabel = useUiLabel("collectionItems");
  const defaultTitle = useUiLabel("manageCollections");

  return (
    <section
      {...rootProps}
      className={className}
      data-keepkit="collection-manager"
      data-state={manager.error ? "error" : manager.isMutating ? "mutating" : "idle"}
      data-loading={manager.isMutating ? "true" : undefined}
      aria-labelledby={rootProps["aria-labelledby"] ?? headingId}
    >
      <header data-keepkit="collection-manager-heading">
        <h2 id={headingId}>{title ?? defaultTitle}</h2>
        {hasRenderableContent(description) ? <p>{description}</p> : null}
      </header>

      {allowCreate ? <KeepCollectionCreate onCreated={onCreated} onError={onError} /> : null}

      {manager.error ? (
        <p data-keepkit="collection-manager-error" role="alert">
          {manager.error}
        </p>
      ) : null}

      {manager.collections.length > 0 ? (
        <ul data-keepkit="collection-manager-list">
          {manager.collections.map((collection) => {
            const name = collectionLabels?.[collection.id] ?? collection.name;
            const isEditing = manager.editingId === collection.id;
            const isPendingDelete = manager.pendingDeleteId === collection.id;
            return (
              <li data-keepkit="collection-manager-item" key={collection.id}>
                {isEditing && allowRename ? (
                  <form
                    data-keepkit="collection-manager-rename"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void manager.rename(collection.id);
                    }}
                  >
                    <label htmlFor={`${headingId}-rename-${collection.id}`}>
                      {renameLabel}: {name}
                    </label>
                    <input
                      id={`${headingId}-rename-${collection.id}`}
                      value={manager.editingName}
                      onChange={(event) => manager.setEditingName(event.currentTarget.value)}
                      disabled={manager.isMutating}
                      data-keep-action="rename-collection-input"
                    />
                    <button
                      type="submit"
                      disabled={manager.isMutating || !manager.editingName.trim()}
                      data-keep-action="rename-collection"
                    >
                      {renameSubmitLabel}
                    </button>
                    <button
                      type="button"
                      onClick={manager.cancelRename}
                      disabled={manager.isMutating}
                      data-keep-action="cancel-rename-collection"
                    >
                      {cancelLabel}
                    </button>
                  </form>
                ) : (
                  <>
                    <div data-keepkit="collection-manager-summary">
                      <span data-keepkit="collection-manager-name">{name}</span>
                      {showCounts ? (
                        <span data-keepkit="collection-manager-count">
                          {collection.count} {collection.count === 1 ? itemLabel : itemsLabel}
                        </span>
                      ) : null}
                    </div>
                    {isPendingDelete && allowDelete ? (
                      <fieldset data-keepkit="collection-manager-delete-confirmation">
                        <legend>{deleteConfirmLabel}</legend>
                        <button
                          type="button"
                          onClick={() => void manager.confirmDelete()}
                          disabled={manager.isMutating}
                          data-keep-action="delete-collection-confirm"
                        >
                          {deleteSubmitLabel}
                        </button>
                        <button
                          type="button"
                          onClick={manager.cancelDelete}
                          disabled={manager.isMutating}
                          data-keep-action="cancel-delete-collection"
                        >
                          {cancelLabel}
                        </button>
                      </fieldset>
                    ) : (
                      <div data-keepkit="collection-manager-actions">
                        {allowRename ? (
                          <button
                            type="button"
                            onClick={() => manager.beginRename(collection.id)}
                            disabled={manager.isMutating}
                            aria-label={`${renameLabel} ${name}`}
                            data-keep-action="rename-collection"
                          >
                            {renameLabel}
                          </button>
                        ) : null}
                        {allowDelete ? (
                          <button
                            type="button"
                            onClick={() => manager.requestDelete(collection.id)}
                            disabled={manager.isMutating}
                            aria-label={`${deleteLabel} ${name}`}
                            data-keep-action="delete-collection"
                          >
                            {deleteLabel}
                          </button>
                        ) : null}
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      ) : hasRenderableContent(empty) ? (
        <div data-keepkit="collection-manager-empty">{empty}</div>
      ) : null}
    </section>
  );
}
