"use client";

import { useKeepCollections, useKeepContext } from "@keepkit/core/react";
import { type FormEvent, type InputHTMLAttributes, type ReactNode, useId, useState } from "react";
import { useUiLabel, useUiLabelVisibility } from "../../foundation/ui-context";

export type KeepCollectionCreateProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onSubmit" | "onChange"> & {
  /** Called with the new collection ID after successful creation. */
  onCreated?: (id: string) => void;
  /** Called when creation fails (e.g. duplicate name). */
  onError?: (error: unknown) => void;
  /** Custom label for the input field. */
  label?: ReactNode;
  /** Custom label for the submit button. */
  submitLabel?: ReactNode;
  /** Placeholder text for the input. */
  placeholder?: string;
};

/** A compact form for creating new named collections. */
export function KeepCollectionCreate({
  onCreated,
  onError,
  label,
  submitLabel,
  placeholder,
  id: externalId,
  ...inputProps
}: KeepCollectionCreateProps) {
  const { createCollection } = useKeepContext();
  const collections = useKeepCollections();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const autoId = useId();
  const inputId = externalId ?? autoId;

  const resolvedLabel = useUiLabel("createCollection");
  const showLabel = useUiLabelVisibility("createCollection");
  const resolvedSubmitLabel = useUiLabel("createCollectionSubmit");
  const showSubmitLabel = useUiLabelVisibility("createCollectionSubmit");
  const placeholderText = useUiLabel("collectionName");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    const normalizedId = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    if (!normalizedId) return;

    const exists = collections.some((c) => c.id === normalizedId || c.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      const message = `Collection "${trimmed}" already exists.`;
      setError(message);
      onError?.(new Error(message));
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await createCollection(normalizedId, trimmed);
      setName("");
      onCreated?.(normalizedId);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Failed to create collection.";
      setError(message);
      onError?.(cause);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      data-keepkit="collection-create"
      data-state={error ? "error" : isSubmitting ? "submitting" : "idle"}
      onSubmit={handleSubmit}
    >
      {showLabel ? <label htmlFor={inputId}>{label ?? resolvedLabel}</label> : null}
      <div data-keepkit="collection-create-row">
        <input
          {...inputProps}
          id={inputId}
          type="text"
          value={name}
          onChange={(event) => {
            setName(event.currentTarget.value);
            if (error) setError(null);
          }}
          placeholder={placeholder ?? placeholderText}
          disabled={isSubmitting}
          aria-label={showLabel ? undefined : resolvedLabel}
          aria-invalid={error ? "true" : undefined}
          data-keep-action="collection-name-input"
        />
        <button
          type="submit"
          disabled={isSubmitting || !name.trim()}
          aria-label={showSubmitLabel ? undefined : resolvedSubmitLabel}
          data-keep-action="create-collection"
        >
          {showSubmitLabel ? (submitLabel ?? resolvedSubmitLabel) : null}
        </button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
