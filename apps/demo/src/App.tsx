import type { KeepItem } from "@keepkit/core/core";
import { KeepButton, useKeepContext, useKeepItem, useKeepList, useKeepShortcut } from "@keepkit/ui";
import { useEffect, useState } from "react";
import type { DemoMeta } from "./main";

type Content = KeepItem<DemoMeta> & { kindLabel: string };

interface SavedRowProps {
  item: KeepItem<DemoMeta>;
}

const content: Content[] = [
  {
    id: "article-react-server-components",
    targetType: "article",
    kindLabel: "Article",
    savedAt: 0,
    updatedAt: 0,
    meta: {
      title: "A practical guide to React Server Components",
      url: "https://react.dev/reference/rsc/server-components",
      image: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=800&q=80",
      description: "A useful reference for understanding where server-rendered UI fits.",
    },
  },
  {
    id: "article-pnpm-workspaces",
    targetType: "article",
    kindLabel: "Article",
    savedAt: 0,
    updatedAt: 0,
    meta: {
      title: "pnpm workspaces in a growing monorepo",
      url: "https://pnpm.io/workspaces",
      image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
      description: "Patterns for keeping packages and apps moving together.",
    },
  },
  {
    id: "product-field-notebook",
    targetType: "product",
    kindLabel: "Product",
    savedAt: 0,
    updatedAt: 0,
    meta: {
      title: "The everyday field notebook",
      url: "https://example.com/products/field-notebook",
      image: "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=800&q=80",
      description: "A compact notebook for ideas, observations, and plans.",
      price: "$18",
    },
  },
  {
    id: "job-product-designer",
    targetType: "job",
    kindLabel: "Job",
    savedAt: 0,
    updatedAt: 0,
    meta: {
      title: "Senior product designer",
      url: "https://example.com/jobs/product-designer",
      image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=800&q=80",
      description: "A product team looking for a thoughtful systems-minded designer.",
      company: "Northstar Labs",
      location: "Remote · Japan time",
      salary: "$90k–$120k",
    },
  },
];

export function App() {
  const [targetType, setTargetType] = useState<string | undefined>();
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const { items, isLoading, error, clear } = useKeepList<DemoMeta>({ targetType });
  const { syncState } = useKeepContext<DemoMeta>();

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useKeepShortcut({
    key: "k",
    modifier: "meta",
    item: {
      id: content[0].id,
      targetType: content[0].targetType,
      meta: content[0].meta,
      tags: ["shortcut"],
    },
  });

  const syncLabel = !online
    ? "Offline · changes are queued locally"
    : syncState.status === "pending"
      ? `${syncState.pendingCount} change${syncState.pendingCount === 1 ? "" : "s"} waiting to sync`
      : syncState.status === "syncing"
        ? "Syncing changes…"
        : syncState.status === "error"
          ? "Sync paused · will retry when online"
          : "All changes synced";

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">@keepkit/core · phase 1—3 demo</p>
        <h1>A small place for things worth returning to.</h1>
        <p className="lede">
          Save articles and products with the same headless API. Notes and the collection persist in localStorage, while
          changes in another tab are reloaded automatically.
        </p>
        <div className={online ? "sync-status online" : "sync-status offline"} aria-live="polite">
          <span className="status-dot" aria-hidden="true" />
          <span>{syncLabel}</span>
          <span className="shortcut-hint">⌘K saves the first article</span>
        </div>
      </header>

      <section className="section" aria-labelledby="content-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Browse</p>
            <h2 id="content-heading">Save something useful</h2>
          </div>
          <span className="count">{content.length} resources</span>
        </div>
        <div className="content-grid">
          {content.map((entry) => (
            <article className="content-card" key={entry.id}>
              <img src={entry.meta.image} alt="" />
              <div className="card-body">
                <span className="type-badge">{entry.kindLabel}</span>
                <h3>{entry.meta.title}</h3>
                <p>{entry.meta.description}</p>
                <a href={entry.meta.url} target="_blank" rel="noreferrer">
                  Open resource ↗
                </a>
                {entry.meta.price && <strong className="price">{entry.meta.price}</strong>}
                {entry.meta.company && (
                  <span className="job-details">
                    {entry.meta.company} · {entry.meta.location} · {entry.meta.salary}
                  </span>
                )}
                <KeepButton
                  className="favorite-button"
                  item={{
                    id: entry.id,
                    targetType: entry.targetType,
                    meta: entry.meta,
                    tags: [entry.targetType ?? "resource"],
                  }}
                  savedLabel="Saved ✓"
                  unsavedLabel="Save for later"
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section collection" aria-labelledby="collection-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Your collection</p>
            <h2 id="collection-heading">Kept items</h2>
          </div>
          <div className="collection-actions">
            <span className="count">{items.length} saved</span>
            <button className="text-button" onClick={() => void clear()} type="button">
              Clear all
            </button>
          </div>
        </div>

        <fieldset className="filters">
          <legend>Filter saved items</legend>
          {[
            [undefined, "All"],
            ["article", "Articles"],
            ["product", "Products"],
            ["job", "Jobs"],
          ].map(([value, label]) => (
            <button
              className={targetType === value ? "filter-button active" : "filter-button"}
              key={label}
              onClick={() => setTargetType(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </fieldset>

        {error ? <p className="error-state">Could not load the collection. Please try again.</p> : null}
        {isLoading ? (
          <p className="empty-state">Restoring your collection…</p>
        ) : items.length === 0 ? (
          <p className="empty-state">Nothing here yet. Save a resource above.</p>
        ) : (
          <ul className="favorite-list">
            {items.map((item) => (
              <SavedRow item={item} key={item.id} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function SavedRow({ item }: SavedRowProps) {
  const { updateNote, remove } = useKeepItem<DemoMeta>(item);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.note ?? "");

  async function saveNote() {
    await updateNote(draft);
    setEditing(false);
  }

  return (
    <li className="favorite-row">
      <div className="favorite-info">
        <span className="type-badge">{item.targetType ?? "item"}</span>
        <a href={item.meta.url} target="_blank" rel="noreferrer">
          <strong>{item.meta.title}</strong>
          <span>{item.meta.url}</span>
        </a>
        {editing ? (
          <div className="edit-comment">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-label={`Edit note for ${item.meta.title}`}
              placeholder="Add a note"
            />
            <button onClick={() => void saveNote()} type="button">
              Save note
            </button>
          </div>
        ) : (
          <button className="text-button" onClick={() => setEditing(true)} type="button">
            {item.note ? `“${item.note}” · Edit note` : "Add a note"}
          </button>
        )}
      </div>
      <button
        className="remove-button"
        aria-label={`Remove ${item.meta.title}`}
        onClick={() => void remove()}
        type="button"
      >
        Remove
      </button>
    </li>
  );
}
