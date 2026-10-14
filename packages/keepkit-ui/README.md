# @keepkit/ui

[日本語](#日本語) | [English](#english)

Release: v0.28.10

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

`reorderable`を有効にすると、明示ソートがない一覧は「手動順序」になります。日時ソートと切り替えられ、並べ替えは手動順序かつ`pinnedFirst`なしの場合に有効です。表示中の項目が占める位置だけを入れ替え、別ページ・非表示項目の位置を保ちます。矢印操作は即時保存、Escapeはつかみ状態の解除、保存済み順序の取り消しは5秒間のUndoで行います。

独自の`KeepSortSelect`では`onManualSort`を渡すと`value="manual"`を選択できます。既存の`onValueChange(value, sort)`は日時ソートのみを通知します。手動順序のURL／Saved Viewでは`sort`を省略します。URL同期が有効ならURLが優先し、`sort`省略は以前の日時ソートを解除します。通常の一覧は更新日時降順へ戻ります。同じURLへの遷移は省略し、履歴は既定でpush、`urlSync={{ history: "replace" }}`でreplaceを選べます。

未分類のSaved Viewは`organization.collection="unassigned"`で保存します。利用側の関数`query.filter`は引き続き保存できません。`revealRequest`はローカルの検索・タグ・整理・日時条件を解除しますが、利用側の固定`targetType`・`filter`で除外される対象には`excluded`を返します。`creatable`と`slots.toolbarEnd`は併用できます。

### 記事・リンクを再訪する一覧

記事向け表示は選択式です。既存の既定表示は変わりません。

`linkTarget="card"`の既定表示は通常の画像・静的内容をリンクにし、タグ・操作ボタン・編集フォームをリンク外に置きます。カスタム画像や`children`／`render`全体は自動で包みません。compoundの`Title`はタイトルリンクを提供します。カスタム構成では`KeepItemCard.Link`で非対話コンテンツを明示的に包みます。URL、router用`linkComponent`、外部リンク属性、利用不能状態、`trackOpen`／`onOpen`はrootと共有します。内側の`Title`は静的表示、`Content`は自動タグなしです。独自のボタンやフォームもリンク外に置いてください。

```tsx
<keep.Collection
  layout="list"
  query={{ sort: { by: "savedAt", direction: "desc" }, pinnedFirst: true }}
  features={{ bulkActions: true, pin: true, archive: true }}
  bulkActionsVariant="inline"
  itemCardProps={{ presentation: "reading", href: (item) => item.meta.url, trackOpen: true }}
/>
```

```tsx
<KeepItemCard item={item} href={item.meta.url} trackOpen>
  <KeepItemCard.Link>
    <KeepItemCard.Media />
    <KeepItemCard.Content />
  </KeepItemCard.Link>
  <KeepItemCard.Tags />
  <KeepItemCard.Actions />
</KeepItemCard>
```

`presentation="reading"`はタイトル、URLの保存元、コレクション名、メモ、タグ、保存・訪問情報を表示します。画像は`getImageProps`で指定した場合だけ表示します。保存トグルは既定で非表示、編集・メモ・訪問情報は表示され、既存の表示フラグで上書きできます。`href`と`trackOpen`は明示指定です。編集は300msの自動保存と「完了」を使い、失敗時は下書きを残します。

`bulkActionsVariant="inline"`は記事行で選択します。全選択は現在ページだけで、検索・フィルター・ページ・表示先を変えると選択を解除します。失敗した一括操作は選択を保持します。既定の`separate`は従来の選択用一覧を維持します。

独自の行には`KeepListSelection`（`selectedIds: readonly string[]`、`onSelectedIdsChange`、任意の`disabled`）を`KeepList.selection`に渡せます。`KeepList`と`KeepCollection`の`renderItem(item, state, selection?)`の第三引数は`KeepItemSelection`（`checked`、`onCheckedChange`、任意の`disabled`）で、`KeepItemCheckbox`にそのまま渡せます。従来の二引数コールバックも使用できます。

`KeepBulkActions`と`KeepCollection`の`confirmRemoval`は既定falseです。`confirmRemoval`を渡すと削除前に件数と確定・取消を表示します。確認開始時の全選択ID（ページ外も含む）を固定し、選択・scope・検索条件の変更で取り消します。失敗時は再試行でき、成功後は既存のUndoで復元できます。render-propsには`removalConfirmation`、`requestRemoval()`、`confirmRemoval()`、`cancelRemoval()`を公開します。

```tsx
<keep.Collection confirmRemoval features={{ bulkActions: true }} />
```

### fallback分岐を確認・復元する

`KeepFallbackRecovery`はProviderと独立した画面です。対象adapterの`recovery`を明示的に渡します。表示や比較では書き込まず、競合の保存元を選び、所属などの変更プレビューを確認して適用します。未解決の競合や不整合がある場合は適用できません。データが変わった場合は再比較が必要です。「反映待ち」は修復内容が保存済みなので、再提出せず再試行します。

```tsx
import { createBrowserStorageAdapter, KeepFallbackRecovery, KeepUiProvider } from "@keepkit/ui";

const storage = createBrowserStorageAdapter({ key: "my-app:items", scope: { userId: "alice" } });

function RecoveryScreen() {
  return storage.recovery ? (
    <KeepUiProvider locale="ja">
      <KeepFallbackRecovery recovery={storage.recovery} />
    </KeepUiProvider>
  ) : null;
}
```

`SyncStorageAdapter`経由では状態のみ表示します。修復は同期開始前のstandalone local adapterで行ってください。修復前バックアップは自動削除しません。導入時は旧実装のタブをすべて更新し、[Coreガイド](../keepkit/README.md)の保存制約を確認してください。

`KeepQuickEditor.closeLabel`で終了ボタンの文言を指定できます。`debounceMs={0}`による手動保存は維持され、完了・Escapeでの終了は保存成功後に行います。単独のエディターはTabを閉じ込めません。

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
`KeepItemCard`の`Link` / `Media` / `Content` / `Title` / `Tags` / `Actions`でカードの一部だけを組み替えることもできます。

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

With `reorderable`, collections without an explicit sort default to manual order. The selector also supports date sorting; reorder handles appear only in manual order without `pinnedFirst`. Reordering replaces only the positions occupied by visible items, preserving other pages and hidden items. Arrow keys save immediately, Escape releases the grabbed item, and the existing five-second Undo restores committed order.

Pass `onManualSort` to a standalone `KeepSortSelect` to enable `value="manual"`. Its existing `onValueChange(value, sort)` callback still handles date sorts only. Manual-order URLs and Saved Views omit `sort`. Enabled URL synchronization takes priority; omitted `sort` clears the previous date sort. Ordinary collections fall back to newest update first. Unchanged URLs do not navigate; history defaults to push, with replace available through `urlSync={{ history: "replace" }}`.

Unassigned Saved Views use `organization.collection="unassigned"`. Host-supplied function filters remain unserializable. `revealRequest` clears local search, tag, organization, and date constraints, but returns `excluded` for items rejected by the host's fixed `targetType` or `filter`. `creatable` and `slots.toolbarEnd` can be combined.

### Revisit articles and links

The reading presentation is opt-in; existing defaults are preserved.

Default `linkTarget="card"` links ordinary media and static content, placing tags, actions, and edit forms outside the link. Custom images and entire `children` / `render` bodies are no longer automatically wrapped. Compound `Title` supplies a title link. Use `KeepItemCard.Link` to explicitly wrap non-interactive content in custom layouts. It shares the root URL, router `linkComponent`, external-link attributes, availability, and `trackOpen` / `onOpen`. Nested `Title` is static, and `Content` omits automatic tags. Keep custom buttons and forms outside the link as well.

```tsx
<keep.Collection
  layout="list"
  query={{ sort: { by: "savedAt", direction: "desc" }, pinnedFirst: true }}
  features={{ bulkActions: true, pin: true, archive: true }}
  bulkActionsVariant="inline"
  itemCardProps={{ presentation: "reading", href: (item) => item.meta.url, trackOpen: true }}
/>
```

```tsx
<KeepItemCard item={item} href={item.meta.url} trackOpen>
  <KeepItemCard.Link>
    <KeepItemCard.Media />
    <KeepItemCard.Content />
  </KeepItemCard.Link>
  <KeepItemCard.Tags />
  <KeepItemCard.Actions />
</KeepItemCard>
```

`presentation="reading"` shows the title, URL source, collection name, note, tags, and save/open information. Images appear only when supplied through `getImageProps`. It hides the save toggle and shows editing, notes, and activity by default; existing visibility flags override these defaults. Supply `href` and `trackOpen` explicitly. Editing uses 300ms autosave and Done, retaining the draft on failure.

`bulkActionsVariant="inline"` selects items on their article rows. Select-all targets only the current page; changes to search, filters, page, or view clear selection. Failed bulk operations retain selection. The default `separate` preserves the existing selection list.

For custom rows, pass `KeepListSelection` (`selectedIds: readonly string[]`, `onSelectedIdsChange`, optional `disabled`) to `KeepList.selection`. The third argument of `KeepList` and `KeepCollection`'s `renderItem(item, state, selection?)` is `KeepItemSelection` (`checked`, `onCheckedChange`, optional `disabled`), ready to spread onto `KeepItemCheckbox`. Existing two-argument callbacks still work.

`KeepBulkActions` and `KeepCollection` default `confirmRemoval` to false. Enable it to show the count and confirm/cancel controls before removal. Confirmation freezes all selected IDs, including selections outside the page, and cancels when selection, scope, or query changes. Failures can be retried; successful removal retains existing Undo. Render props expose `removalConfirmation`, `requestRemoval()`, `confirmRemoval()`, and `cancelRemoval()`.

```tsx
<keep.Collection confirmRemoval features={{ bulkActions: true }} />
```

### Compare and restore fallback branches

`KeepFallbackRecovery` works independently of KeepProvider and accepts the target adapter's `recovery` explicitly. Display and inspection do not write. Select the source for conflicting records, review dependent membership changes, then apply. Unresolved conflicts or inconsistent relationships prevent applying. Changed data requires another inspection. A pending projection means the repair is already saved: retry it instead of submitting it again.

```tsx
import { createBrowserStorageAdapter, KeepFallbackRecovery, KeepUiProvider } from "@keepkit/ui";

const storage = createBrowserStorageAdapter({ key: "my-app:items", scope: { userId: "alice" } });

function RecoveryScreen() {
  return storage.recovery ? (
    <KeepUiProvider locale="en">
      <KeepFallbackRecovery recovery={storage.recovery} />
    </KeepUiProvider>
  ) : null;
}
```

A `SyncStorageAdapter` exposes status only. Repair through a standalone local adapter before starting sync. Pre-repair backups are not automatically deleted. Refresh all older tabs when adopting this journal, and check the storage limits in the [Core guide](../keepkit/README.md).

Use `KeepQuickEditor.closeLabel` to customize the completion button. Manual saving with `debounceMs={0}` is preserved; completion and Escape close only after successful saving. Standalone editors do not trap Tab.

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
Rearrange card regions through `KeepItemCard.Link` / `Media` / `Content` / `Title` / `Tags` / `Actions`.

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
