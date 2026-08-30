# keepkit

[日本語](#日本語) | [English](#english)

## 日本語

keepkitは、Reactアプリケーションに保存・コレクション機能を追加するための、ヘッドレスで非同期処理を前提としたツールキットです。保存先は差し替え可能なストレージアダプターとして切り離されています。

このリポジトリには、保存プリミティブ（`@keepkit/core`）、React UIパーツ（`@keepkit/ui`）、実際の利用例（`apps/demo`）が含まれています。

### 主な機能

- `KeepProvider` による保存アイテムの状態管理
- スタイルを持たないアクセシブルな `KeepButton`
- `KeepButton asChild` の ARIA 属性・Space／Enter 操作の自動補完
- `useKeepItem` による保存・切り替え・削除・ノート更新
- `useKeepShortcut` によるキーボードショートカット連携
- `useKeepList` による一覧取得、タグ絞り込み・ソート、一括削除・タグ更新
- ブラウザの `localStorage` に対応した `LocalStorageAdapter`
- `StorageAdapter` を実装したAPI・Supabase・Firebaseなどへの拡張
- `mergeKeepItems` によるローカルアイテムとリモートアイテムの統合
- `tags` による分類、`useKeepList` のタグ絞り込み・ソート
- `createKeepKit<TMeta>()` によるアプリ全体の型推論、`KeepButton` の render props / `asChild`
- `createStorageAdapter` による同期・非同期Adapterの接続
- `createBrowserStorageAdapter` の IndexedDB-first／localStorage fallback
- `SyncStorageAdapter` の永続キュー自動再開とオンライン復帰同期
- version付きJSONバックアップのエクスポート・インポート
- `KeepButton` の多言語ARIAラベルと、保存アイテムのメタデータ再取得・状態検出
- `@keepkit/ui` による一覧、検索、ソート、ページネーション、タグ編集、一括操作UI
- `KeepUiProvider` によるUI全体の多言語ラベル管理と `KeepAnnouncements` の成功通知

### インストール

```bash
pnpm add @keepkit/core @keepkit/ui
```

### 使い方

```tsx
import { LocalStorageAdapter } from "@keepkit/core/storage";
import { KeepButton, KeepProvider, createKeepKit, useKeepList } from "@keepkit/core/react";

const storage = new LocalStorageAdapter({ key: "my-app:items" });

function Article({ id, title, url }: { id: string; title: string; url: string }) {
  return (
    <KeepButton
      item={{
        id,
        targetType: "article",
        meta: { title, url },
      }}
    />
  );
}

function SavedItems() {
  const { items } = useKeepList({ targetType: "article" });
  return <p>{items.length}件保存されています</p>;
}

export function App() {
  return (
    <KeepProvider storage={storage}>
      <Article id="article-123" title="Example article" url="/articles/123" />
      <SavedItems />
    </KeepProvider>
  );
}
```

`StorageAdapter<TMeta>` が保存処理の境界です。独自アダプターでは `getAll`、`set`、`remove`、`clear` を実装します。認証機能やサーバーへの永続化機能はパッケージに含まれません。ブラウザの既定 adapter は IndexedDB を優先し、利用できない場合は localStorage に切り替えます。主／代替 adapter を自分で構成する場合は `FallbackStorageAdapter` を利用できます。

アプリ固有のメタデータ型を一度だけ指定する場合は、型付きキットを生成できます。

```tsx
type ProductMeta = { title: string; price: number };
const { KeepProvider, KeepButton, useKeepItem, useKeepList } = createKeepKit<ProductMeta>();
```

`KeepButton` は `children={(state) => ...}` の render props、または `asChild` と単一の子要素で既存のデザインシステムに接続できます。保存・削除・ノート更新・エラーは `KeepProvider` のイベントハンドラーで購読できます。

```tsx
const { useKeepShortcut } = createKeepKit<ArticleMeta>();
useKeepShortcut({ key: "k", modifier: "meta", id, itemPayload });
```

一覧では、`tags` で利用可能なタグを取得し、`removeBatch` と `updateTagsBatch` で一括操作できます。

```tsx
const { items, tags, removeBatch, updateTagsBatch } = useKeepList({
  targetType: "article",
  tag: selectedTag,
  sort: { by: "updatedAt", direction: "desc" },
});
```

検索とページネーションにはクエリ形式のオプションも利用できます。`totalCount` はページング前の件数です。

```tsx
const { items, totalCount } = useKeepList({
  targetType: "product",
  tag: "favorite",
  searchQuery: "keyword",
  sortBy: "savedAt",
  order: "desc",
  limit: 20,
  offset: 0,
});
```

大きなデータや画像を含むメタデータには、`@keepkit/core/storage` の `IndexedDBAdapter` を利用できます。

```tsx
import { IndexedDBAdapter } from "@keepkit/core/storage";

const storage = new IndexedDBAdapter({ databaseName: "my-app", storeName: "saved-items" });
```

保存前後の処理とメタデータ移行は `plugins`、`schemaVersion`、`migrateMeta` で設定できます。

```tsx
const { KeepProvider } = createKeepKit({
  plugins: [{ before: ({ action }) => console.debug("keep", action) }],
  schemaVersion: 2,
  migrateMeta: (meta, fromVersion) => ({ ...(meta as object), migratedFrom: fromVersion }),
});
```

`KeepProvider` は初回読み込みの完了を `isHydrated`、保存・削除中の状態を `isMutating` として公開します。`LocalStorageAdapter` の容量超過や破損データは `KeepStorageQuotaError` / `KeepStorageParseError` などで判別できます。

Next.js App Router などでサーバー側で一覧を取得済みの場合は、`initialItems` に渡すとクライアント adapter の読み込み中も同じ一覧を先に描画できます。クライアント側の最初の refresh 後は adapter の値が正式な状態になります。

フレームワーク中立のコードは `@keepkit/core/core`、React のコンポーネントと hooks は `@keepkit/core/react`、ストレージは `@keepkit/core/storage`、スキーマ処理は `@keepkit/core/schema` からimportします。パッケージルートにはexportがなく、React APIとcore APIは明確に分離されています。

```tsx
import { LocalStorageAdapter } from "@keepkit/core/storage";
import { KeepProvider } from "@keepkit/core/react";

<KeepProvider storage={storage} initialItems={itemsFromServer}>
  <SavedItems />
</KeepProvider>;
```

UIパーツは状態管理とスタイルを持たず、`@keepkit/ui` から個別に利用できます。`KeepUiProvider` の `labels` / `locale` / `labelResolver` でラベルを一元設定し、`KeepSearchInput`、`KeepSortSelect`、`KeepPagination`、`KeepTagEditor`、`KeepBulkActions` を組み合わせられます。`KeepItemCard` の画像は `getImageProps`、`imageComponent`、`renderImage` で差し替えられます。標準の一覧には読み込み中・空・エラー状態と削除操作が含まれます。

```tsx
import { KeepAnnouncements, KeepItemCard, KeepList, KeepNoteEditor, KeepStatus, KeepTagFilter, KeepUiProvider } from "@keepkit/ui";

<KeepUiProvider locale="ja-JP" labels={{ save: "保存", remove: "削除" }}>
  <KeepTagFilter value={selectedTag} onValueChange={setSelectedTag} />
  <KeepList options={{ tag: selectedTag }} renderItem={(item) => <KeepItemCard item={item} />} />
  <KeepNoteEditor item={item} />
  <KeepStatus />
  <KeepAnnouncements />
</KeepUiProvider>
```

データ移行やバックアップには `exportItems(adapter)` と `importItems(adapter, json, { mode: "replace" | "merge" })` を利用できます。結果には `imported` / `failed` 件数が含まれます。

`KeepButton` の標準ラベルは `savedAriaLabel` / `unsavedAriaLabel`、または `getAriaLabel` で翻訳できます。保存対象の再取得には `useKeepItem(id).refreshMetadata` と `isKeepItemMetadataStale`、削除・非公開・期限切れの検出と整理には `revalidateItems` を利用します。詳しい移行手順は [MIGRATION.md](./MIGRATION.md)、Next.js Pages Routerと認証付き同期の実装例は [公式サンプル](./examples/next-pages-router/README.md) を参照してください。

### 開発

```bash
pnpm install
pnpm dev
```

デモでは、記事・商品・求人の保存、保存一覧の表示、ノートの編集、オフライン時のキュー状態、オンライン復帰後の同期を確認できます。

### 検証

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

パッケージは `exports` マップを通じてビルド済みの `dist` のみを公開します。現在の変更内容は [リリースノート](./RELEASE_NOTES.md) を参照してください。

## English

keepkit is a headless, async-first toolkit for adding save-and-collect functionality to React applications. Persistence is isolated behind replaceable storage adapters.

This repository contains the publishable packages in `packages/keepkit` and `packages/keepkit-ui`, plus a real usage example in `apps/demo`.

### Features

- State management for saved items through `KeepProvider`
- A style-free, accessible `KeepButton`
- Automatic ARIA attributes and Space/Enter activation for `KeepButton asChild`
- Save, toggle, remove, and note updates with `useKeepItem`
- Keyboard shortcut integration with `useKeepShortcut`
- Listing, tag filtering/sorting, clearing, and bulk actions with `useKeepList`
- A browser `localStorage` adapter with `LocalStorageAdapter`
- Extensibility through `StorageAdapter` implementations for APIs, Supabase, Firebase, and more
- Local-to-remote item merging with `mergeKeepItems`
- Tag-based organization with filtering and sorting through `useKeepList`
- App-wide type inference through `createKeepKit<TMeta>()`, plus render props / `asChild` for `KeepButton`
- Sync/async adapter composition with `createStorageAdapter`
- IndexedDB-first browser storage with localStorage fallback through `createBrowserStorageAdapter`
- Durable sync queues that resume on startup and flush when connectivity returns
- Versioned JSON backup export and import utilities
- Localized `KeepButton` ARIA labels and saved-item metadata/status revalidation
- Optional `@keepkit/ui` package with list, search, sort, pagination, tag editing, bulk actions, centralized labels, image replacement, and success announcements

### Installation

```bash
pnpm add @keepkit/core @keepkit/ui
```

### Usage

```tsx
import { LocalStorageAdapter } from "@keepkit/core/storage";
import { KeepButton, KeepProvider, createKeepKit, useKeepList } from "@keepkit/core/react";

const storage = new LocalStorageAdapter({ key: "my-app:items" });

function Article({ id, title, url }: { id: string; title: string; url: string }) {
  return (
    <KeepButton
      item={{
        id,
        targetType: "article",
        meta: { title, url },
      }}
    />
  );
}

function SavedItems() {
  const { items } = useKeepList({ targetType: "article" });
  return <p>{items.length} saved</p>;
}

export function App() {
  return (
    <KeepProvider storage={storage}>
      <Article id="article-123" title="Example article" url="/articles/123" />
      <SavedItems />
    </KeepProvider>
  );
}
```

`StorageAdapter<TMeta>` is the persistence boundary. Custom adapters implement `getAll`, `set`, `remove`, and `clear`. Authentication and server persistence are intentionally outside the package. The browser default prefers IndexedDB and switches to localStorage when IndexedDB is unavailable. Use `FallbackStorageAdapter` to compose your own primary and fallback adapters.

To specify an app-specific metadata type once, create a typed kit:

```tsx
type ProductMeta = { title: string; price: number };
const { KeepProvider, KeepButton, useKeepItem, useKeepList } = createKeepKit<ProductMeta>();
```

`KeepButton` supports render props (`children={(state) => ...}`) and `asChild` for connecting an existing design system. Save, remove, note-update, and error events can be observed from `KeepProvider`.

```tsx
const { useKeepShortcut } = createKeepKit<ArticleMeta>();
useKeepShortcut({ key: "k", modifier: "meta", id, itemPayload });
```

The list hook exposes the available `tags`, plus `removeBatch` and `updateTagsBatch` for bulk actions.

```tsx
const { items, tags, removeBatch, updateTagsBatch } = useKeepList({
  targetType: "article",
  tag: selectedTag,
  sort: { by: "updatedAt", direction: "desc" },
});
```

Query-style options also support search and pagination; `totalCount` is reported before pagination.

```tsx
const { items, totalCount } = useKeepList({
  targetType: "product",
  tag: "favorite",
  searchQuery: "keyword",
  sortBy: "savedAt",
  order: "desc",
  limit: 20,
  offset: 0,
});
```

For large metadata or image payloads, use `IndexedDBAdapter` from `@keepkit/core/storage`.

```tsx
import { IndexedDBAdapter } from "@keepkit/core/storage";

const storage = new IndexedDBAdapter({ databaseName: "my-app", storeName: "saved-items" });
```

Configure mutation hooks and metadata migrations with `createKeepKit({ plugins, schemaVersion, migrateMeta })`.

`KeepProvider` exposes `isHydrated` for the initial client-side load and `isMutating` while writes are pending. Storage failures can be distinguished with errors such as `KeepStorageQuotaError` and `KeepStorageParseError`.

When a server loader already has the saved list, pass it as `initialItems` to render the same snapshot while the client adapter hydrates. After the first refresh, the adapter becomes the source of truth. Framework-neutral and RSC server code can import `@keepkit/core/core`; React bindings, storage, and schema helpers are available from `@keepkit/core/react`, `@keepkit/core/storage`, and `@keepkit/core/schema`. The package root has no export, so the React and core APIs remain explicitly separated.

```tsx
import { LocalStorageAdapter } from "@keepkit/core/storage";
import { KeepProvider } from "@keepkit/core/react";

<KeepProvider storage={storage} initialItems={itemsFromServer}>
  <SavedItems />
</KeepProvider>;
```

The optional UI package is state-aware but style-free, so each component can be used independently. Use `KeepUiProvider` with `labels`, `locale`, and `labelResolver` for centralized localization. It also provides search, sort, pagination, tag editing, bulk actions, image replacement, and success announcements.

```tsx
import { KeepAnnouncements, KeepItemCard, KeepList, KeepNoteEditor, KeepStatus, KeepTagFilter, KeepUiProvider } from "@keepkit/ui";

<KeepUiProvider>
  <KeepTagFilter value={selectedTag} onValueChange={setSelectedTag} />
  <KeepList options={{ tag: selectedTag }} renderItem={(item) => <KeepItemCard item={item} />} />
  <KeepNoteEditor item={item} />
  <KeepStatus />
  <KeepAnnouncements />
</KeepUiProvider>
```

Use `exportItems(adapter)` and `importItems(adapter, json, { mode: "replace" | "merge" })` for portable backups and migrations. Results include imported and failed counts.

Use `savedAriaLabel` / `unsavedAriaLabel` or `getAriaLabel` to localize the default `KeepButton` label. Use `useKeepItem(id).refreshMetadata` and `isKeepItemMetadataStale` to fetch current metadata, and `revalidateItems` to detect or clean up deleted, private, or expired targets. See the [migration guide](./MIGRATION.md) and the [official Pages Router example](./examples/next-pages-router/README.md) for upgrade and authenticated-sync guidance.

### Development

```bash
pnpm install
pnpm dev
```

The demo covers articles, products, and jobs, plus notes, offline queue status, and synchronization after connectivity returns.

### Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

The package publishes only its built `dist` output through the `exports` map. See the [release notes](./RELEASE_NOTES.md) for the current changes.
