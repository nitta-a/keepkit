import { useKeepCollections, useKeepContext } from "@keepkit/core/react";
import { useCallback, useState } from "react";

type UseKeepCollectionManagerOptions = {
  onError?: (error: unknown) => void;
  onRenamed?: (id: string, name: string) => void | Promise<void>;
  onDeleted?: (id: string) => void | Promise<void>;
};

export function useKeepCollectionManager<TMeta = Record<string, unknown>>({
  onError,
  onRenamed,
  onDeleted,
}: UseKeepCollectionManagerOptions = {}) {
  const {
    items,
    collections: explicitCollections,
    createCollection,
    renameCollection,
    removeCollection,
    moveToCollection,
  } = useKeepContext<TMeta>();
  const collections = useKeepCollections<TMeta>({ orderBy: "name" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  const reportError = useCallback(
    (cause: unknown, fallback: string) => {
      const message = cause instanceof Error ? cause.message : fallback;
      setError(message);
      onError?.(cause);
    },
    [onError],
  );

  const runMutation = useCallback(
    async (operation: () => Promise<void>) => {
      setError(null);
      setIsMutating(true);
      try {
        await operation();
      } catch (cause) {
        reportError(cause, "Could not update the collection.");
      } finally {
        setIsMutating(false);
      }
    },
    [reportError],
  );

  const beginRename = useCallback(
    (id: string) => {
      const collection = collections.find((entry) => entry.id === id);
      if (!collection) return;
      setError(null);
      setPendingDeleteId(null);
      setEditingId(id);
      setEditingName(collection.name);
    },
    [collections],
  );

  const cancelRename = useCallback(() => {
    setEditingId(null);
    setEditingName("");
  }, []);

  const rename = useCallback(
    async (id: string) => {
      const name = editingName.trim();
      if (!name) return;
      const duplicate = collections.some(
        (collection) => collection.id !== id && collection.name.toLowerCase() === name.toLowerCase(),
      );
      if (duplicate) {
        setError(`Collection "${name}" already exists.`);
        return;
      }
      await runMutation(async () => {
        if (explicitCollections[id]) {
          await renameCollection(id, name);
        } else {
          // Item-derived collections have no explicit metadata yet. Register the
          // existing ID so its display name can still be managed.
          await createCollection(id, name);
        }
        cancelRename();
        await onRenamed?.(id, name);
      });
    },
    [
      cancelRename,
      collections,
      createCollection,
      editingName,
      explicitCollections,
      onRenamed,
      renameCollection,
      runMutation,
    ],
  );

  const requestDelete = useCallback((id: string) => {
    setError(null);
    setEditingId(null);
    setPendingDeleteId(id);
  }, []);

  const cancelDelete = useCallback(() => setPendingDeleteId(null), []);

  const confirmDelete = useCallback(async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    await runMutation(async () => {
      if (explicitCollections[id]) {
        await removeCollection(id);
      } else {
        // removeCollection only knows explicit definitions. Move the items out
        // directly when this is an item-derived collection.
        for (const item of items.filter((entry) => entry.collectionId === id)) {
          await moveToCollection(item.id, undefined);
        }
      }
      setPendingDeleteId(null);
      await onDeleted?.(id);
    });
  }, [explicitCollections, items, moveToCollection, onDeleted, pendingDeleteId, removeCollection, runMutation]);

  return {
    collections,
    editingId,
    editingName,
    setEditingName,
    beginRename,
    cancelRename,
    rename,
    pendingDeleteId,
    requestDelete,
    cancelDelete,
    confirmDelete,
    error,
    isMutating,
  };
}
