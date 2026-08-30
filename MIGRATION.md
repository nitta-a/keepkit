# KeepKit migration guide

## v0.6.0

### 日本語

- `KeepSearchInput`は既定で300msデバウンスします。従来の即時通知が必要な場合は`debounceMs={0}`を指定してください。
- `KeepItemCheckbox`を個別の選択UIとして利用できます。`KeepBulkActions`はrender propsで操作部分を差し替えられます。
- `KeepPagination`は番号ボタンを描画し、現在ページに`aria-current="page"`を設定します。
- `KeepKitProvider`は`KeepAnnouncements`を自動で内包するため、同じ通知を手動で追加している場合は重複配置を避けてください。
- Next.js App Routerでは、Server Componentから`initialItems`をclient boundaryの`KeepKitProvider`へ渡す構成を`examples/next-app-router`で確認できます。

### English

- `KeepSearchInput` now debounces changes by 300ms by default. Set `debounceMs={0}` when immediate notifications are required.
- Use `KeepItemCheckbox` as a standalone selection primitive. `KeepBulkActions` supports render props for replacing its operation UI.
- `KeepPagination` renders numbered buttons and marks the current page with `aria-current="page"`.
- `KeepKitProvider` now includes `KeepAnnouncements`; avoid mounting a duplicate announcer when migrating manually composed providers.
- For Next.js App Router, see `examples/next-app-router` for passing `initialItems` from a Server Component to a client-bound `KeepKitProvider`.

## 日本語

v0.5.0はv0.4.xからの破壊的変更を含みます。通常のReactアプリケーションは`@keepkit/ui`を標準入口にしてください。

### import

```tsx
// v0.4
import { KeepButton, KeepProvider } from "@keepkit/core/react";
import { LocalStorageAdapter } from "@keepkit/core/storage";

// v0.5
import { createBrowserStorageAdapter, createKeepKit } from "@keepkit/ui";
```

`@keepkit/core`のadvanced APIを直接使う場合は、これまでどおり`@keepkit/core/core`、`@keepkit/core/react`、`@keepkit/core/storage`、`@keepkit/core/schema`を利用します。

### factory

```tsx
// v0.4
const kit = createKeepKit<ArticleMeta>();
const { KeepProvider, KeepButton, useKeepList } = kit;

// v0.5
const kit = createKeepKit<ArticleMeta>({ storage });
const { Provider, Button, Collection, useList } = kit;
```

### item hook

```tsx
// v0.4
useKeepItem(id, { meta, targetType });

// v0.5
useKeepItem({ id, meta, targetType });
```

`KeepItemInput`には`id`が必須です。`savedAt`と`updatedAt`は渡さず、KeepKitに生成させます。

### list query

`KeepListOptions`は`KeepListQuery`に変わりました。`tag`、`searchQuery`、`sortBy`、`order`、`limit`、`offset`、`filterFn`は廃止されています。

```tsx
useKeepList({
  targetType: "article",
  tags: ["read"],
  search: { query: "react", mode: "and" },
  sort: { by: "updatedAt", direction: "desc" },
  pagination: { page: 1, pageSize: 20 },
  filter: (item) => item.meta.visible === true,
});
```

UIの`KeepList`、`KeepTagFilter`、`KeepBulkActions`の`options` / `listOptions`も`query`へ変わりました。複数部品の状態管理が不要な場合は`KeepCollection`を利用してください。

### shortcut

```tsx
useKeepShortcut({
  key: "k",
  modifier: "meta",
  item: { id, targetType: "article", meta },
});
```

### Provider

`KeepUiProvider`と`KeepProvider`は、通常は`KeepKitProvider`またはfactoryの`Provider`に置き換えます。同期adapterの構成は引き続き`StorageAdapter` / `RemoteSyncDriver`の境界で行います。

## English

v0.5.0 includes breaking changes from v0.4.x. Standard React applications should use `@keepkit/ui` as the default entry point.

- `createKeepKit` now returns `Provider`, `Button`, `Collection`, `useContext`, `useItem`, `useList`, and `useShortcut`.
- `useKeepItem(id, payload)` is now `useKeepItem({ id, ...payload })`.
- `useKeepShortcut({ id, itemPayload })` is now `useKeepShortcut({ item })`.
- `KeepListOptions` is now `KeepListQuery`.
- Legacy query fields `tag`, `searchQuery`, `sortBy`, `order`, `limit`, `offset`, and `filterFn` were removed.
- UI `options` and `listOptions` props are now `query`.
- `KeepCollection` combines search, sorting, pagination, status feedback, and optional tag/bulk controls.
- `KeepItemInput` no longer contains persistence timestamps; KeepKit generates them.

For low-level usage, continue to import framework-neutral APIs from `@keepkit/core/core`, React bindings from `@keepkit/core/react`, storage adapters from `@keepkit/core/storage`, and schemas from `@keepkit/core/schema`.
