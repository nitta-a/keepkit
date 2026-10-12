import { useKeepCollections, useKeepContext } from "@keepkit/core/react";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import type { DemoMeta } from "./main";

function canonicalUrl(value: string): string | undefined {
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

export function SaveLink({ onSaved, onCancel }: { onSaved?: (itemId: string) => void; onCancel?: () => void }) {
  const {
    items,
    saveItem,
    refresh,
    isHydrated,
    isLoading,
    isMutating,
    error: providerError,
  } = useKeepContext<DemoMeta>();
  const collections = useKeepCollections<DemoMeta>();
  const id = useId();
  const titleInput = useRef<HTMLInputElement>(null);
  const urlInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState<string>();
  const [collectionId, setCollectionId] = useState<string>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [libraryLoaded, setLibraryLoaded] = useState(isHydrated && !isLoading && providerError === null);
  const normalizedUrl = canonicalUrl(url);
  const existing = normalizedUrl ? items.find((item) => canonicalUrl(item.meta.url) === normalizedUrl) : undefined;
  const busy = pending || isLoading || isMutating || !libraryLoaded;

  useEffect(() => {
    if (isHydrated && !isLoading && providerError === null) setLibraryLoaded(true);
  }, [isHydrated, isLoading, providerError]);

  useEffect(() => {
    if (libraryLoaded) titleInput.current?.focus();
  }, [libraryLoaded]);

  useEffect(() => {
    if (success) titleInput.current?.focus();
  }, [success]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setSuccess(false);
    setError("");
    if (!title.trim()) {
      setError("Enter a title for this link.");
      titleInput.current?.focus();
      return;
    }
    if (!normalizedUrl) {
      setError("Enter an http or https URL without a username or password.");
      urlInput.current?.focus();
      return;
    }

    const now = Date.now();
    const itemId = existing?.id ?? `link:${normalizedUrl}`;
    const item = {
      ...existing,
      id: itemId,
      savedAt: existing?.savedAt ?? now,
      updatedAt: now,
      targetType: existing?.targetType ?? "link",
      meta: { image: "", description: "", ...existing?.meta, title: title.trim(), url: normalizedUrl },
      ...(note === undefined ? {} : { note: note.trim() }),
      ...(collectionId === undefined ? {} : { collectionId }),
    };
    if (collectionId === "") delete item.collectionId;
    setPending(true);
    try {
      await saveItem(item);
    } catch (cause) {
      setError(cause instanceof Error ? `Could not save this link: ${cause.message}` : "Could not save this link.");
      return;
    } finally {
      setPending(false);
    }
    setTitle("");
    setUrl("");
    setNote(undefined);
    setCollectionId(undefined);
    setSuccess(true);
    onSaved?.(itemId);
  }

  return (
    <form className="save-link-form" aria-labelledby={`${id}-heading`} onSubmit={submit} noValidate>
      <div className="save-link-heading">
        <h2 id={`${id}-heading`}>Save a link</h2>
        <p>Keep an article, a useful reference, or anything you want to return to.</p>
      </div>
      {!libraryLoaded && providerError ? (
        <div>
          <p className="save-link-error" role="alert">
            Your library could not be loaded. Reload it before saving to protect your existing links.
          </p>
          <button type="button" disabled={pending || isLoading} onClick={() => void refresh()}>
            Retry loading library
          </button>
        </div>
      ) : null}
      <fieldset disabled={busy}>
        <label htmlFor={`${id}-title`}>Title</label>
        <input
          ref={titleInput}
          id={`${id}-title`}
          value={title}
          required
          placeholder="A name you will recognize later"
          onChange={(event) => setTitle(event.currentTarget.value)}
        />
        <label htmlFor={`${id}-url`}>URL</label>
        <input
          ref={urlInput}
          id={`${id}-url`}
          type="url"
          value={url}
          required
          placeholder="https://example.com/article"
          onChange={(event) => setUrl(event.currentTarget.value)}
        />
        <label htmlFor={`${id}-note`}>Note (optional)</label>
        <textarea
          id={`${id}-note`}
          value={note ?? existing?.note ?? ""}
          placeholder="Why are you keeping this?"
          onChange={(event) => setNote(event.currentTarget.value)}
          rows={3}
        />
        <label htmlFor={`${id}-collection`}>Collection (optional)</label>
        <select
          id={`${id}-collection`}
          value={collectionId ?? existing?.collectionId ?? ""}
          onChange={(event) => setCollectionId(event.currentTarget.value)}
        >
          <option value="">Inbox</option>
          {collections.map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.name}
            </option>
          ))}
        </select>
        {existing ? (
          <p>This link is already saved. Saving updates it and keeps any fields you leave unchanged.</p>
        ) : null}
      </fieldset>
      <div className="save-link-actions">
        <button type="submit" disabled={busy}>
          {pending ? "Saving…" : "Save link"}
        </button>
        {onCancel ? (
          <button type="button" disabled={pending} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="save-link-error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? <p role="status">Link saved to your library.</p> : null}
    </form>
  );
}
