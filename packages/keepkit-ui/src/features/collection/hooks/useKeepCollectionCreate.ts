import { useKeepCollections, useKeepContext } from "@keepkit/core/react";
import { useRef, useState } from "react";
import { getErrorMessage } from "../../../foundation/shared";

export function useKeepCollectionCreate(
  options: { onCreated?: (id: string) => void; onError?: (error: unknown) => void } = {},
) {
  const { createCollection } = useKeepContext();
  const collections = useKeepCollections();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pending = useRef(false);

  const create = async (name: string): Promise<boolean> => {
    const trimmed = name.trim();
    if (pending.current) return false;
    if (!trimmed) {
      setError("Collection name is required.");
      return false;
    }
    pending.current = true;
    setError(null);
    setIsSubmitting(true);
    try {
      const lowerName = trimmed.toLowerCase();
      const normalizedId = lowerName.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const collectionId = normalizedId || `collection-${crypto.randomUUID()}`;
      if (
        collections.some((collection) => collection.id === collectionId || collection.name.toLowerCase() === lowerName)
      ) {
        throw new Error(`Collection "${trimmed}" already exists.`);
      }
      await createCollection(collectionId, trimmed);
      options.onCreated?.(collectionId);
      return true;
    } catch (cause) {
      setError(getErrorMessage(cause, "Failed to create collection."));
      options.onError?.(cause);
      return false;
    } finally {
      pending.current = false;
      setIsSubmitting(false);
    }
  };
  return { collections, create, error, isSubmitting, clearError: () => setError(null) };
}
