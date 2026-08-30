# keepkit

[日本語](#日本語) | [English](#english)

## 日本語

keepkitは、Reactアプリケーションに保存・コレクション機能を追加するための、ヘッドレスで非同期処理を前提としたツールキットです。保存先は差し替え可能なストレージアダプターとして切り離されています。

このリポジトリには、公開用パッケージ（`packages/keepkit`）と、実際の利用例（`apps/demo`）が含まれています。

### 主な機能

- `KeepProvider` による保存アイテムの状態管理
- スタイルを持たないアクセシブルな `KeepButton`
- `useKeepItem` による保存・切り替え・削除・ノート更新
- `useKeepList` による一覧取得、絞り込み、クリア
- ブラウザの `localStorage` に対応した `LocalStorageAdapter`
- `StorageAdapter` を実装したAPI・Supabase・Firebaseなどへの拡張
- `mergeKeepItems` によるローカルアイテムとリモートアイテムの統合
- `tags` による分類、`useKeepList` のタグ絞り込み・ソート
- `createKeepKit<TMeta>()` によるアプリ全体の型推論、`KeepButton` の render props / `asChild`

### インストール

```bash
pnpm add @keepkit/core
```

### 使い方

```tsx
import {
  KeepButton,
  KeepProvider,
  LocalStorageAdapter,
  createKeepKit,
  useKeepList,
} from "@keepkit/core";

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

`StorageAdapter<TMeta>` が保存処理の境界です。独自アダプターでは `getAll`、`set`、`remove`、`clear` を実装します。認証機能やサーバーへの永続化機能はパッケージに含まれません。`LocalStorageAdapter` はSSR環境からimportできますが、ブラウザのストレージが利用できない場合は空の一覧として動作します。

アプリ固有のメタデータ型を一度だけ指定する場合は、型付きキットを生成できます。

```tsx
type ProductMeta = { title: string; price: number };
const { KeepProvider, KeepButton, useKeepItem, useKeepList } = createKeepKit<ProductMeta>();
```

`KeepButton` は `children={(state) => ...}` の render props、または `asChild` と単一の子要素で既存のデザインシステムに接続できます。保存・削除・ノート更新・エラーは `KeepProvider` のイベントハンドラーで購読できます。

### 開発

```bash
pnpm install
pnpm dev
```

デモでは、任意のノート付きアイテムの保存、保存一覧の表示、ノートの編集、削除、再読み込み後の復元を確認できます。

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

This repository contains the publishable package in `packages/keepkit` and a real usage example in `apps/demo`.

### Features

- State management for saved items through `KeepProvider`
- A style-free, accessible `KeepButton`
- Save, toggle, remove, and note updates with `useKeepItem`
- Listing, filtering, and clearing items with `useKeepList`
- A browser `localStorage` adapter with `LocalStorageAdapter`
- Extensibility through `StorageAdapter` implementations for APIs, Supabase, Firebase, and more
- Local-to-remote item merging with `mergeKeepItems`
- Tag-based organization with filtering and sorting through `useKeepList`
- App-wide type inference through `createKeepKit<TMeta>()`, plus render props / `asChild` for `KeepButton`

### Installation

```bash
pnpm add @keepkit/core
```

### Usage

```tsx
import {
  KeepButton,
  KeepProvider,
  LocalStorageAdapter,
  createKeepKit,
  useKeepList,
} from "@keepkit/core";

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

`StorageAdapter<TMeta>` is the persistence boundary. Custom adapters implement `getAll`, `set`, `remove`, and `clear`. Authentication and server persistence are intentionally outside the package. `LocalStorageAdapter` is safe to import in SSR environments; when browser storage is unavailable, it behaves as an empty collection.

To specify an app-specific metadata type once, create a typed kit:

```tsx
type ProductMeta = { title: string; price: number };
const { KeepProvider, KeepButton, useKeepItem, useKeepList } = createKeepKit<ProductMeta>();
```

`KeepButton` supports render props (`children={(state) => ...}`) and `asChild` for connecting an existing design system. Save, remove, note-update, and error events can be observed from `KeepProvider`.

### Development

```bash
pnpm install
pnpm dev
```

The demo covers saving items with optional notes, viewing the saved collection, editing notes, removing items, and restoring the collection after a reload.

### Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

The package publishes only its built `dist` output through the `exports` map. See the [release notes](./RELEASE_NOTES.md) for the current changes.
