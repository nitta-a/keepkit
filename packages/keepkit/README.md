# @keepkit/core

[日本語](#日本語) | [English](#english)

Release: v0.28.9

## 日本語

フレームワーク中立の保存処理と、React向けのProvider・hooksを提供します。
標準の一覧UIが必要な場合は[@keepkit/ui](../keepkit-ui/README.md)を使ってください。記事向けの`presentation="reading"`と行内選択はUIパッケージの追加機能で、Coreの型・保存形式は変更しません。未訪問の判定には既存の`lastOpenedAt`と`recordOpen()`を使います。

### インストールと入口

```bash
pnpm add @keepkit/core
```

| import先 | 用途 |
| --- | --- |
| `@keepkit/core/core` | 型、ストア、検索、コレクション、バックアップなど。Reactへの依存なし |
| `@keepkit/core/react` | `createKeepKit`、`KeepProvider`、`KeepButton`、hooks |
| `@keepkit/core/storage` | localStorage・IndexedDB・fallback・同期adapter |
| `@keepkit/core/schema` | スキーマの解析・検証 |

パッケージルートにはexportがありません。React bindingはReact 18以降に対応します。

### Reactで使う

```tsx
import { createKeepKit } from "@keepkit/core/react";
import { createBrowserStorageAdapter } from "@keepkit/core/storage";

type ArticleMeta = { title: string; url: string };
const keep = createKeepKit<ArticleMeta>({
  storage: createBrowserStorageAdapter({ key: "my-app:items" }),
});
const article = {
  id: "article-123",
  targetType: "article",
  meta: { title: "Example article", url: "/articles/123" },
};

function SavedArticles() {
  const { items, isLoading, error } = keep.useList({ targetType: "article" });
  if (isLoading) return <p>読み込み中…</p>;
  if (error) return <p role="alert">保存一覧を読み込めませんでした。</p>;
  return <ul>{items.map((item) => <li key={item.id}>{item.meta.title}</li>)}</ul>;
}

export function App() {
  return (
    <keep.Provider>
      <keep.Button item={article} />
      <SavedArticles />
    </keep.Provider>
  );
}
```

hooksはProvider内のコンポーネントで呼び出します。
保存入力は`{ id, meta, targetType?, note?, tags?, order? }`が基本です。時刻とタグの正規化はKeepKitが管理します。
`keep.useItem(article)`で保存・解除・メモ更新などを、`keep.useList(query)`で一覧と一括操作を利用できます。

### 主な機能

| 用途 | API |
| --- | --- |
| 検索・絞り込み | `KeepListQuery`の`search`、`tags`、`sort`、`pagination`。Reactなしでは`queryKeepItems` |
| 整理 | archive・pin・`collectionId`、`createInboxQuery`、`useKeepCollections` |
| 複数コレクションへの所属・順序 | `addKeepItemToCollection`、`getKeepCollectionItems`、`reorderKeepCollectionItems`、`removeKeepItemFromCollection` |
| 再発見 | `useKeepItem(item).recordOpen()`、`createRediscoveryQuery`、`useKeepRediscovery` |
| 閲覧履歴・鑑賞記録・進行位置 | `LocalStorageKeepHistoryStorage`、`LocalStorageKeepViewingRecordStorage`、`LocalStorageKeepProgressStorage` |
| 保存対象の再検証 | Providerの`validateItem` / `resolveItem`、`revalidateItems` |

一覧は未アーカイブのアイテムを既定で返します。`archiveScope: "all"`で両方を、`archived: true`でアーカイブを取得できます。
複数コレクションへの所属はアイテムと別に保存され、所属を外しても共有アイテムやメモは残ります。

### 保存・同期・バックアップ

- `createBrowserStorageAdapter`はIndexedDB優先で、localStorageへフォールバックします。`scope`でユーザー／テナントを分離できます。
- `SyncStorageAdapter`と`RemoteSyncDriver`で永続オフラインキュー・再試行・競合処理を組み込みます。定義・所属の同期には、それぞれ`pushCollection` / `pullCollections`、`pushMembership` / `pullMemberships`が必要です。
- 認証方式はアプリ側で管理します。[認証付き同期の例](../../examples/authenticated-sync/README.md)でトークン取得とscope切り替えを確認できます。
- `exportItems(storage)` / `importItems(storage, json, { mode: "merge" })`で保存アイテム・コレクション定義・所属をバックアップ・復元します。閲覧履歴・鑑賞記録・進行位置は含みません。

**Replace（置換）は空のバックアップでも対象範囲を置き換え、ロールバックしません。** 途中失敗は`KeepBackupImportError`の`failedStage`と`applied`で確認できます。スコープ付きadapterは別scopeのデータを変更前に拒否します。

独自の`StorageAdapter`で定義・所属を扱う場合は、`getCollections` / `setCollection` / `removeCollection`と`getCollectionMemberships` / `setCollectionMembership` / `removeCollectionMembership`を実装してください。`clear()`は保存アイテムのみを消去します。

履歴・鑑賞記録・進行位置のlocalStorage書き込みには、ブラウザーでWeb Locks APIが必要です。未対応や保存先が利用できない場合はエラーを返します。SSRで初期化できますが、永続化操作はブラウザー側で行います。
履歴・進行位置のキーはアプリ側でユーザーごとに分け、進行位置の取得には記録と一致する言語・コンテンツ版・音声IDを渡してください。

デモと開発手順は[リポジトリREADME](../../README.md)、変更履歴は[リリースノート](../../RELEASE_NOTES.md)を参照してください。

## English

Framework-neutral persistence primitives and React providers and hooks.
Use [@keepkit/ui](../keepkit-ui/README.md) when you want a ready-made collection UI. Its opt-in `presentation="reading"` and inline selection add UI behavior without changing Core types or storage formats. Unvisited uses the existing `lastOpenedAt` and `recordOpen()` contracts.

### Installation and entry points

```bash
pnpm add @keepkit/core
```

| Import | Purpose |
| --- | --- |
| `@keepkit/core/core` | Types, store, queries, collections, and backups, with no React imports |
| `@keepkit/core/react` | `createKeepKit`, `KeepProvider`, `KeepButton`, and hooks |
| `@keepkit/core/storage` | localStorage, IndexedDB, fallback, and sync adapters |
| `@keepkit/core/schema` | Schema parsing and validation |

The package root has no export. React bindings support React 18 or later.

### React usage

```tsx
import { createKeepKit } from "@keepkit/core/react";
import { createBrowserStorageAdapter } from "@keepkit/core/storage";

type ArticleMeta = { title: string; url: string };
const keep = createKeepKit<ArticleMeta>({
  storage: createBrowserStorageAdapter({ key: "my-app:items" }),
});
const article = {
  id: "article-123",
  targetType: "article",
  meta: { title: "Example article", url: "/articles/123" },
};

function SavedArticles() {
  const { items, isLoading, error } = keep.useList({ targetType: "article" });
  if (isLoading) return <p>Loading…</p>;
  if (error) return <p role="alert">Could not load saved items.</p>;
  return <ul>{items.map((item) => <li key={item.id}>{item.meta.title}</li>)}</ul>;
}

export function App() {
  return (
    <keep.Provider>
      <keep.Button item={article} />
      <SavedArticles />
    </keep.Provider>
  );
}
```

Call hooks inside components under the provider.
The basic save input is `{ id, meta, targetType?, note?, tags?, order? }`; KeepKit manages timestamps and tag normalization.
Use `keep.useItem(article)` for saves, removal, and note updates, and `keep.useList(query)` for lists and bulk operations.

### Main APIs

| Task | API |
| --- | --- |
| Search and filtering | `KeepListQuery.search`, `tags`, `sort`, and `pagination`; `queryKeepItems` without React |
| Organization | Archive, pin, `collectionId`, `createInboxQuery`, and `useKeepCollections` |
| Multiple collections and ordering | `addKeepItemToCollection`, `getKeepCollectionItems`, `reorderKeepCollectionItems`, `removeKeepItemFromCollection` |
| Rediscovery | `useKeepItem(item).recordOpen()`, `createRediscoveryQuery`, and `useKeepRediscovery` |
| History, viewing records, and progress | `LocalStorageKeepHistoryStorage`, `LocalStorageKeepViewingRecordStorage`, `LocalStorageKeepProgressStorage` |
| Source revalidation | Provider `validateItem` / `resolveItem` and `revalidateItems` |

Lists return unarchived items by default. Use `archiveScope: "all"` for both or `archived: true` for archived items.
Memberships are stored separately; removing one leaves the shared item and note intact.

### Storage, sync, and backups

- `createBrowserStorageAdapter` prefers IndexedDB and falls back to localStorage. Use `scope` to isolate users and tenants.
- Combine `SyncStorageAdapter` and `RemoteSyncDriver` for durable offline queues, retries, and conflicts. Definition and membership sync require `pushCollection` / `pullCollections` and `pushMembership` / `pullMemberships`, respectively.
- Authentication belongs to your app. See the [authenticated sync example](../../examples/authenticated-sync/README.md) for tokens and scope changes.
- Use `exportItems(storage)` / `importItems(storage, json, { mode: "merge" })` to back up and restore saved items, collection definitions, and memberships. History, viewing records, and progress are excluded.

**Replace imports overwrite the target data, even with an empty backup, and do not roll back.** Inspect `KeepBackupImportError.failedStage` and `applied` after partial failure. Scoped adapters reject data from another scope before mutation.

Custom `StorageAdapter` implementations need `getCollections` / `setCollection` / `removeCollection` and `getCollectionMemberships` / `setCollectionMembership` / `removeCollectionMembership` to support definitions and memberships. `clear()` clears saved items only.

Browser writes to localStorage history, viewing records, and progress require the Web Locks API. Unsupported locks or unavailable storage produce errors. Construction is SSR-safe; persistent operations run in the browser.
Namespace history and progress keys per account, and pass matching language, content version, and audio ID when reading progress.

See the [repository README](../../README.md) for demos and development, and the [release notes](../../RELEASE_NOTES.md) for changes.
