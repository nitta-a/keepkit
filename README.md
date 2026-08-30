# keepkit

Keepkit is a small React favorites package with a replaceable storage adapter. The workspace
contains the publishable package in `packages/keepkit` and a real usage example in `apps/demo`.

## Development

```bash
pnpm install
pnpm dev
```

The demo supports saving resources with an optional comment, viewing saved favorites, editing
comments, removing favorites, and restoring the collection after a reload.

## Package usage

```tsx
import {
  FavoriteButton,
  FavoriteProvider,
  LocalStorageAdapter,
  useFavorites
} from "@keepkit/core";

const storage = new LocalStorageAdapter({ key: "my-app:favorites" });

function Article({ id, title, url }: { id: string; title: string; url: string }) {
  return <FavoriteButton item={{ resourceId: id, title, url }} />;
}

function Favorites() {
  const { favorites, isFavorite } = useFavorites();
  return <p>{favorites.length} saved · {isFavorite("article-123") ? "saved" : "not saved"}</p>;
}

export function App() {
  return (
    <FavoriteProvider storage={storage}>
      <Article id="article-123" title="Example article" url="/articles/123" />
      <Favorites />
    </FavoriteProvider>
  );
}
```

`FavoriteStorage` is the boundary for future API, Supabase, or Firebase adapters. The package
does not include authentication or server persistence.

## Verification

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

`packages/keepkit` publishes only its built `dist` output through the package `exports` map.
