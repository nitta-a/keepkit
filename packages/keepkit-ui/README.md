# @keepkit/ui

[日本語](#日本語) | [English](#english)

## 日本語

KeepKitのReact向けUIパッケージです。`@keepkit/core`を含み、保存ボタンと一覧を共通のProviderで利用できます。
CSSは任意で、標準テーマでも独自のスタイルでも使えます。React 18以降に対応します。

### はじめる

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

`createKeepKit<TMeta>()`は同じメタデータ型のコンポーネントとhooksを返します。
`locale`で組み込みラベルを切り替え、`labels`で文言を上書きできます。16言語に対応しています。

### 一覧を拡張する

`keep.Collection`は検索・ソート・ページング、読み込み中・空・エラー表示を標準で備えます。
検索は既定で300msデバウンスされます。必要な機能を`features`で有効にします。

```tsx
export function Library() {
  return (
    <keep.Provider>
      <keep.Collection
        query={{ targetType: "article" }}
        layout="auto"
        urlSync
        features={{ tagFilter: true, collectionFilter: true, bulkActions: true, savedViews: true }}
        itemCardProps={{ href: (item) => item.meta.url }}
      />
      <keep.Backup />
    </keep.Provider>
  );
}
```

`layout`は`list`、`grid`、`compact`、コンテナ幅に追従する`auto`から選べます。
`urlSync`は検索・タグ・ソート・ページをURLと戻る／進むに同期します。
Next.js Pages Routerでは`createNextPagesRouterAdapter(router)`を`urlAdapter`に渡します。

### 用途別のコンポーネント

| 用途 | API |
| --- | --- |
| 未分類の整理・検索条件の保存 | `keep.Inbox`、`keep.SavedViews` |
| コレクション管理 | `keep.CollectionManager` |
| 画面一式 | `keep.Workspace`。`basic` / `standard` / `management` / `sync`プリセット |
| メモ・タグ・保存直後の編集 | `KeepNoteEditor`、`KeepTagEditor`、`KeepSavePopover`、`KeepQuickEditor` |
| 再発見・巡回・並び替え | `KeepRediscoveryPanel`、`KeepTourBar`、`KeepFloatingTour`、`KeepReorderableList` |
| 復元・保存対象の状態・同期状態 | `KeepUndo`、`keep.Backup`、`KeepItemStatusBadge`、`KeepSyncStatusBanner`、`KeepSyncRecoveryDialog` |

各コンポーネントは同じProvider内に配置します。`renderItem`、slots、render propsで独自レイアウトへ組み込めます。
`KeepItemCard`の`Media` / `Content` / `Title` / `Tags` / `Actions`でカードの一部だけを組み替えることもできます。

### テーマとアクセシビリティ

通常は`@keepkit/ui/theme.css`を読み込みます。Tailwind CSS v4／shadcnではグローバルCSSに次を記載します。

```css
@import "tailwindcss";
@import "@keepkit/ui/tailwind.css";
```

Providerの`theme="ocean"`や`mode="light" | "dark" | "system"`、`density`、`radius`で見た目を調整できます。
`--keep-*`変数で上書きでき、Tailwind連携ではホストの色変数を継承します。

操作はキーボード・ARIAラベル・状態通知に対応します。`data-state`、`data-loading`、`data-disabled`は独自CSSでも利用できます。
カード一覧は矢印キー・Home・Endで移動でき、`trackOpen`を指定したカードでのみ開封を記録します。

### 保存と同期

ブラウザー内保存はIndexedDB優先・localStorage fallbackです。端末間同期にはアプリ側のdriver・認証・サーバーAPIが必要です。
バックアップは保存アイテム・コレクション定義・所属を含み、閲覧履歴・鑑賞記録・進行位置は含みません。
**Replace（置換）は既存データを置き換え、ロールバックしません。**

保存・同期の契約は[Core README](../keepkit/README.md)、デモとNext.jsサンプルは[リポジトリREADME](../../README.md)を参照してください。

## English

React UI for KeepKit, including `@keepkit/core`, with a shared provider for save buttons and collections.
CSS is optional: use the supplied theme or your own styles. Requires React 18 or later.

### Getting started

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

`createKeepKit<TMeta>()` returns components and hooks sharing your metadata type.
Use `locale` for built-in labels and `labels` for overrides. Sixteen languages are supported.

### Extend the collection

`keep.Collection` includes search, sorting, pagination, and loading, empty, and error states.
Search is debounced by 300ms by default. Enable additional controls through `features`.

```tsx
export function Library() {
  return (
    <keep.Provider>
      <keep.Collection
        query={{ targetType: "article" }}
        layout="auto"
        urlSync
        features={{ tagFilter: true, collectionFilter: true, bulkActions: true, savedViews: true }}
        itemCardProps={{ href: (item) => item.meta.url }}
      />
      <keep.Backup />
    </keep.Provider>
  );
}
```

Choose `list`, `grid`, `compact`, or container-responsive `auto` for `layout`.
`urlSync` synchronizes search, tags, sorting, and pagination with the URL and browser history.
For Next.js Pages Router, pass `createNextPagesRouterAdapter(router)` as `urlAdapter`.

### Components by task

| Task | API |
| --- | --- |
| Inbox and saved queries | `keep.Inbox`, `keep.SavedViews` |
| Collection management | `keep.CollectionManager` |
| Complete screen | `keep.Workspace` with `basic` / `standard` / `management` / `sync` presets |
| Notes, tags, and editing after saving | `KeepNoteEditor`, `KeepTagEditor`, `KeepSavePopover`, `KeepQuickEditor` |
| Rediscovery, tours, and ordering | `KeepRediscoveryPanel`, `KeepTourBar`, `KeepFloatingTour`, `KeepReorderableList` |
| Undo, backup, availability, and sync | `KeepUndo`, `keep.Backup`, `KeepItemStatusBadge`, `KeepSyncStatusBanner`, `KeepSyncRecoveryDialog` |

Place components under the same provider. Use `renderItem`, slots, or render props for custom layouts.
Rearrange card regions through `KeepItemCard.Media` / `Content` / `Title` / `Tags` / `Actions`.

### Theme and accessibility

Import `@keepkit/ui/theme.css` for the standard theme. For Tailwind CSS v4 or shadcn, add these global CSS imports:

```css
@import "tailwindcss";
@import "@keepkit/ui/tailwind.css";
```

Configure the provider with `theme="ocean"`, `mode="light" | "dark" | "system"`, `density`, and `radius`.
Override `--keep-*` variables as needed; the Tailwind integration inherits host color variables.

Controls support keyboard interaction, ARIA labels, and live announcements. Use `data-state`, `data-loading`, and `data-disabled` in custom CSS.
Card lists support arrow keys, Home, and End. Cards record opens only when `trackOpen` is enabled.

### Persistence and sync

Browser storage prefers IndexedDB with a localStorage fallback. Cross-device sync needs your app's driver, authentication, and server APIs.
Backups include saved items, collection definitions, and memberships; history, viewing records, and progress are excluded.
**Replace imports overwrite existing data and do not roll back.**

See the [Core README](../keepkit/README.md) for persistence contracts and the [repository README](../../README.md) for demos and Next.js examples.
