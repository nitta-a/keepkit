# keepkit

[日本語](#日本語) | [English](#english)

## 日本語

KeepKitは、Reactアプリケーションに保存・コレクション機能を追加するための、非同期・ローカルファーストなツールキットです。v0.6.0では、`@keepkit/ui`のUIプリミティブを機能別に整理し、検索・ページング・一括操作・アクセシビリティ通知を強化しました。

### インストール

```bash
pnpm add @keepkit/ui
```

### 標準利用

```tsx
import { createBrowserStorageAdapter, createKeepKit } from "@keepkit/ui";

type ArticleMeta = { title: string; url: string; image?: string };
const keep = createKeepKit<ArticleMeta>({
  storage: createBrowserStorageAdapter({ key: "my-app:items" }),
  locale: "ja-JP",
  labels: { save: "保存", remove: "削除" },
});

function Article({ id, title, url }: { id: string; title: string; url: string }) {
  return <keep.Button item={{ id, targetType: "article", meta: { title, url } }} />;
}

function SavedArticles() {
  return <keep.Collection query={{ targetType: "article" }} />;
}

export function App() {
  return (
    <keep.Provider>
      <Article id="article-123" title="Example article" url="/articles/123" />
      <SavedArticles />
    </keep.Provider>
  );
}
```

`keep.Collection`は検索、ソート、ページング、タグフィルター、一括操作、loading / empty / error状態、ARIA通知を組み合わせて提供します。検索は既定で300msデバウンスされ、追加機能は`features`で有効化できます。

```tsx
<keep.Collection
  query={{ targetType: "article", tags: ["read"] }}
  features={{ tagFilter: true, bulkActions: true }}
  pageSize={20}
  renderItem={(item) => <keep.Button item={{ id: item.id, targetType: item.targetType, meta: item.meta }} />}
/>
```

### APIの基本方針

- 保存入力は`{ id, meta, targetType?, note?, tags? }`だけです。時刻や正規化はKeepKitが管理します。
- 一覧条件は`query`に統一し、`search`、`sort`、`pagination`を内包します。
- 型付きAPIは`createKeepKit<TMeta>()`で生成します。`Provider`、`Button`、`Collection`、`useItem`、`useList`、`useShortcut`を同じ型で利用できます。
- `KeepSearchInput`、`KeepSortSelect`、`KeepPagination`、`KeepItemCheckbox`、`KeepTagEditor`、`KeepBulkActions`は個別に利用でき、`KeepBulkActions`はrender propsで操作UIを差し替えられます。
- `@keepkit/ui`は標準React向けの入口です。フレームワーク中立の処理は`@keepkit/core/core`、低レベルReact APIは`@keepkit/core/react`、adapterは`@keepkit/core/storage`から利用できます。
- Next.js App RouterのServer Component / client boundary構成は`examples/next-app-router`、Pages Router構成は`examples/next-pages-router`を参照してください。

### ストレージと同期

`createBrowserStorageAdapter`はIndexedDBを優先し、利用できない場合はlocalStorageへ切り替えます。サーバー同期が必要な場合は`SyncStorageAdapter`と`RemoteSyncDriver`を組み合わせます。認証やAPIクライアントはアプリ側で用意します。

```tsx
import { SyncStorageAdapter } from "@keepkit/ui";

const storage = new SyncStorageAdapter({ local, remote: { push: (operation) => api.sync(operation) } });
```

バックアップには`exportItems(adapter)` / `importItems(adapter, json, { mode: "replace" | "merge" })`を利用できます。

### v0.4.xからの移行

- `createKeepKit`の戻り値は`KeepProvider` / `KeepButton` / `useKeepList`ではなく、`Provider` / `Button` / `useList`です。
- `useKeepItem(id, payload)`は`useKeepItem({ id, meta, targetType?, note?, tags? })`に変わりました。
- `useKeepShortcut`は`id`と`itemPayload`ではなく`item`を受け取ります。
- `KeepListOptions`は`KeepListQuery`に変わり、`searchQuery`、`sortBy`、`order`、`limit`、`offset`、`tag`は廃止しました。
- UIコンポーネントの`options` / `listOptions`は`query`に変わりました。
- UI利用時は`@keepkit/core`と`@keepkit/ui`の個別Provider構成ではなく、`@keepkit/ui`の`KeepKitProvider`またはfactoryの`Provider`を利用します。

詳細な移行内容は[MIGRATION.md](./MIGRATION.md)、変更履歴は[RELEASE_NOTES.md](./RELEASE_NOTES.md)を参照してください。

### 開発と検証

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## English

KeepKit is an async, local-first toolkit for adding saved collections to React applications. In v0.6.0, `@keepkit/ui` organizes its primitives by feature and strengthens search, pagination, bulk operations, and accessibility feedback.

### Installation

```bash
pnpm add @keepkit/ui
```

### Standard usage

```tsx
import { createBrowserStorageAdapter, createKeepKit } from "@keepkit/ui";

type ArticleMeta = { title: string; url: string };
const keep = createKeepKit<ArticleMeta>({
  storage: createBrowserStorageAdapter({ key: "my-app:items" }),
  labels: { save: "Save", remove: "Remove" },
});

export function App() {
  return (
    <keep.Provider>
      <keep.Button item={{ id: "article-123", targetType: "article", meta: { title: "Example", url: "/article" } }} />
      <keep.Collection query={{ targetType: "article" }} />
    </keep.Provider>
  );
}
```

`keep.Collection` combines search, sorting, pagination, optional tag filtering and bulk actions, loading/empty/error states, and accessible live announcements. Search is debounced by 300ms by default; enable optional behavior with `features`.

Saved inputs contain only `id`, `meta`, `targetType`, `note`, and `tags`; persistence timestamps and normalization are handled by KeepKit. Collection queries use the canonical `query` shape with `search`, `sort`, and `pagination`.

The typed factory returns `Provider`, `Button`, `Collection`, `useItem`, `useList`, and `useShortcut`. `KeepSearchInput`, `KeepSortSelect`, `KeepPagination`, `KeepItemCheckbox`, `KeepTagEditor`, and `KeepBulkActions` are also available as standalone primitives. Use `@keepkit/core/core` for framework-neutral primitives, `@keepkit/core/react` for low-level React bindings, and `@keepkit/core/storage` for adapters.

See `examples/next-app-router` for the Server Component/client boundary pattern and `examples/next-pages-router` for the Pages Router integration.

See [MIGRATION.md](./MIGRATION.md) for the v0.4 migration and [RELEASE_NOTES.md](./RELEASE_NOTES.md) for the complete changelog.

### Development and validation

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```
