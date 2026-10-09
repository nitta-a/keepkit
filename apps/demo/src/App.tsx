import type { KeepItem, KeepListQuery } from "@keepkit/core/core";
import {
  KeepBackup,
  KeepBulkActions,
  KeepButton,
  KeepCollection,
  KeepCollectionManager,
  type KeepCollectionRevealRequest,
  type KeepCollectionRevealResult,
  KeepEmptyState,
  KeepItemCard,
  KeepNoteEditor,
  KeepQuickEditor,
  KeepUndo,
  useKeepCollections,
  useKeepList,
} from "@keepkit/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DemoMeta } from "./main";
import { SaveLink } from "./SaveLink";
import { type LibraryView, useAppView } from "./useAppView";

type Content = KeepItem<DemoMeta> & { kindLabel: string };
type AppProps = {
  revealRequest?: KeepCollectionRevealRequest;
  onRevealResult?: (result: KeepCollectionRevealResult) => void;
};

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

const viewLabels: Record<LibraryView, string> = {
  all: "All saves",
  inbox: "Inbox",
  pinned: "Pinned",
  unread: "Unread",
  archive: "Archive",
  collections: "Manage collections",
  settings: "Storage and settings",
};
const viewDescriptions: Record<LibraryView, string> = {
  all: "A little less searching. A little more finding what matters.",
  inbox: "New links land here. Give them a collection when you're ready.",
  pinned: "Your go-to references, always close at hand.",
  unread: "Make time for the things you saved. Opening a link moves it out of this view.",
  archive: "Finished for now, kept for whenever you need them again.",
  collections: "Make room for your projects, plans, and passing interests.",
  settings: "Your library belongs to this browser. Keep a backup to take it with you.",
};

