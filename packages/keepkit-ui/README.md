# @keepkit/ui

[日本語](#日本語) | [English](#english)

## 日本語

Reactアプリケーション向けの標準利用パッケージです。`@keepkit/core`を内包し、Provider、保存ボタン、検索・ソート・ページング付きの一覧を少ないコードで構成できます。

```bash
pnpm add @keepkit/ui
```

```tsx
import { createBrowserStorageAdapter, createKeepKit } from "@keepkit/ui";

type ArticleMeta = { title: string; url: string };
const keep = createKeepKit<ArticleMeta>({
  storage: createBrowserStorageAdapter({ key: "articles" }),
  locale: "ja-JP",
  labels: { save: "保存", remove: "削除" },
});

function SavedArticles() {
  return (
    <keep.Provider>
      <keep.Collection
        query={{ targetType: "article" }}
        renderItem={(item) => <keep.Button item={{ id: item.id, targetType: item.targetType, meta: item.meta }} />}
      />
    </keep.Provider>
  );
}
```

`keep.Collection`は検索、ソート、ページング、loading / empty / error、ARIA live通知を標準で提供します。検索は既定で300msデバウンスされます。`features={{ tagFilter: true, bulkActions: true }}`でタグフィルターと一括操作も有効にできます。個別の`KeepList`、`KeepSearchInput`、`KeepSortSelect`、`KeepPagination`、`KeepItemCheckbox`、`KeepTagEditor`などは高度なレイアウト用に利用できます。`KeepBulkActions`はrender propsで操作UIを差し替えられます。

一覧のqueryは次の形式に統一されています。

```tsx
const query = {
  targetType: "article",
  tags: ["read"],
  search: { query: "react", mode: "and" as const },
  sort: { by: "updatedAt" as const, direction: "desc" as const },
  pagination: { page: 1, pageSize: 20 },
};
```

保存操作にはID付きの最小入力を渡します。保存・更新時刻はKeepKitが管理します。

```tsx
const article = { id: "article-123", targetType: "article", meta: { title, url } };
const item = keep.useItem(article);
```

高度なフレームワーク中立APIは`@keepkit/core/core`、低レベルのReact APIは`@keepkit/core/react`、ストレージ実装は`@keepkit/core/storage`から利用できます。

## English

The standard React package for KeepKit. It includes `@keepkit/core` and provides a single typed provider, save button, and searchable/sortable/paginated collection workflow.

```bash
pnpm add @keepkit/ui
```

```tsx
import { createBrowserStorageAdapter, createKeepKit } from "@keepkit/ui";

type ArticleMeta = { title: string; url: string };
const keep = createKeepKit<ArticleMeta>({
  storage: createBrowserStorageAdapter({ key: "articles" }),
  labels: { save: "Save", remove: "Remove" },
});

function SavedArticles() {
  return (
    <keep.Provider>
      <keep.Collection query={{ targetType: "article" }} />
    </keep.Provider>
  );
}
```

`keep.Collection` includes search, sorting, pagination, loading/empty/error states, and polite live announcements. Search is debounced by 300ms by default. Enable `features={{ tagFilter: true, bulkActions: true }}` for tag filtering and bulk operations. Use the individual `KeepList`, `KeepSearchInput`, `KeepSortSelect`, `KeepPagination`, `KeepItemCheckbox`, and `KeepTagEditor` primitives when you need a custom layout. `KeepBulkActions` supports render props for replacing its operation UI.

Collection queries use one canonical shape: `targetType`, `tags`, `search`, `sort`, `pagination`, `filter`, and `savedBetween`. Saved item inputs contain only `id`, `meta`, `targetType`, `note`, and `tags`; KeepKit owns persistence timestamps.

Framework-neutral APIs remain available from `@keepkit/core/core`, low-level React bindings from `@keepkit/core/react`, and storage adapters from `@keepkit/core/storage`.
