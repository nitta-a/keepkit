import { FavoriteButton, type FavoriteInput, type FavoriteItem, useFavorites } from "@keepkit/core";
import { useState } from "react";

const content: FavoriteInput[] = [
  {
    resourceId: "react-2025",
    title: "React documentation",
    url: "https://react.dev",
    image:
      "https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=800&q=80",
  },
  {
    resourceId: "pnpm-workspaces",
    title: "pnpm workspaces",
    url: "https://pnpm.io/workspaces",
    image:
      "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80",
  },
  {
    resourceId: "web-platform",
    title: "Web platform baseline",
    url: "https://web.dev/baseline",
    image:
      "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80",
  },
];

export function App() {
  const { favorites, isLoading, updateFavorite, removeFavorite } = useFavorites();
  const [comments, setComments] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, string>>({});

  function commentFor(item: FavoriteInput): string | undefined {
    const comment = comments[item.resourceId]?.trim();
    return comment ? comment : undefined;
  }

  function beginEditing(item: FavoriteItem) {
    setEditing((current) => ({ ...current, [item.id]: item.comment ?? "" }));
  }

  async function saveComment(item: FavoriteItem) {
    await updateFavorite(item.id, { comment: editing[item.id]?.trim() || undefined });
    setEditing((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });
  }

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">@keepkit/core · demo</p>
        <h1>A small place for things worth returning to.</h1>
        <p className="lede">
          This app uses only Keepkit&apos;s public API. Add a note, reload the page, and your
          collection will still be here in localStorage.
        </p>
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
          {content.map((item) => (
            <article className="content-card" key={item.resourceId}>
              <img src={item.image} alt="" />
              <div className="card-body">
                <h3>{item.title}</h3>
                <a href={item.url} target="_blank" rel="noreferrer">
                  {item.url}
                </a>
                <label className="comment-field">
                  <span>Optional note</span>
                  <input
                    value={comments[item.resourceId] ?? ""}
                    onChange={(event) =>
                      setComments((current) => ({
                        ...current,
                        [item.resourceId]: event.target.value,
                      }))
                    }
                    placeholder="Why save this?"
                  />
                </label>
                <FavoriteButton
                  className="favorite-button"
                  item={{ ...item, comment: commentFor(item) }}
                  activeLabel="Saved ✓"
                  inactiveLabel="Add to favorites"
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
            <h2 id="collection-heading">Favorites</h2>
          </div>
          <span className="count">{favorites.length} saved</span>
        </div>

        {isLoading ? (
          <p className="empty-state">Restoring your favorites…</p>
        ) : favorites.length === 0 ? (
          <p className="empty-state">Nothing here yet. Save a resource above.</p>
        ) : (
          <ul className="favorite-list">
            {favorites.map((item) => {
              const draft = editing[item.id];
              return (
                <li className="favorite-row" key={item.id}>
                  <div className="favorite-info">
                    <a href={item.url} target="_blank" rel="noreferrer">
                      <strong>{item.title || item.resourceId}</strong>
                      <span>{item.url || item.resourceId}</span>
                    </a>
                    {draft === undefined ? (
                      <button
                        className="text-button"
                        onClick={() => beginEditing(item)}
                        type="button"
                      >
                        {item.comment ? `“${item.comment}” · Edit note` : "Add a note"}
                      </button>
                    ) : (
                      <div className="edit-comment">
                        <input
                          value={draft}
                          onChange={(event) =>
                            setEditing((current) => ({ ...current, [item.id]: event.target.value }))
                          }
                          aria-label={`Edit note for ${item.title || item.resourceId}`}
                        />
                        <button onClick={() => void saveComment(item)} type="button">
                          Save note
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    className="remove-button"
                    aria-label={`Remove ${item.title || item.resourceId}`}
                    onClick={() => void removeFavorite(item.id)}
                    type="button"
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