export function App({ revealRequest, onRevealResult }: AppProps) {
  const {
    isOnline,
    shortcutLabel,
    view,
    setView,
    selectedCollection,
    setSelectedCollection,
    isCaptureOpen,
    setIsCaptureOpen,
    isManaging,
    setIsManaging,
    areFiltersOpen,
    setAreFiltersOpen,
  } = useAppView();
  const [layout, setLayout] = useState<"grid" | "compact">("grid");
  const [pendingReveal, setPendingReveal] = useState<{ request: KeepCollectionRevealRequest; local: boolean }>();
  const externalRevealId = useRef<number | undefined>(undefined);
  const revealSequence = useRef(0);
  const addButton = useRef<HTMLButtonElement>(null);
  const { items, error, isHydrated } = useKeepList<DemoMeta>({ archiveScope: "all" });
  const collections = useKeepCollections<DemoMeta>();
  const collectionLabels = Object.fromEntries(collections.map(({ id, name }) => [id, name]));
  const activeItems = items.filter((item) => item.archived !== true);
  const counts = {
    all: activeItems.length,
    inbox: activeItems.filter((item) => !item.collectionId).length,
    pinned: activeItems.filter((item) => item.pinned).length,
    unread: activeItems.filter((item) => item.lastOpenedAt === undefined).length,
    archive: items.length - activeItems.length,
  };
  const query = useMemo<KeepListQuery<DemoMeta>>(
    () => ({
      archived: view === "archive",
      pinnedFirst: true,
      filter: (item) => {
        if (selectedCollection) return item.collectionId === selectedCollection;
        if (view === "inbox") return !item.collectionId;
        if (view === "pinned") return item.pinned === true;
        if (view === "unread") return item.lastOpenedAt === undefined;
        return true;
      },
    }),
    [view, selectedCollection],
  );

  function navigate(next: LibraryView, collectionId?: string) {
    setView(next);
    setSelectedCollection(collectionId);
    setIsManaging(false);
    setAreFiltersOpen(false);
  }

  useEffect(() => {
    if (!revealRequest || !isHydrated || externalRevealId.current === revealRequest.requestId) return;
    externalRevealId.current = revealRequest.requestId;
    const target = items.find((item) => item.id === revealRequest.itemId);
    setView(target?.archived ? "archive" : "all");
    setSelectedCollection(undefined);
    setIsManaging(false);
    setPendingReveal({ request: revealRequest, local: false });
  }, [revealRequest, isHydrated, items, setView, setSelectedCollection, setIsManaging]);

  function closeCapture() {
    setIsCaptureOpen(false);
    addButton.current?.focus();
  }

  function revealSaved(itemId: string) {
    const target = items.find((item) => item.id === itemId);
    navigate(target?.archived ? "archive" : "all");
    closeCapture();
    revealSequence.current += 1;
    setPendingReveal({ request: { requestId: -revealSequence.current, itemId }, local: true });
  }

  function finishReveal(result: KeepCollectionRevealResult) {
    setPendingReveal(undefined);
    if (pendingReveal?.local) {
      window.requestAnimationFrame(() => {
        const card = document.getElementById(`saved-item-${encodeURIComponent(result.itemId)}`);
        card?.scrollIntoView?.({ block: "nearest" });
        card?.focus();
      });
      return;
    }
    onRevealResult?.(result);
  }

  const title = selectedCollection ? (collectionLabels[selectedCollection] ?? selectedCollection) : viewLabels[view];
  const isLibrary = view !== "settings" && view !== "collections";
  const currentReveal = pendingReveal?.request;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#library-main">
        Skip to library
      </a>
      <aside className="app-sidebar">
        <button className="brand" type="button" onClick={() => navigate("all")}>
          <span className="brand-mark">
            <Icon name="bookmark" />
          </span>
          <span>
            keepkit<span className="brand-subtitle">A place for later</span>
          </span>
        </button>
        <p className="sidebar-caption">YOUR LIBRARY</p>
        <nav className="nav-group" aria-label="Library">
          {(["all", "inbox", "pinned", "unread", "archive"] as const).map((name) => (
            <button
              className="nav-button"
              type="button"
              key={name}
              aria-label={viewLabels[name]}
              data-active={view === name && !selectedCollection}
              aria-current={view === name && !selectedCollection ? "page" : undefined}
              onClick={() => navigate(name)}
            >
              <Icon name={name} />
              <span>{viewLabels[name]}</span>
              <span className="nav-count" aria-hidden="true">
                {counts[name]}
              </span>
            </button>
          ))}
        </nav>
        <div className="sidebar-collections">
          <p className="sidebar-caption">COLLECTIONS</p>
          <nav className="nav-group" aria-label="Collections">
            {collections.map((collection) => (
              <button
                className="nav-button"
                type="button"
                key={collection.id}
                aria-label={collection.name}
                data-active={selectedCollection === collection.id}
                aria-current={selectedCollection === collection.id ? "page" : undefined}
                onClick={() => navigate("all", collection.id)}
              >
                <span className="collection-dot" aria-hidden="true" />
                <span>{collection.name}</span>
                <span className="nav-count">
                  {activeItems.filter((item) => item.collectionId === collection.id).length}
                </span>
              </button>
            ))}
            {!collections.length ? <p className="sidebar-empty">Give your saves a little structure.</p> : null}
            <button
              className="nav-button"
              type="button"
              data-active={view === "collections"}
              aria-current={view === "collections" ? "page" : undefined}
              onClick={() => navigate("collections")}
            >
              <Icon name="plus" />
              <span>Manage collections</span>
            </button>
          </nav>
        </div>
        <footer className="sidebar-footer">
          <button
            className="nav-button"
            type="button"
            data-active={view === "settings"}
            aria-current={view === "settings" ? "page" : undefined}
            onClick={() => navigate("settings")}
          >
            <Icon name="settings" />
            <span>Storage and settings</span>
          </button>
          <div className="local-status" role="status">
            <span className="status-dot" aria-hidden="true" />
            <span>
              Saved in this browser<small>{isOnline ? "Available offline, too" : "Offline · you can still save"}</small>
            </span>
          </div>
        </footer>
      </aside>

      <main className="workspace" id="library-main" tabIndex={-1}>
        <header className="workspace-header">
          <p className="breadcrumbs">
            Personal library <span aria-hidden="true">/</span> {title}
          </p>
          <div className="header-actions">
            <span className="demo-badge">DEMO</span>
            <span className="avatar" aria-hidden="true">
              K
            </span>
          </div>
        </header>
        <div className="page-heading">
          <div>
            <p className="eyebrow">KEEP THE GOOD STUFF</p>
            <h1>{title}</h1>
            <p className="page-description">
              {selectedCollection ? "Everything you've gathered for this collection." : viewDescriptions[view]}
            </p>
          </div>
          <button
            ref={addButton}
            className="primary-button"
            type="button"
            aria-expanded={isCaptureOpen}
            aria-controls="capture-panel"
            onClick={() => setIsCaptureOpen(!isCaptureOpen)}
          >
            <Icon name="plus" /> Add a link <kbd>{shortcutLabel}</kbd>
          </button>
        </div>

        {isCaptureOpen ? (
          <section className="capture-panel" id="capture-panel" aria-label="Add a link">
            <SaveLink onSaved={revealSaved} onCancel={closeCapture} />
          </section>
        ) : null}
        {error ? (
          <p role="alert">{error instanceof Error ? error.message : "Your library could not be updated."}</p>
        ) : null}

        {isLibrary ? (
          <>
            {view === "all" && !selectedCollection ? (
              <section className="library-summary" aria-label="Library overview">
                <button
                  className="summary-card"
                  type="button"
                  aria-label={`${counts.all} things worth keeping`}
                  onClick={() => navigate("all")}
                >
                  <Icon name="all" />
                  <span>
                    <strong>{counts.all}</strong>
                    <small>things worth keeping</small>
                  </span>
                </button>
                <button
                  className="summary-card"
                  type="button"
                  aria-label={`${counts.unread} waiting to be explored`}
                  onClick={() => navigate("unread")}
                >
                  <Icon name="unread" />
                  <span>
                    <strong>{counts.unread}</strong>
                    <small>waiting to be explored</small>
                  </span>
                </button>
                <button
                  className="summary-card"
                  type="button"
                  aria-label={`${counts.pinned} always within reach`}
                  onClick={() => navigate("pinned")}
                >
                  <Icon name="pinned" />
                  <span>
                    <strong>{counts.pinned}</strong>
                    <small>always within reach</small>
                  </span>
                </button>
              </section>
            ) : null}
            <section className="library-section" aria-labelledby="collection-heading">
              <div className="section-heading">
                <h2 id="collection-heading">
                  {selectedCollection ? "In this collection" : view === "all" ? "Your saves" : title}
                </h2>
                <span className="section-note">
                  {view === "archive" ? "Restore any item when you need it" : "Save now. Come back inspired."}
                </span>
              </div>
              <KeepCollection<DemoMeta>
                key={`${view}:${selectedCollection ?? ""}`}
                className="demo-collection"
                id="collection-filters"
                data-filters-open={areFiltersOpen ? "true" : "false"}
                data-managing={isManaging ? "true" : "false"}
                layout={layout}
                toolbarLayout="grouped"
                loadingCount={3}
                pageSize={12}
                query={query}
                collectionLabels={collectionLabels}
                features={{ tagFilter: true }}
                {...(view === "archive" ? { activeFilters: null } : {})}
                {...(currentReveal ? { revealRequest: currentReveal, onRevealResult: finishReveal } : {})}
                slots={{
                  toolbarEnd: (state) => (
                    <>
                      <button
                        className="secondary-button"
                        type="button"
                        aria-expanded={areFiltersOpen}
                        aria-controls="collection-filters"
                        onClick={() => setAreFiltersOpen(!areFiltersOpen)}
                      >
                        <Icon name="filter" />
                        {areFiltersOpen ? "Hide filters" : "Filter"}
                      </button>
                      <fieldset className="view-switch">
                        <legend className="visually-hidden">View layout</legend>
                        <button
                          className="icon-button"
                          type="button"
                          aria-label="Grid view"
                          aria-pressed={layout === "grid"}
                          onClick={() => setLayout("grid")}
                        >
                          <Icon name="all" />
                        </button>
                        <button
                          className="icon-button"
                          type="button"
                          aria-label="List view"
                          aria-pressed={layout === "compact"}
                          onClick={() => setLayout("compact")}
                        >
                          <Icon name="list" />
                        </button>
                      </fieldset>
                      <button
                        className="text-button"
                        type="button"
                        disabled={!isManaging && !state.items.length}
                        aria-expanded={isManaging}
                        aria-controls="collection-manager"
                        onClick={() => setIsManaging(!isManaging)}
                      >
                        {isManaging ? "Done managing" : "Manage items"}
                      </button>
                      {isManaging ? (
                        <div className="collection-manager" id="collection-manager">
                          <p>Select from the current results. Removed items can be restored with Undo.</p>
                          <KeepBulkActions<DemoMeta>
                            query={{
                              archiveScope: "all",
                              filter: (item) => state.items.some((visible) => visible.id === item.id),
                            }}
                            selectionScope="query"
                            onCompleted={() => setIsManaging(false)}
                          />
                        </div>
                      ) : null}
                    </>
                  ),
                }}
                empty={
                  <div className="empty-onboarding">
                    <span className="onboarding-icon">
                      <Icon name="bookmark" />
                    </span>
                    <KeepEmptyState
                      title="Nothing here yet"
                      description="Articles to read, ideas to explore, things to compare. Give them a home."
                    />
                    <button className="primary-button" type="button" onClick={() => setIsCaptureOpen(true)}>
                      <Icon name="plus" />
                      Add your first link
                    </button>
                  </div>
                }
                renderItem={(item) => (
                  <SavedItem
                    key={item.id}
                    item={item}
                    collectionLabels={collectionLabels}
                    collectionIds={collections.map((collection) => collection.id)}
                  />
                )}
              />
              <KeepUndo />
            </section>
            {view === "all" && !selectedCollection ? (
              <section className="sample-section" aria-labelledby="content-heading">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">TRY IT OUT</p>
                    <h2 id="content-heading">A few things worth keeping</h2>
                  </div>
                  <span className="section-note">Example resources · save one to get started</span>
                </div>
                <div className="content-grid">
                  {content.map((entry) => (
                    <article className="content-card" key={entry.id}>
                      <img src={entry.meta.image} alt="" loading="lazy" />
                      <div className="card-body">
                        <span className="type-badge">{entry.kindLabel}</span>
                        <h3>{entry.meta.title}</h3>
                        <p>{entry.meta.description}</p>
                        {entry.meta.price ? <strong className="price">{entry.meta.price}</strong> : null}
                        {entry.meta.company ? (
                          <span className="job-details">
                            {entry.meta.company} · {entry.meta.location} · {entry.meta.salary}
                          </span>
                        ) : null}
                        <a className="resource-link" href={entry.meta.url} target="_blank" rel="noreferrer">
                          Open resource ↗
                        </a>
                        <KeepButton
                          className="favorite-button"
                          item={{
                            id: entry.id,
                            meta: entry.meta,
                            tags: [entry.kindLabel],
                            ...(entry.targetType ? { targetType: entry.targetType } : {}),
                          }}
                          savedLabel="Saved ✓"
                          unsavedLabel="Save for later"
                        />
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
            <p className="reading-tip">
              <Icon name="bookmark" />
              Tip: save to your Inbox first, then add a collection, tags, or a note when you return.
            </p>
          </>
        ) : view === "collections" ? (
          <section className="settings-panel">
            <KeepCollectionManager<DemoMeta>
              title="Your collections"
              description="Create a collection, then use Edit details on a saved item to move it here."
              allowCreate
              allowRename
              allowDelete
              showCounts
              empty="Start with a project, a reading list, or a wishlist."
            />
          </section>
        ) : (
          <section className="settings-panel">
            <h2>Storage and backup</h2>
            <p>This demo stores items in this browser. No account or remote service is connected.</p>
            <p>
              Export a JSON backup to move your library or keep a copy. Merge adds items; Replace replaces the current
              browser data.
            </p>
            <KeepBackup<DemoMeta> />
          </section>
        )}
      </main>
    </div>
  );
}

function SavedItem({
  item,
  collectionLabels,
  collectionIds,
}: {
  item: KeepItem<DemoMeta>;
  collectionLabels: Record<string, string>;
  collectionIds: string[];
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const editor = useRef<HTMLDivElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (noteOpen || detailsOpen) editor.current?.querySelector<HTMLElement>("textarea, input, select")?.focus();
  }, [noteOpen, detailsOpen]);
  const itemKey = encodeURIComponent(item.id);
  const domain = getDomain(item.meta.url);
  return (
    <li className="saved-item">
      <KeepItemCard
        className="saved-card"
        id={`saved-item-${itemKey}`}
        item={item}
        href={item.meta.url}
        collectionLabels={collectionLabels}
        showSaveButton={false}
        trackOpen
        getImageProps={(entry) => (entry.meta.image ? { src: entry.meta.image, alt: "", loading: "lazy" } : undefined)}
      >
        <KeepItemCard.Media
          fallback={
            <div className="link-placeholder">
              <Icon name="bookmark" />
              <span>{domain}</span>
            </div>
          }
        />
        <KeepItemCard.Content>
          <div className="item-meta">
            <span className="type-badge">{item.targetType ?? "Link"}</span>
            <span className="item-domain">{domain}</span>
          </div>
          <KeepItemCard.Title />
          {item.meta.description ? <p className="item-description">{item.meta.description}</p> : null}
          <KeepItemCard.Tags />
          <KeepItemCard.CollectionBadge />
          {item.note ? <blockquote className="saved-note">{item.note}</blockquote> : null}
          <div className="note-disclosure">
            <button
              className="note-toggle"
              type="button"
              aria-expanded={noteOpen}
              aria-controls={`note-${itemKey}`}
              onClick={() => {
                setNoteOpen(!noteOpen);
                setDetailsOpen(false);
              }}
            >
              {item.note ? "Edit note" : "Add note"}
            </button>
            <button
              ref={editButton}
              className="note-toggle"
              type="button"
              aria-expanded={detailsOpen}
              aria-controls={`details-${itemKey}`}
              onClick={() => {
                setDetailsOpen(!detailsOpen);
                setNoteOpen(false);
              }}
            >
              Edit details
            </button>
          </div>
          {noteOpen || detailsOpen ? (
            <div className="item-editor" ref={editor}>
              {noteOpen ? (
                <KeepNoteEditor
                  id={`note-${itemKey}`}
                  item={item}
                  placeholder="Why is this worth returning to?"
                  showShortcutHint
                />
              ) : (
                <KeepQuickEditor
                  id={`details-${itemKey}`}
                  item={item}
                  debounceMs={0}
                  features={{ note: false }}
                  collectionIds={collectionIds}
                  collectionLabels={collectionLabels}
                  onClose={() => {
                    setDetailsOpen(false);
                    editButton.current?.focus();
                  }}
                />
              )}
            </div>
          ) : null}
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
    </li>
  );
}

function getDomain(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "Saved resource";
  }
}

type IconName = LibraryView | "bookmark" | "plus" | "filter" | "list";
function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, string> = {
    bookmark: "M6 3h12v18l-6-4-6 4V3Z",
    all: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    inbox: "M4 4h16l2 13v3H2v-3L4 4Z M2 15h6l2 3h4l2-3h6",
    pinned: "m9 3 6 0 0 5 4 4v2H5v-2l4-4V3Z M12 14v7",
    unread: "M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3V4Z M12 6v16",
    archive: "M3 3h18v4H3z M5 7v14h14V7 M9 11h6",
    collections: "M3 6h7l2 2h9v12H3V6Z",
    settings:
      "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
    plus: "M12 5v14 M5 12h14",
    filter: "M4 6h16 M7 12h10 M10 18h4",
    list: "M8 5h13 M8 12h13 M8 19h13 M3 5h1 M3 12h1 M3 19h1",
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
