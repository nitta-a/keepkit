# @keepkit/core

React favorites management with a pluggable `FavoriteStorage` adapter.

```tsx
import { FavoriteButton, FavoriteProvider, LocalStorageAdapter } from "@keepkit/core";

const storage = new LocalStorageAdapter({ key: "my-app:favorites" });

<FavoriteProvider storage={storage}>
  <FavoriteButton
    item={{ resourceId: "article-123", title: "Example article", url: "/articles/123" }}
  />
</FavoriteProvider>;
```

Use `useFavorites()` to read `favorites`, add or update comments, remove items, and check
`isFavorite(resourceId)`. `LocalStorageAdapter` is the default browser adapter and is safe to
import in SSR environments. Implement `FavoriteStorage` to use a server-backed store later.
