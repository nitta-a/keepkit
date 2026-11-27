"use client";

import { type FormEvent, type InputHTMLAttributes, type ReactNode, useId, useState } from "react";
import { useUiLabel, useUiLabelVisibility } from "../../foundation/ui-context";
import { useKeepCollectionCreate } from "./hooks/useKeepCollectionCreate";

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
export function KeepCollectionCreate(props: KeepCollectionCreateProps) {
  return <KeepCollectionCreateForm {...props} />;
}

/** Shared form; the save panel tracks a submission before accepting a dismissal. */
export function KeepCollectionCreateForm({
  onCreated,
  onError,
  onSubmitTask,
  label,
  submitLabel,
  placeholder,
  id: externalId,
  ...inputProps
}: KeepCollectionCreateProps & { onSubmitTask?: (creation: Promise<boolean>) => void }) {
  const [name, setName] = useState("");
  const { create, error, isSubmitting, clearError } = useKeepCollectionCreate({
    onCreated: (id) => {
      setName("");
      onCreated?.(id);
    },
    onError,
  });
  const autoId = useId();
  const inputId = externalId ?? autoId;

  const resolvedLabel = useUiLabel("createCollection");
  const showLabel = useUiLabelVisibility("createCollection");
  const resolvedSubmitLabel = useUiLabel("createCollectionSubmit");
  const showSubmitLabel = useUiLabelVisibility("createCollectionSubmit");
  const placeholderText = useUiLabel("collectionName");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || isSubmitting) return;
    const creation = create(trimmed);
    onSubmitTask?.(creation);
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
            if (error) clearError();
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
      {error ? (
        <p role="alert" tabIndex={-1}>
          {error}
        </p>
      ) : null}
    </form>
  );
}
