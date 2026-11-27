# @keepkit/ui

[日本語](#日本語) | [English](#english)

Release: v0.28.18

## 日本語

KeepKitのReact向けUIパッケージです。`@keepkit/core`を含み、保存ボタンと一覧を共通のProviderで利用できます。
CSSは任意で、標準テーマでも独自のスタイルでも使えます。React 18以降に対応します。

一覧を使わずに保存ボタンだけを追加する場合は、部品の入口を直接importできます。CSSも必要なものだけを読み込みます。コンポーネントは通常どおり同じProviderの中に置いてください。

```tsx
import { KeepButton } from "@keepkit/ui/button";
import "@keepkit/ui/styles/base.css";
import "@keepkit/ui/styles/button.css";
```

[全公開UI部品の入口とgzipサイズ](#component-bundle-sizes)は、部品を1つ使う場合に転送するUIのJS量を比較するための表です。npmで展開したパッケージ全体の容量とは異なります。

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
検索結果が0件のときの「フィルターをクリア」は、アーカイブの表示範囲を維持します。トーストのUndoが失敗した場合はエラーと再試行操作を表示します。カード削除・利用不能項目削除の通知は、Undo期限が切れた場合や別の削除が行われた場合に、古い通知から復元できません。

`KeepArchiveUndo`を同じProvider内に配置すると、直前にアーカイブした1件を復元できます。復元に失敗した場合はエラーを表示し、再試行できます。一括アーカイブは対象外です。`collapsibleFilters`を`KeepCollection`に渡すとフィルターを開閉でき、閉じても条件は維持されます。Saved Viewsは別に表示されます。
保存先やスコープを切り替えると、以前の保存先のアーカイブUndoは解除されます。削除の`KeepUndo`と利用不能項目の一括削除は、保存に失敗した場合にエラーを表示し、操作を再試行できます。削除Undoの再試行は元の有効期限内に限ります。

```tsx
import { KeepArchiveUndo, KeepCollection, KeepProvider } from "@keepkit/ui";

<KeepProvider storage={storage}>
  <KeepCollection collapsibleFilters features={{ archive: true, tagFilter: true }} />
  <KeepArchiveUndo />
</KeepProvider>;
```

`KeepBackup`のMergeはバックアップの項目を既存データに統合し、Replaceは現在のデータを置き換えます。Replace選択時はその旨を表示し、`confirmReplace`を指定すると実行前に確認します。保存場所や同期設定はホストアプリ側で説明してください。

独自の行には`KeepListSelection`（`selectedIds: readonly string[]`、`onSelectedIdsChange`、任意の`disabled`）を`KeepList.selection`に渡せます。`KeepList`と`KeepCollection`の`renderItem(item, state, selection?)`の第三引数は`KeepItemSelection`（`checked`、`onCheckedChange`、任意の`disabled`）で、`KeepItemCheckbox`にそのまま渡せます。従来の二引数コールバックも使用できます。

**行を差し替えたときの契約**（[実装例 / examples](#custom-row-examples)）：

- 通常の一覧では、`renderItem` が `ul` の直接の子を返すため、`<li key={item.id}>` を用意します。組み込みの並べ替えが有効な場合に限り、外側の `li` とドラッグハンドルはKeepKitが描画するので、中身だけを返します。
- 矢印キー・Home・Endで移動させるには、各行に1つ `data-keepkit="card"` を付け、ホスト部品から実DOMへ渡します。`tabIndex` は一覧が管理します。キー操作はカード自身にフォーカスがあるときだけ有効で、内部の入力欄からは移動しません。カード上の `aria-hidden="true"` または `data-roving-disabled="true"` は対象外です。
- 標準カードへのフラグメントリンクも維持する場合は `id={'saved-item-' + encodeURIComponent(item.id)}` を指定します。このIDは矢印キー移動には不要です。
- 状態表示や操作は自動では追加されません。`KeepItemStatusBadge` と `KeepItemCheckbox` は単体利用可、`KeepItemCard.Remove` と `KeepItemCard.Link` はカード内専用です。単体の `KeepButton` は保存と解除を切り替えるトグルです。状態バッジはリンクを無効化しないため、独自行では利用不能な項目をリンクにしないでください。
- 標準の `KeepItemCard` でも開封記録は任意です（`href` と `trackOpen`）。独自リンクでは開いたときだけ `useKeepItem(item).recordOpen()` を呼びます。マウント・フォーカス・選択・解除では呼ばず、`trackOpen` と併用しません。

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
`KeepSavePopover`の編集パネルは、最も近い開いている`dialog`内、または`document.body`に表示されます。独自モーダルでは`portalContainer`にモーダルのコンテンツ要素を指定してください。
`KeepItemCard`の`Link` / `Media` / `Content` / `Title` / `Tags` / `Actions`でカードの一部だけを組み替えることもできます。

`KeepUiProvider`、`KeepKitProvider`、`createKeepKit` の `icons` で、保存（`save`）、保存済み（`saved`）、解除（`remove`）、処理中（`loading`）、失敗（`error`）、コレクション（`collection`）、状態別バッジ（`status`）をまとめて指定できます。ボタンに指定したアイコンが優先され、指定のない状態は従来の表示に戻ります。保存済みトグルには解除操作のアイコンを優先します。アイコンは装飾用で、ラベルと読み上げ名は別に維持されます。

標準パネルは `32rem` 以下で画面下端に表示されます。自分のDrawerやDialogを使う場合は [ホストパネルの例](#host-panel-example) のように `renderPanel` で `content` を一度だけ配置します。コレクション選択に加えて作成も必要なら `allowCreateCollection` を指定します。Escape・背景クリック・閉じる操作はすべて `requestClose()` に渡し、ホスト側で先にアンマウントしないでください。保存失敗時は開いたまま下書きを残します。ホストはフォーカスの制御と `triggerRef` への復帰を担当します。

### サイトのナビゲーションから一覧を開く

共通レイアウトにProviderを一つ置き、ヘッダーやモバイルナビゲーションから保存一覧のURLへリンクします。保存通知からも同じURLに移動できます。ルーティングには利用側のRouterを使用してください。

```tsx
import { useState } from "react";

function Site() {
  const [saved, setSaved] = useState(false);
  return (
    <keep.Provider onFeedback={(event) => { if (event.type === "item-saved") setSaved(true); }}>
      <header><a href="/saved">保存一覧</a></header>
      {saved && <p role="status">保存しました。 <a href="/saved">保存一覧を見る</a></p>}
      <SiteRoutes /> {/* 記事ページは keep.Button、/saved は keep.Collection */}
    </keep.Provider>
  );
}
```

既存のDrawerを使う場合は、同じProvider内のDrawerに`keep.Collection`を配置します。保存後の編集パネルは画面端とスクロールに追従します。`buttonProps`でラベルやアイコンを指定できます。

### テーマとアクセシビリティ

通常は`@keepkit/ui/theme.css`を読み込みます。Tailwind CSS v4／shadcnではグローバルCSSに次を記載します。

```css
@import "tailwindcss";
@import "@keepkit/ui/tailwind.css";
```

標準CSSでもTailwind連携でも、既定では `--color-primary` など**完成した色**だけを取り込みます。
shadcn v3のように `--primary: 348 84% 44%` と定義する場合は `<KeepKitProvider hostColorFormat="hsl-channels">` を指定します。この形式のときだけ `hsl(var(--primary))` として読み、未定義の色はKeepKitの配色に戻ります。アプリの `--primary` を書き換える必要はありません。

モードの既定は `inherit`：テーマ要素か祖先に `.dark` があればダーク、なければ端末設定にかかわらずライトです。ダーク未対応のアプリで明示的に固定するなら `mode="light"`、端末設定に追従するなら `mode="system"` を指定します。これはKeepKitの既定色を切り替えるもので、ホストが渡す色自体を反転する指定ではありません。`theme="ocean"` などのプリセット、`density`、`radius`、`variables` も使えます。主色を変える場合はテーマ要素の `--keep-primary` を指定すると、アクセントとそれを使う混色・影にも反映されます。

操作はキーボード・ARIAラベル・状態通知に対応します。`data-state`、`data-loading`、`data-disabled`は独自CSSでも利用できます。
カード一覧は矢印キー・Home・Endで移動でき、`trackOpen`を指定したカードでのみ開封を記録します。

### 保存と同期

ブラウザー内保存はIndexedDB優先・localStorage fallbackです。端末間同期にはアプリ側のdriver・認証・サーバーAPIが必要です。
バックアップは保存アイテム・コレクション定義・所属を含み、閲覧履歴・鑑賞記録・進行位置は含みません。
**Replace（置換）は既存データを置き換え、ロールバックしません。**

保存・同期の契約は[Core README](../keepkit/README.md)、デモとNext.jsサンプルは[リポジトリREADME](../../README.md)を参照してください。

保存ボタンは保存状態の読み込み中と更新中は操作できません。

同じ保存領域内では、`targetType`に関係なく`id`を一意にしてください。例えば `article:123` と `product:123` を使います。

## English

Save buttons are disabled while saved state is loading or a mutation is in progress.

Use an `id` unique across all target types within the same storage scope, for example `article:123` and `product:123`.


React UI for KeepKit, including `@keepkit/core`, with a shared provider for save buttons and collections.
CSS is optional: use the supplied theme or your own styles. Requires React 18 or later.

### Getting started

If you only use a button, import `KeepButton` from `@keepkit/ui/button` and optionally `@keepkit/ui/styles/base.css` plus `@keepkit/ui/styles/button.css`. Use the same provider as for root imports. The [full component import and size table](#component-bundle-sizes) measures the gzip-compressed UI JavaScript for single-component consumers, **not** the npm unpacked size.

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
Clearing filters from an empty search keeps the current archive scope. A failed toast Undo displays the error and a retry action. Card and stale-item removal notifications cannot undo a newer removal or restore an item after their Undo deadline.

Place `KeepArchiveUndo` inside the same provider to restore the most recently archived item. A failed restore displays an error and can be retried. Batch archiving is not included. Pass `collapsibleFilters` to `KeepCollection` to hide or show filters without clearing their values; Saved Views remain separate.
Changing storage or scope clears the previous archive Undo. `KeepUndo` and stale-item bulk removal display persistence errors so users can retry; removal Undo is limited to its original deadline.

```tsx
import { KeepArchiveUndo, KeepCollection, KeepProvider } from "@keepkit/ui";

<KeepProvider storage={storage}>
  <KeepCollection collapsibleFilters features={{ archive: true, tagFilter: true }} />
  <KeepArchiveUndo />
</KeepProvider>;
```

`KeepBackup` merges backup items into existing data in Merge mode; Replace mode replaces the current data. A warning is shown when Replace is selected, and `confirmReplace` requests confirmation before importing. Describe the storage location and sync configuration in the host application.

For custom rows, pass `KeepListSelection` (`selectedIds: readonly string[]`, `onSelectedIdsChange`, optional `disabled`) to `KeepList.selection`. The third argument of `KeepList` and `KeepCollection`'s `renderItem(item, state, selection?)` is `KeepItemSelection` (`checked`, `onCheckedChange`, optional `disabled`), ready to spread onto `KeepItemCheckbox`. Existing two-argument callbacks still work.

#### Custom row examples

Return a keyed `li` for the normal list. When built-in reordering is active, KeepKit supplies the `li` and drag handle; return just the row contents. The simplest way to retain card behavior is to compose its parts:

```tsx
<KeepList<ArticleMeta> renderItem={(item, _state, selection) => (
  <li key={item.id}>
    <KeepItemCard item={item} href={item.meta.url} trackOpen>
      <KeepItemCard.Link>{item.meta.title}</KeepItemCard.Link>
      <KeepItemStatusBadge status={item.status} />
      {selection && <KeepItemCheckbox item={item} {...selection} />}
      <KeepItemCard.Remove />
    </KeepItemCard>
  </li>
)} />
```

For a host-owned row, forward `data-keepkit="card"` to **one DOM element per row**. The list manages its `tabIndex`; arrows, Home and End move focus only when the card itself is focused, not from a nested input. `aria-hidden="true"` or `data-roving-disabled="true"` on the card excludes it. Neither badges nor open tracking are injected:

```tsx
function ArticleRow({ item }: { item: KeepItem<ArticleMeta> }) {
  const { recordOpen } = useKeepItem(item);
  const available = item.status === undefined || item.status === "available";
  return (
    <li data-keepkit="card" id={`saved-item-${encodeURIComponent(item.id)}`}>
      {available ? (
        <a href={item.meta.url} onClick={() => void recordOpen().catch(reportError)}>{item.meta.title}</a>
      ) : <span>{item.meta.title}</span>}
      <KeepItemStatusBadge status={item.status} />
      <KeepButton item={item} />
    </li>
  );
}

<KeepCollection<ArticleMeta> renderItem={(item) => <ArticleRow key={item.id} item={item} />} />
```

The example's `id` preserves standard card fragment links; roving focus does not require it. `KeepItemStatusBadge` and `KeepItemCheckbox` work outside a card; `KeepItemCard.Link` and `.Remove` require a card ancestor. `KeepButton` is a standalone save/remove toggle, not a remove-only action. A badge does not disable a host link. Only record an actual open: `trackOpen` defaults to `false`, and combining it with a manual `recordOpen()` would record twice. Mounting, moving focus, selecting or removing should not count as opening.

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

### Open saved items from site navigation

Mount one provider in the shared layout and link to the saved page from the header or mobile navigation. A save notification can link to the same page. Use your application's router for navigation.

```tsx
import { useState } from "react";

function Site() {
  const [saved, setSaved] = useState(false);
  return (
    <keep.Provider onFeedback={(event) => { if (event.type === "item-saved") setSaved(true); }}>
      <header><a href="/saved">Saved items</a></header>
      {saved && <p role="status">Saved. <a href="/saved">View saved items</a></p>}
      <SiteRoutes /> {/* Article pages use keep.Button; /saved renders keep.Collection. */}
    </keep.Provider>
  );
}
```

To use an existing drawer, place `keep.Collection` inside it under the same provider. The post-save editor follows the trigger and viewport. Configure its labels and icons through `buttonProps`.

`KeepSavePopover` renders its editor in the nearest open native `dialog`, or in `document.body` otherwise. For a custom modal with a focus trap, pass its content element as `portalContainer` so the editor remains inside the modal.

Set `icons` on `KeepUiProvider`, `KeepKitProvider` or `createKeepKit` to share decorative icons. Set only the slots you need:

```tsx
<KeepUiProvider icons={{ save: Bookmark, saved: BookmarkFilled, collection: Folder, status: { expired: Clock } }}>
  {children}
</KeepUiProvider>
```

`remove`, `loading` and `error` are also supported. A saved toggle prefers local `remove`, local `saved`, provider `remove`, then provider `saved`. Missing slots retain built-in visuals. `status` accepts an individual item status or a normalized fallback such as `restricted`. Accessible action and status names remain separate from the icons.

#### Host panel example

The standard panel docks to the bottom at `32rem` and narrower. To use your own sheet or dialog instead, render the editor `content` once in a **controlled** host shell. `Drawer` / `DrawerContent` below are host components; adapt their focus and dismissal APIs to your library:

```tsx
<KeepSavePopover
  item={article}
  allowCreateCollection
  editorProps={{ features: { title: false, note: false, tags: false, collection: true } }}
  renderPanel={({ panelId, dialogLabel, content, requestClose, triggerRef }) => (
    <Drawer open onOpenChange={(open) => { if (!open) void requestClose(); }}>
      <DrawerContent
        id={panelId}
        aria-label={dialogLabel}
        onCloseAutoFocus={(event) => { event.preventDefault(); triggerRef.current?.focus(); }}
      >
        {content}
        <button type="button" onClick={() => void requestClose()}>Done</button>
      </DrawerContent>
    </Drawer>
  )}
/>
```

Only a successful save from this trigger opens the shell automatically. `allowCreateCollection` adds a creation form beside the editor and selects the new collection. The host owns positioning, initial focus, trapping and restoration. Route Escape, outside dismissal and Done through `requestClose()` rather than unmounting immediately: it waits for pending edits and returns `false` on failure, leaving the draft and error visible.

### Theme and accessibility

Import `@keepkit/ui/theme.css` for the standard theme. For Tailwind CSS v4 or shadcn, add these global CSS imports:

```css
@import "tailwindcss";
@import "@keepkit/ui/tailwind.css";
```

With either stylesheet, the default bridge reads **complete colors** such as `--color-primary`. For shadcn v3 channel lists such as `--primary: 348 84% 44%`, use `<KeepKitProvider hostColorFormat="hsl-channels">`. Only this format wraps the values in `hsl(...)`; missing tokens use KeepKit's palette. The host's `--primary` need not change.

The default mode is `inherit`: the theme element or an ancestor with `.dark` selects dark; otherwise KeepKit stays light regardless of OS settings. Set `mode="light"` explicitly in a light-only app, or `mode="system"` for OS-driven colors. Modes select KeepKit's fallback palette; they don't invert colors supplied by the host. Use presets such as `theme="ocean"`, `density`, `radius`, or `variables` as before. Override `--keep-primary` on the theme element to update the accent and the mixes and shadows that depend on it.

Controls support keyboard interaction, ARIA labels, and live announcements. Use `data-state`, `data-loading`, and `data-disabled` in custom CSS.
Card lists support arrow keys, Home, and End. Cards record opens only when `trackOpen` is enabled.

### Persistence and sync

Browser storage prefers IndexedDB with a localStorage fallback. Cross-device sync needs your app's driver, authentication, and server APIs.
Backups include saved items, collection definitions, and memberships; history, viewing records, and progress are excluded.
**Replace imports overwrite existing data and do not roll back.**

See the [Core README](../keepkit/README.md) for persistence contracts and the [repository README](../../README.md) for demos and Next.js examples.

## Component bundle sizes

各行は、該当部品1つだけをimportしたときのUIのJS転送量です。ビルド済みパッケージの公開入口をesbuildでバンドル・ツリーシェイク・minifyし（ブラウザ用ES2020 ESM）、Nodeのgzipレベル9で測定しています。必要な共有コード・言語辞書を含み、React・React DOM・`@keepkit/core`・型宣言・ソースマップは除外します。Coreの部品を再公開する入口は再エクスポート分のみです。各行の合計はアプリのサイズではありません。CSSは任意で、ローカルの `@import` を含めた値を別表にしています。Tailwindはホスト側で処理する前の値です。

Each row represents one isolated consumer import from the **built package**, tree-shaken and minified with esbuild (browser ES2020 ESM), then compressed with Node gzip level 9. Shared UI code and built-in locale dictionaries are included. React (including JSX runtime), React DOM, `@keepkit/core`, source maps and declarations are excluded. Core component entries measure only the re-export. Do not add the rows: multiple components share code. Optional CSS is measured separately, including local `@import` rules and before host Tailwind processing.

Regenerate from the repository root / リポジトリのルートで再生成:

```sh
pnpm --filter @keepkit/ui... build
pnpm ui:sizes --write
```

<!-- sizes:start -->

| Component / コンポーネント | Import / インポート | gzip (bytes) |
| --- | --- | ---: |
| `KeepActiveFiltersSummary` | `@keepkit/ui/active-filters-summary` | 33944 |
| `KeepAnnouncements` | `@keepkit/ui/announcements` | 30923 |
| `KeepAnnouncer` | `@keepkit/ui/announcer` | 30930 |
| `KeepArchiveButton` | `@keepkit/ui/archive-button` | 30979 |
| `KeepArchiveScopeSelect` | `@keepkit/ui/archive-scope-select` | 30870 |
| `KeepArchiveUndo` | `@keepkit/ui/archive-undo` | 31248 |
| `KeepBackup` | `@keepkit/ui/backup` | 32582 |
| `KeepBulkActions` | `@keepkit/ui/bulk-actions` | 34181 |
| `KeepButton` | `@keepkit/ui/button` | 31921 |
| `KeepCollection` | `@keepkit/ui/collection` | 56819 |
| `KeepCollectionCreate` | `@keepkit/ui/collection-create` | 31532 |
| `KeepCollectionFilter` | `@keepkit/ui/collection-filter` | 31285 |
| `KeepCollectionManager` | `@keepkit/ui/collection-manager` | 33212 |
| `KeepCollectionSelect` | `@keepkit/ui/collection-select` | 30956 |
| `KeepEmptyState` | `@keepkit/ui/empty-state` | 31584 |
| `KeepErrorBoundary` | `@keepkit/ui/error-boundary` | 88 |
| `KeepFallbackRecovery` | `@keepkit/ui/fallback-recovery` | 32697 |
| `KeepFloatingTour` | `@keepkit/ui/floating-tour` | 35031 |
| `KeepHighlight` | `@keepkit/ui/highlight` | 493 |
| `KeepInbox` | `@keepkit/ui/inbox` | 56911 |
| `KeepItemCard` | `@keepkit/ui/item-card` | 40441 |
| `KeepItemCardSkeleton` | `@keepkit/ui/item-card-skeleton` | 239 |
| `KeepItemCheckbox` | `@keepkit/ui/item-checkbox` | 366 |
| `KeepItemStatusBadge` | `@keepkit/ui/item-status-badge` | 31466 |
| `KeepKitProvider` | `@keepkit/ui/kit-provider` | 34021 |
| `KeepLastActivity` | `@keepkit/ui/last-activity` | 31073 |
| `KeepLayout` | `@keepkit/ui/layout` | 833 |
| `KeepList` | `@keepkit/ui/list` | 43934 |
| `KeepNavigator` | `@keepkit/ui/navigator` | 33084 |
| `KeepNoteEditor` | `@keepkit/ui/note-editor` | 32683 |
| `KeepPagination` | `@keepkit/ui/pagination` | 31244 |
| `KeepPinButton` | `@keepkit/ui/pin-button` | 30983 |
| `KeepProvider` | `@keepkit/ui/provider` | 83 |
| `KeepPruneStaleButton` | `@keepkit/ui/prune-stale-button` | 31723 |
| `KeepQuickEditor` | `@keepkit/ui/quick-editor` | 33447 |
| `KeepRediscovery` | `@keepkit/ui/rediscovery` | 44100 |
| `KeepRediscoveryPanel` | `@keepkit/ui/rediscovery-panel` | 44230 |
| `KeepReorderableList` | `@keepkit/ui/reorderable-list` | 31756 |
| `KeepSavePopover` | `@keepkit/ui/save-popover` | 38184 |
| `KeepSaveViewButton` | `@keepkit/ui/save-view-button` | 31691 |
| `KeepSavedViews` | `@keepkit/ui/saved-views` | 31875 |
| `KeepSearchInput` | `@keepkit/ui/search-input` | 30978 |
| `KeepShortcutHint` | `@keepkit/ui/shortcut-hint` | 339 |
| `KeepSortSelect` | `@keepkit/ui/sort-select` | 31065 |
| `KeepStaleNotice` | `@keepkit/ui/stale-notice` | 32393 |
| `KeepStatus` | `@keepkit/ui/status` | 31801 |
| `KeepSyncRecoveryDialog` | `@keepkit/ui/sync-recovery-dialog` | 33770 |
| `KeepSyncStatusBanner` | `@keepkit/ui/sync-status-banner` | 31288 |
| `KeepTagEditor` | `@keepkit/ui/tag-editor` | 31776 |
| `KeepTagFilter` | `@keepkit/ui/tag-filter` | 32306 |
| `KeepThemeProvider` | `@keepkit/ui/theme-provider` | 1126 |
| `KeepTourBar` | `@keepkit/ui/tour-bar` | 33074 |
| `KeepTourProvider` | `@keepkit/ui/tour-provider` | 1123 |
| `KeepUiProvider` | `@keepkit/ui/ui-provider` | 30926 |
| `KeepUndo` | `@keepkit/ui/undo` | 31663 |
| `KeepWorkspace` | `@keepkit/ui/workspace` | 61505 |

### CSS

| Stylesheet / スタイルシート | gzip (bytes) |
| --- | ---: |
| `@keepkit/ui/styles/base.css` | 4076 |
| `@keepkit/ui/styles/button.css` | 675 |
| `@keepkit/ui/styles/collection.css` | 4541 |
| `@keepkit/ui/styles/status.css` | 566 |
| `@keepkit/ui/styles/sync.css` | 1319 |
| `@keepkit/ui/styles/workspace.css` | 355 |
| `@keepkit/ui/tailwind.css` | 9691 |
| `@keepkit/ui/theme.css` | 9462 |

<!-- sizes:end -->
