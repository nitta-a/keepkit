import { normalizeKeepTags } from "@keepkit/core/core";
import { useKeepCollections, useKeepContext } from "@keepkit/core/react";
import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import type { DemoMeta } from "./main";

const TRACKING_PARAM_PREFIXES = ["utm_"];
const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "twclid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "si",
  "ref_src",
  "ref_url",
]);

function isTrackingParam(name: string): boolean {
  const lower = name.toLowerCase();
  return TRACKING_PARAMS.has(lower) || TRACKING_PARAM_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

export function canonicalUrl(value: string): string | undefined {
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return undefined;
    for (const key of [...url.searchParams.keys()]) {
      if (isTrackingParam(key)) url.searchParams.delete(key);
    }
    return url.href;
  } catch {
    return undefined;
  }
}

function parseTagsInput(value: string): string[] {
  return (
    normalizeKeepTags(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ) ?? []
  );
}

export function SaveLink({ onSaved, onCancel }: { onSaved?: (itemId: string) => void; onCancel?: () => void }) {
  const {
    items,
    saveItem,
    createCollection,
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
  const [tagsInput, setTagsInput] = useState<string>();
  const [collectionId, setCollectionId] = useState<string>();
  const [newCollectionName, setNewCollectionName] = useState("");
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [libraryLoaded, setLibraryLoaded] = useState(isHydrated && !isLoading && providerError === null);
  const normalizedUrl = canonicalUrl(url);
  const existing = normalizedUrl ? items.find((item) => canonicalUrl(item.meta.url) === normalizedUrl) : undefined;
  const existingTags = [...new Set(items.flatMap((item) => item.tags ?? []))].sort();
  const currentTagsValue = tagsInput ?? (existing?.tags ? existing.tags.join(", ") : "");
  const activeTags = parseTagsInput(currentTagsValue);
  const suggestedTags = existingTags.filter((tag) => !activeTags.includes(tag));
  const busy = pending || isLoading || isMutating || !libraryLoaded;

  useEffect(() => {
    if (isHydrated && !isLoading && providerError === null) setLibraryLoaded(true);
  }, [isHydrated, isLoading, providerError]);

  useEffect(() => {
    if (libraryLoaded) urlInput.current?.focus();
  }, [libraryLoaded]);

  useEffect(() => {
    if (success) urlInput.current?.focus();
  }, [success]);

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.defaultPrevented || event.key !== "Escape" || !onCancel || pending) return;
    event.preventDefault();
    onCancel();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setSuccess(false);
    setError("");
    if (!normalizedUrl) {
      setError("Enter an http or https URL without a username or password.");
      urlInput.current?.focus();
      return;
    }

    const now = Date.now();
    const itemId = existing?.id ?? `link:${normalizedUrl}`;
    const parsedTags = tagsInput === undefined ? undefined : parseTagsInput(tagsInput);
    let targetCollectionId = collectionId;
    if (isCreatingCollection && newCollectionName.trim()) {
      const trimmedName = newCollectionName.trim();
      const slug = trimmedName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const existingCollection = collections.find(
        (entry) => entry.id === slug || entry.name.toLowerCase() === trimmedName.toLowerCase(),
      );
      if (existingCollection) {
        targetCollectionId = existingCollection.id;
      } else {
        const createdId = slug || `collection-${crypto.randomUUID()}`;
        setPending(true);
        try {
          await createCollection(createdId, trimmedName);
          targetCollectionId = createdId;
        } catch (cause) {
          setPending(false);
          setError(
            cause instanceof Error ? `Could not create collection: ${cause.message}` : "Could not create collection.",
          );
          return;
        }
      }
    }
    const item = {
      ...existing,
      id: itemId,
      savedAt: existing?.savedAt ?? now,
      updatedAt: now,
      targetType: existing?.targetType ?? "link",
      meta: {
        image: "",
        description: "",
        ...existing?.meta,
        title: title.trim() || existing?.meta.title || new URL(normalizedUrl).hostname,
        url: normalizedUrl,
      },
      ...(note === undefined ? {} : { note: note.trim() }),
      ...(parsedTags === undefined ? {} : { tags: parsedTags }),
      ...(targetCollectionId === undefined ? {} : { collectionId: targetCollectionId }),
    };
    if (targetCollectionId === "") delete item.collectionId;
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
    setTagsInput(undefined);
    setCollectionId(undefined);
    setNewCollectionName("");
    setIsCreatingCollection(false);
    setSuccess(true);
    onSaved?.(itemId);
  }

  return (
    <form
      className="save-link-form"
      aria-labelledby={`${id}-heading`}
      onSubmit={submit}
      onKeyDown={handleKeyDown}
      noValidate
    >
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
        <label htmlFor={`${id}-title`}>Title (optional)</label>
        <input
          ref={titleInput}
          id={`${id}-title`}
          value={title}
          placeholder="A name you will recognize later"
          onChange={(event) => setTitle(event.currentTarget.value)}
        />
        <label htmlFor={`${id}-note`}>Note (optional)</label>
        <textarea
          id={`${id}-note`}
          value={note ?? existing?.note ?? ""}
          placeholder="Why are you keeping this?"
          onChange={(event) => setNote(event.currentTarget.value)}
          rows={3}
        />
        <label htmlFor={`${id}-tags`}>Tags (optional)</label>
        <input
          id={`${id}-tags`}
          value={currentTagsValue}
          placeholder="Reference, Read later"
          onChange={(event) => setTagsInput(event.currentTarget.value)}
        />
        {suggestedTags.length > 0 ? (
          <div className="tag-suggestions">
            {suggestedTags.map((tag) => (
              <button key={tag} type="button" onClick={() => setTagsInput([...activeTags, tag].join(", "))}>
                + {tag}
              </button>
            ))}
          </div>
        ) : null}
        <label htmlFor={`${id}-collection`}>Collection (optional)</label>
        <select
          id={`${id}-collection`}
          value={isCreatingCollection ? "__new__" : (collectionId ?? existing?.collectionId ?? "")}
          onChange={(event) => {
            const next = event.currentTarget.value;
            if (next === "__new__") {
              setIsCreatingCollection(true);
              return;
            }
            setIsCreatingCollection(false);
            setNewCollectionName("");
            setCollectionId(next);
          }}
        >
          <option value="">Inbox</option>
          {collections.map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.name}
            </option>
          ))}
          <option value="__new__">+ Create collection…</option>
        </select>
        {isCreatingCollection ? (
          <div>
            <label htmlFor={`${id}-new-collection`}>New collection name</label>
            <input
              id={`${id}-new-collection`}
              value={newCollectionName}
              placeholder="e.g. Reading list"
              onChange={(event) => setNewCollectionName(event.currentTarget.value)}
            />
          </div>
        ) : null}
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
