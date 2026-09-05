import type { KeepItem } from "@keepkit/core/core";
import {
  KeepBulkActions,
  KeepButton,
  KeepCollection,
  KeepEmptyState,
  KeepItemCard,
  KeepNoteEditor,
  KeepUndo,
} from "@keepkit/ui";
import type { DemoMeta } from "./main";
import { useAppView } from "./useAppView";

type Content = KeepItem<DemoMeta> & { kindLabel: string };

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
  const {
    isOnline,
    savedItemCount,
    shortcutLabel,
    syncLabel,
    showArchived,
    setShowArchived,
    isManaging,
    setIsManaging,
    areFiltersOpen,
    setAreFiltersOpen,
    openNoteId,
    setOpenNoteId,
  } = useAppView(content[0]);

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">KeepKit demo</p>
        <h1>Save what you want to return to.</h1>
        <p className="lede">
          Keep useful articles, products, and ideas in one simple collection. Your saves stay available offline and sync
          when you are back online.
        </p>
        <div className={isOnline ? "sync-status online" : "sync-status offline"} aria-live="polite">
          <span className="status-dot" aria-hidden="true" />
          <span>{syncLabel}</span>
          <span className="shortcut-hint">{shortcutLabel} saves the first item</span>
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
                    meta: entry.meta,
                    tags: [entry.kindLabel],
                    collectionId:
                      entry.targetType === "article" ? "reading" : entry.targetType === "product" ? "shopping" : "work",
                    ...(entry.targetType === undefined ? {} : { targetType: entry.targetType }),
                  }}
                  savedLabel="Saved ✓"
                  unsavedLabel="Save for later"
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section collection-shell" aria-labelledby="collection-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Your collection</p>
            <h2 id="collection-heading">Kept items</h2>
          </div>
          <div className="collection-actions">
            <span className="count">{savedItemCount} saved</span>
            <button className="text-button" onClick={() => setShowArchived(!showArchived)} type="button">
              {showArchived ? "Show active" : "Show archived"}
            </button>
            {!isManaging ? (
              <button
                className="text-button"
                onClick={() => setAreFiltersOpen(!areFiltersOpen)}
                type="button"
                aria-expanded={areFiltersOpen}
                aria-controls="collection-filters"
              >
                {areFiltersOpen ? "Hide filters" : "Filter"}
              </button>
            ) : null}
            <button
              className="text-button"
              onClick={() => setIsManaging(!isManaging)}
              type="button"
              disabled={savedItemCount === 0}
              aria-expanded={isManaging}
              aria-controls="collection-manager"
            >
              {isManaging ? "Done managing" : "Manage items"}
            </button>
          </div>
        </div>

        {isManaging ? (
          <div id="collection-manager" className="collection-manager">
            <p>Select the items you want to update or remove. Removed items can be restored with Undo.</p>
            <KeepBulkActions<DemoMeta>
              query={{ archived: showArchived, pinnedFirst: true }}
              onCompleted={() => setIsManaging(false)}
            />
          </div>
        ) : (
          <KeepCollection<DemoMeta>
            className="demo-collection"
            id="collection-filters"
            data-filters-open={areFiltersOpen ? "true" : "false"}
            layout="auto"
            loadingCount={6}
            pageSize={6}
            query={{ archived: showArchived, pinnedFirst: true }}
            collectionLabels={{ reading: "Reading", shopping: "Shopping", work: "Work" }}
            features={{ tagFilter: true, collectionFilter: true }}
            empty={
              <KeepEmptyState
                title="Nothing here yet"
                description="Save a resource above and it will appear in this searchable collection."
              />
            }
            renderItem={(item) => (
              <li className="saved-item" key={item.id}>
                <KeepItemCard
                  id={`saved-item-${encodeURIComponent(item.id)}`}
                  item={item}
                  href={item.meta.url}
                  showSaveButton={false}
                  getImageProps={(entry) => ({ src: entry.meta.image, alt: entry.meta.title })}
                >
                  <KeepItemCard.Media />
                  <KeepItemCard.Content>
                    <span className="type-badge">{item.targetType ?? "Item"}</span>
                    <KeepItemCard.Title />
                    <KeepItemCard.Tags />
                    <KeepItemCard.CollectionBadge />
                  </KeepItemCard.Content>
                  <KeepItemCard.Actions>
                    <KeepItemCard.Pin />
                    <details className="card-more-actions">
                      <summary>More</summary>
                      <div>
                        <KeepItemCard.Archive />
                        <KeepItemCard.Remove />
                      </div>
                    </details>
                  </KeepItemCard.Actions>
                </KeepItemCard>
                <div className="note-disclosure">
                  <button
                    className="note-toggle"
                    type="button"
                    aria-expanded={openNoteId === item.id}
                    aria-controls={`note-${encodeURIComponent(item.id)}`}
                    onClick={() => setOpenNoteId(openNoteId === item.id ? null : item.id)}
                  >
                    {item.note ? "Edit note" : "Add note"}
                  </button>
                  {openNoteId === item.id ? (
                    <KeepNoteEditor
                      id={`note-${encodeURIComponent(item.id)}`}
                      item={item}
                      placeholder="Why is this worth returning to?"
                      showShortcutHint
                    />
                  ) : null}
                </div>
              </li>
            )}
          />
        )}
        <KeepUndo />
      </section>
    </main>
  );
}
