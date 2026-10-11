# KeepKit

[日本語](#日本語) | [English](#english)

## 日本語

KeepKitは、Reactアプリに保存・コレクション機能を追加する、非同期・ローカルファーストのツールキットです。

### できること

- 保存ボタンと、検索・ソート・ページング付きの一覧
- タグ・メモ・コレクション・ピン留め・アーカイブによる整理
- Inbox、保存した検索条件、閲覧記録を使った再発見
- ブラウザー内の永続化、JSONバックアップ、独自サーバーとの同期

### デモアプリ

`apps/demo`の実画面です。サンプルを保存し、タグ・コレクション・ピン留めを設定しています。
Inbox・未読・アーカイブへの切り替え、検索・ソート・タグフィルター、グリッド／リスト表示で保存したリンクを整理できます。

![保存済みリンクの一覧。検索、ソート、タグフィルター、コレクション、ピン留め、Inbox・未読・アーカイブのナビゲーション](docs/images/demo-library.jpg)

<details>
<summary>リンク保存・バックアップの画面を見る</summary>

タイトル・URL・メモ・保存先コレクションを入力してリンクを保存できます。

![タイトル、URL、メモ、コレクションを指定するリンク保存フォーム](docs/images/demo-save-link.jpg)

データはブラウザー内に保存されます。JSONでバックアップを出力し、Merge（結合）／Replace（置換）で読み込めます。

![ブラウザー内の保存とJSONバックアップの出力・読み込み画面](docs/images/demo-backup.jpg)

</details>

### はじめる

React 18以降を使うアプリにインストールします。

```bash
pnpm add @keepkit/ui
```

```tsx
import "@keepkit/ui/theme.css";
import { createBrowserStorageAdapter, createKeepKit } from "@keepkit/ui";

type ArticleMeta = { title: string; url: string };
const keep = createKeepKit<ArticleMeta>({
  storage: createBrowserStorageAdapter({ key: "my-app:items" }),
  locale: "ja",
});

export function App() {
  return (
    <keep.Provider>
      <keep.Button
        item={{
          id: "article-123",
          targetType: "article",
          meta: { title: "Example article", url: "/articles/123" },
        }}
      />
      <keep.Collection query={{ targetType: "article" }} />
    </keep.Provider>
  );
}
```

`createKeepKit<TMeta>()`で、保存するメタデータの型をProvider・コンポーネント・hooksで共有できます。
一覧は検索・ソート・ページングと、読み込み中・空・エラーの表示を備えています。

### パッケージと使い分け

| パッケージ | 用途 |
| --- | --- |
| [@keepkit/ui](./packages/keepkit-ui/README.md) | React向けUI。標準テーマ、Tailwind対応、独自レイアウトへの組み込み |
| [@keepkit/core](./packages/keepkit/README.md) | フレームワーク中立の処理、React hooks、ストレージ・同期・バックアップ |

`createBrowserStorageAdapter`はIndexedDBを優先し、使えない場合はlocalStorageに切り替えます。
端末間の同期には`SyncStorageAdapter`とアプリ側の`RemoteSyncDriver`が必要です。
認証とサーバーAPIはアプリ側で実装します。

JSONバックアップは保存アイテム・コレクション定義・所属を含みます。閲覧履歴・鑑賞記録・進行位置は含みません。
Replace（置換）は対象範囲の既存データを置き換え、失敗時のロールバックはありません。

### サンプル

- [リンクライブラリ](./apps/demo): 保存・整理・検索・バックアップ
- [コレクション画面](./apps/collection-demo): Workspaceや表示レイアウトの組み合わせ
- [Next.js App Router](./examples/next-app-router): Server Componentとクライアント境界
- [Next.js Pages Router](./examples/next-pages-router): SSR・認証付きAPIとの接続
- [認証付き同期](./examples/authenticated-sync): トークン取得・オフラインキュー・ユーザー切り替え

### 開発

Node.js 22.22.2以降、pnpm 11.24.0を使用します。

```bash
pnpm install --frozen-lockfile
pnpm dev
```

デモだけを起動する場合は`pnpm --filter @keepkit/demo dev`を使います。
検証はビルド後に実行します。

```bash
pnpm build
pnpm typecheck
pnpm check
pnpm test
pnpm package:check
```

変更履歴は[RELEASE_NOTES.md](./RELEASE_NOTES.md)を参照してください。

## English

KeepKit is an async, local-first toolkit for adding save and collection features to React apps.

### Features

- Save buttons and searchable, sortable, paginated lists
- Tags, notes, collections, pinning, and archiving
- Inbox, Saved Views, and rediscovery through activity tracking
- Browser persistence, JSON backups, and integration with your own sync server

### Demo app

These are actual screens from `apps/demo`, with sample items saved, tagged, assigned to collections, and pinned.
Organize saved links with Inbox, Unread, and Archive views, search, sorting, tag filters, and grid/list layouts.

![Saved links with search, sorting, tag filters, collections, pinning, and navigation for Inbox, Unread, and Archive](docs/images/demo-library.jpg)

<details>
<summary>View the link-saving and backup screens</summary>

Save a link with a title, URL, note, and destination collection.

![Link-saving form with title, URL, note, and collection fields](docs/images/demo-save-link.jpg)

Data stays in the browser. Export a JSON backup and import it using Merge or Replace mode.

![Browser-local storage and JSON backup export and import controls](docs/images/demo-backup.jpg)

</details>

### Getting started

Install in an app using React 18 or later.

```bash
pnpm add @keepkit/ui
```

```tsx
import "@keepkit/ui/theme.css";
import { createBrowserStorageAdapter, createKeepKit } from "@keepkit/ui";

type ArticleMeta = { title: string; url: string };
const keep = createKeepKit<ArticleMeta>({
  storage: createBrowserStorageAdapter({ key: "my-app:items" }),
  locale: "en",
});

export function App() {
  return (
    <keep.Provider>
      <keep.Button
        item={{
          id: "article-123",
          targetType: "article",
          meta: { title: "Example article", url: "/articles/123" },
        }}
      />
      <keep.Collection query={{ targetType: "article" }} />
    </keep.Provider>
  );
}
```

`createKeepKit<TMeta>()` shares your metadata type across the provider, components, and hooks.
The collection includes search, sorting, pagination, and loading, empty, and error states.

### Packages

| Package | Purpose |
| --- | --- |
| [@keepkit/ui](./packages/keepkit-ui/README.md) | React UI with an optional theme, Tailwind support, and custom layouts |
| [@keepkit/core](./packages/keepkit/README.md) | Framework-neutral logic, React hooks, storage, sync, and backups |

`createBrowserStorageAdapter` prefers IndexedDB and falls back to localStorage.
Cross-device sync requires `SyncStorageAdapter` and an application-provided `RemoteSyncDriver`.
Your app owns authentication and server APIs.

JSON backups include saved items, collection definitions, and memberships. History, viewing records, and progress are excluded.
Replace imports overwrite the target data and do not roll back on failure.

### Examples

- [Link library](./apps/demo): saving, organization, search, and backups
- [Collection screen](./apps/collection-demo): Workspace and layout combinations
- [Next.js App Router](./examples/next-app-router): Server Components and client boundaries
- [Next.js Pages Router](./examples/next-pages-router): SSR and authenticated APIs
- [Authenticated sync](./examples/authenticated-sync): tokens, offline queues, and account changes

### Development

Use Node.js 22.22.2 or later and pnpm 11.24.0.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

To run only the demo, use `pnpm --filter @keepkit/demo dev`.
Build before running validation:

```bash
pnpm build
pnpm typecheck
pnpm check
pnpm test
pnpm package:check
```

See [RELEASE_NOTES.md](./RELEASE_NOTES.md) for the changelog.
