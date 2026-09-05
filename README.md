# keepkit

[日本語](#日本語) | [English](#english)

## 日本語

KeepKitは、Reactアプリケーションに保存・コレクション機能を追加するための、非同期・ローカルファーストなツールキットです。v0.26.3では、`KeepCollection`の最小構成と高度な操作を確認できる`apps/collection-demo`を追加し、demoの単独dev起動・ビルド時のテーマCSS準備も改善しました。

### インストール

```bash
pnpm add @keepkit/ui
```

### 標準利用

```tsx
import "@keepkit/ui/theme.css";
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

### Minimal Starter Recipe

```tsx
import "@keepkit/ui/theme.css";
import { createBrowserStorageAdapter, createKeepKit } from "@keepkit/ui";

type Meta = { title: string; url: string };
const keep = createKeepKit<Meta>({
  storage: createBrowserStorageAdapter({ key: "demo:keeps" }),
});

export function SavedArticle({ article }: { article: Meta & { id: string } }) {
  return (
    <keep.Provider fallback={<p>Saved items are temporarily unavailable.</p>}>
      <keep.Button item={{ id: article.id, targetType: "article", meta: article }} />
      <keep.Collection query={{ targetType: "article" }} />
    </keep.Provider>
  );
}
```

すべてのUIプリミティブは状態を`data-state`に、処理中を`data-loading="true"`に、無効状態を`data-disabled="true"`に公開します。ホストアプリはクラス名の条件分岐なしにCSSやTailwindのdata variantで装飾できます。`KeepCollection` / `KeepList`にも`fallback`、`onBoundaryError`、`boundaryResetKey`を指定でき、Provider全体または一覧単位で予期せぬ描画エラーを隔離できます。
`@keepkit/ui`は`KeepItemCardSkeleton`、`KeepList loadingCount`、コンテナ幅対応の`layout="auto"`、`KeepItemCard.Media / Content / Title / Tags / Actions / Save / Remove`、および`onFeedback` / `useKeepToastFeedback`による外部トースト連携も提供します。`KeepSavePopover`はtriggerとdialogをARIAで関連付け、`KeepQuickEditor`の`saveStatus`は未保存・保存中・保存済み・失敗を公開します。自動保存だけを表示する場合は`showSaveButton={false}`を指定できます。
`KeepList` / `KeepCollection`内のカードタイトルとテキストは検索語を大文字小文字を区別せず`<mark class="keep-highlight" data-highlight="true">`でハイライトします。単体カードでは`highlightQuery`、再利用可能な表示では`KeepHighlight`を指定できます。画像は`data-media-status="loading" | "loaded" | "error"`を公開し、失敗時は`KeepItemCard.Media fallback`または標準SVGへ切り替わります。カード一覧はRoving Tabindexにより矢印キー、Home、Endで移動できます。
`KeepCollection`は検索語と選択タグを`KeepActiveFiltersSummary`のチップとして表示し、個別解除と一括クリアを提供します。標準の空状態は全件0件の`empty-storage`と絞り込み結果0件の`empty-filtered`を区別し、後者では`onClearFilters`で復帰できます。`KeepShortcutHint`、`KeepTourBar showShortcutHint`、`KeepNoteEditor showShortcutHint`で`<kbd>`の操作ヒントを表示でき、`mergeProps` / `createSlot`は`asChild`のclassName、style、ARIA、イベント合成に利用できます。
保存順を巡回ルートとして使う場合は、`useKeepNavigator()` と`useKeepList().reorder()` / `.move()` を利用できます。`KeepItem.order` は既存アイテムにも追加でき、`KeepCollection reorderable` はドラッグハンドル、キーボード並び替え、標準Undoを内蔵します。`KeepTourBar` は進行度・前後移動・一覧戻りをURLまたはコールバックで接続し、`getItemHref` / `getBackHref` / `onNavigate`でホストのルーティングを注入できます。`KeepReorderableList` はドラッグ中の挿入位置ガイドと矢印キーによる並び替えを提供します。キーボード巡回は`keyboardShortcuts`または`useKeepTourShortcuts`で明示的に有効化します。
`KeepCollection archiveScope="active" | "archived" | "all"` は標準スコープセレクターを表示し、`archiveScope` URLパラメータと同期します。`useKeepCollections({ targetType, orderBy })` は保存済みアイテムから候補を重複除去・集計して返し、`KeepQuickEditor`の選択肢にも自動接続されます。`KeepItemCard showEditButton` は標準QuickEditor dialogを表示し、`editSlot`で内容を差し替えられます。

`@keepkit/ui/theme.css`を読み込むと、枠、面色、影、フォーカス表示と、保存・検索・削除・タグ・同期などの標準アイコンが有効になります。通常の削除・一括削除・stale削除は薄い赤の枠線と文字色、hover時の淡い面色で表示し、強い赤の塗りつぶしは確認が必要なエラー状態に限定します。アイコンは装飾であり、操作名は引き続きラベルとARIA属性から提供されます。個別に調整する場合は`data-keep-action`を選択し、`--keep-icon-size`、`--keep-control-gap`、`--keep-shadow`、`--keep-success`、`--keep-warning`を上書きできます。CSSを読み込まないheadless利用と、既存の`KeepButton icons`指定は変更されません。
ハイライトは`--keep-highlight-bg` / `--keep-highlight-fg`でライト／ダーク双方のコントラストを確保し、タイトルは2行、メモプレビューは3行、メディアは固定アスペクト比で一覧の高さを安定させます。`KeepItemStatusBadge`は状態テキストにチェック・時計・進入禁止・鍵のSVGアイコンを併記します。状態スタイルだけが必要な場合は`@keepkit/ui/styles/status.css`を読み込めます。

`keep.Collection`は検索、ソート、ページング、タグフィルター、一括操作、loading / empty / error状態、ARIA通知を組み合わせて提供します。検索は既定で300msデバウンスされ、追加機能は`features`で有効化できます。

`KeepWorkspace`は既存プリミティブを組み合わせ、`basic`、`standard`、`management`、`sync`のプリセットでコレクション画面一式を提供します。`createKeepKit()`を利用する場合は同じ実装を`keep.Workspace`から型付きで利用できます。`modules`、`slots`、子コンポーネントごとのpropsで必要な領域だけを上書きできます。

```tsx
const keep = createKeepKit<ArticleMeta>({ storage, locale: "ja" });

<keep.Provider>
  <keep.Workspace preset="sync" collectionProps={{ layout: "auto" }} />
</keep.Provider>;
```

```tsx
<keep.Collection
  query={{ targetType: "article", tags: ["read"] }}
  features={{ tagFilter: true, bulkActions: true }}
  pageSize={20}
  renderItem={(item) => <keep.Button item={{ id: item.id, targetType: item.targetType, meta: item.meta }} />}
/>
```

一覧の標準カードで必要な機能だけを有効化する場合は、`features={{ pin: true, archive: true, tags: false }}`を指定できます。`pin` / `archive` はボタン表示、`tags` はカード内のタグ表示を切り替えます。タグフィルターは`tagFilter`、タグ編集は`KeepTagEditor`で個別に制御でき、`itemCardProps`の明示指定が`features`より優先されます。

### APIの基本方針

- 保存入力は`{ id, meta, targetType?, note?, tags?, order? }`です。時刻や正規化はKeepKitが管理します。
- 一覧条件は`query`に統一し、`search`、`sort`、`pagination`を内包します。
- 型付きAPIは`createKeepKit<TMeta>()`で生成します。`Provider`、`Button`、`Collection`、`Workspace`、`useItem`、`useList`、`useNavigator`、`useShortcut`を同じ型で利用できます。
- `KeepSearchInput`、`KeepSortSelect`、`KeepPagination`、`KeepItemCheckbox`、`KeepTagEditor`、`KeepBulkActions`は個別に利用でき、`KeepBulkActions`はrender propsで操作UIを差し替えられます。`KeepBulkActions`の状態には`isAllSelected` / `toggleSelectAll`が含まれ、`isAllSelected` / `toggleSelectAll`ヘルパーも公開しています。
- `@keepkit/ui`は標準React向けの入口です。フレームワーク中立の処理は`@keepkit/core/core`、低レベルReact APIは`@keepkit/core/react`、adapterは`@keepkit/core/storage`から利用できます。
- Next.js App RouterのServer Component / client boundary構成は`examples/next-app-router`、Pages Router構成は`examples/next-pages-router`を参照してください。

### ストレージと同期

`createBrowserStorageAdapter`はIndexedDBを優先し、利用できない場合はlocalStorageへ切り替えます。サーバー同期が必要な場合は`SyncStorageAdapter`と`RemoteSyncDriver`を組み合わせます。認証方式を固定しない`createAuthenticatedSyncKit`では、リクエストごとのトークン取得、401/403 callback、ユーザー／テナントscope切替、永続オフラインキューをまとめて利用できます。

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

保存一覧のカードは`href`と`onOpen`に対応します。`linkTarget="card"`、`linkComponent`、`linkTargetAttribute="_blank"`でカード全体、Next.js等のLink、外部タブにも対応できます。`status`が`expired`、`removed`、`private`などのアイテムは自動的にリンク対象外になります。
外部URLには`target="_blank"`と`rel="noreferrer"`が自動補完され、利用できないカードは`aria-disabled="true"`と`data-item-status="expired" | "removed" | "restricted"`で状態を伝えます。同期競合の復旧ダイアログではローカル／リモートの更新日時とメモを並べて比較できます。

`KeepProvider`の`validateItem` / `resolveItem`、または`revalidateItems`で保存対象を再検証できます。結果はアイテムの`status`と`statusReason`に保存され、`removeStatuses`で一覧から削除できます。`SyncStorageAdapter`は`userId`、`tenantId`、`maxRetries`、`retryDelayMs`を受け取り、キューをスコープ分離して再接続時に自動同期します。失敗後は`retrySync()`で再実行できます。

JSONバックアップUIは`<KeepBackup />`として利用できます。エクスポート、merge / replaceインポート、件数表示、容量エラー表示を提供します。

Phase 4の状態UIは`<KeepItemStatusBadge />`、`<KeepStaleNotice />`、`<KeepPruneStaleButton />`、`<KeepSyncStatusBanner />`、`<KeepSyncRecoveryDialog />`として利用できます。テーマを使う場合は`import "@keepkit/ui/theme.css"`を追加してください。

### v0.26.3のCollection demoとWorkspace

`<keep.Collection urlSync layout="grid" />`で検索・タグ・ソート・ページをURL、戻る／進む、共有URLと同期できます。Next.js Pages Routerでは`createNextPagesRouterAdapter(router)`を`urlAdapter`に渡してください。`layout`は`list`、`grid`、`compact`に対応し、`itemCardProps`の`getImageProps`、`renderTags`、`href`、`onOpen`でカード表示と遷移を差し替えられます。

`KeepBulkActions`の`selectionScope="page" | "query" | "all"`で一括操作の範囲を変更できます。削除を`useKeepList().removeWithUndo`または`removeBatchWithUndo`で実行し、`<KeepUndo />`を配置すると期限内の復元操作を表示できます。`KeepProvider autoRevalidation={{ intervalMs: 60000 }}`は一覧表示後、間隔経過後、オンライン復帰時に再検証します。

ユーザー／テナント分離が必要な場合は、`createKeepKitPreset({ mode: "local" | "sync" | "backup", scope, remote })`を使うとstorage、同期キュー、バックアップの構成をまとめられます。ラベルは16個の組み込みlocale（`en`、`ja`、`ko`、`zh-Hans`、`zh-Hant`、`th`、`fr`、`es`、`pt-BR`、`it`、`de`、`ru`、`fil`、`vi`、`id`、`ms`）で切り替えられ、`labels`で上書きできます。`zh-CN`と`zh-TW`も互換aliasとして利用できます。

### v0.26.3 Tailwind／shadcnテーマ

Tailwind CSS v4ではグローバルCSSで2行読み込み、必要ならテーマ用Providerを配置します。既存のshadcn/ui変数はTailwind v4の`--color-*`経由で`--keep-*`トークンへ継承されます。

```css
/* globals.css */
@import "tailwindcss";
@import "@keepkit/ui/tailwind.css";
```

```tsx
import { KeepThemeProvider } from "@keepkit/ui";

<KeepThemeProvider theme="ocean" mode="system" density="comfortable" radius="medium">
  <KeepCollection layout="grid" />
</KeepThemeProvider>;
```

色テーマは`default`、`ocean`、`forest`、`sunset`、`lavender`から選べます。既存の`compact`、`minimal`、`rounded`、`high-contrast`、`dark`も維持されています。`KeepKitProvider theme="forest" mode="dark"`のように、`theme`を`mode="light" | "dark" | "system"`、`density`、`radius`と組み合わせられます。テーマ選択UIにはexport済みの`keepThemeNames`を利用でき、`accentColor`、`highContrast`、`reducedMotion`、`variables={{ "--keep-card-gap": "1rem" }}`による上書きも可能です。

shadcn用のJSマップが必要な場合は`import { keepKitTheme } from "@keepkit/ui/tailwind"`を使えます。KeepKitはホストの`--color-background`などを上書きせず、`--color-keep-*`としてTailwindへ公開します。機能別に`@keepkit/ui/styles/base.css`、`button.css`、`collection.css`、`sync.css`だけを読み込むこともできます。`KeepButton`は`icons={{ save, saved, remove }}`、`iconOnly`、render propsで表示を差し替えられます。すべての標準コンポーネントは`data-state`、`data-loading`、`data-disabled`とARIA属性を維持します。

## English

KeepKit is an async, local-first toolkit for adding saved collections to React applications. v0.26.3 adds `apps/collection-demo` for exploring minimal and advanced `KeepCollection` setups, and prepares the UI theme CSS for standalone demo commands.

### Installation

```bash
pnpm add @keepkit/ui
```

### Standard usage

```tsx
import "@keepkit/ui/theme.css";
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

### Minimal Starter Recipe

```tsx
import "@keepkit/ui/theme.css";
import { createBrowserStorageAdapter, createKeepKit } from "@keepkit/ui";

type Meta = { title: string; url: string };
const keep = createKeepKit<Meta>({
  storage: createBrowserStorageAdapter({ key: "demo:keeps" }),
});

export function SavedArticle({ article }: { article: Meta & { id: string } }) {
  return (
    <keep.Provider fallback={<p>Saved items are temporarily unavailable.</p>}>
      <keep.Button item={{ id: article.id, targetType: "article", meta: article }} />
      <keep.Collection query={{ targetType: "article" }} />
    </keep.Provider>
  );
}
```

Every UI primitive exposes its semantic state through `data-state`, `data-loading="true"` while work is pending, and `data-disabled="true"` when disabled. `KeepCollection` and `KeepList` also accept `fallback`, `onBoundaryError`, and `boundaryResetKey` so unexpected render errors can be isolated at the provider or list level.
`@keepkit/ui` also provides `KeepItemCardSkeleton`, `KeepList loadingCount`, container-aware `layout="auto"`, `KeepItemCard.Media / Content / Title / Tags / Actions / Save / Remove`, and external toast integration through `onFeedback` / `useKeepToastFeedback`. `KeepSavePopover` connects its trigger and dialog with ARIA, while `KeepQuickEditorState.saveStatus` exposes dirty, saving, saved, and error states. Set `showSaveButton={false}` for an auto-save-only presentation.
Cards rendered by `KeepList` / `KeepCollection` highlight case-insensitive search matches with `<mark class="keep-highlight" data-highlight="true">`; use `highlightQuery` on a standalone card or `KeepHighlight` for reusable text. Media exposes `data-media-status="loading" | "loaded" | "error"` and swaps failed images for `KeepItemCard.Media fallback` or a built-in SVG placeholder. Card groups support Roving Tabindex navigation with arrow keys, Home, and End.
`KeepCollection` renders search and selected tags as `KeepActiveFiltersSummary` chips with individual removal and clear-all actions. The default empty state distinguishes `empty-storage` from `empty-filtered`; the filtered state can recover through `onClearFilters`. `KeepShortcutHint`, `KeepTourBar showShortcutHint`, and `KeepNoteEditor showShortcutHint` expose `<kbd>` operation hints, while `mergeProps` / `createSlot` compose className, style, ARIA, and events for `asChild` slots.
Use `useKeepNavigator()` with `useKeepList().reorder()` / `.move()` to turn saved order into a tour route. `KeepItem.order` is additive and persisted by existing adapters. `KeepCollection reorderable` includes a drag handle, keyboard reordering, and standard undo feedback. `KeepTourBar` provides progress, previous/next, and return-to-list actions through URLs or callbacks; inject host routing with `getItemHref`, `getBackHref`, and `onNavigate`. `KeepReorderableList` shows the active drop insertion position and supports keyboard reordering. Enable tour keyboard shortcuts explicitly with `keyboardShortcuts` or `useKeepTourShortcuts`.
`KeepCollection archiveScope="active" | "archived" | "all"` renders a standard scope selector and synchronizes the `archiveScope` URL parameter. `useKeepCollections({ targetType, orderBy })` derives de-duplicated, counted choices from saved items and powers `KeepQuickEditor` choices automatically. `KeepItemCard showEditButton` opens the standard QuickEditor dialog; customize its contents with `editSlot`.

Importing `@keepkit/ui/theme.css` enables the standard borders, surfaces, shadows, focus treatment, and decorative icons for save, search, remove, tags, sync, and other common actions. Regular remove, bulk-delete, and stale-prune actions use a subtle red outline and text with a light hover surface; solid red is reserved for error states that need confirmation. Accessible names still come from visible labels and ARIA attributes. Target individual controls through `data-keep-action`, or override `--keep-icon-size`, `--keep-control-gap`, `--keep-shadow`, `--keep-success`, and `--keep-warning`. Headless use without CSS and existing `KeepButton icons` overrides remain unchanged.
The theme also defines WCAG-oriented `--keep-highlight-bg` / `--keep-highlight-fg` pairs for light and dark modes, clamps titles to two lines and memo previews to three, and reserves stable media space. `KeepItemStatusBadge` combines visible status text with check, clock, ban, or lock SVG icons.

`keep.Collection` combines search, sorting, pagination, optional tag filtering and bulk actions, loading/empty/error states, and accessible live announcements. Search is debounced by 300ms by default; enable optional behavior with `features`.

`KeepWorkspace` composes the existing primitives into `basic`, `standard`, `management`, and `sync` collection-screen presets. `createKeepKit()` exposes the same implementation as a typed `keep.Workspace`. Override individual areas through `modules`, `slots`, and child-component props.

```tsx
const keep = createKeepKit<ArticleMeta>({ storage, locale: "en" });

<keep.Provider>
  <keep.Workspace preset="sync" collectionProps={{ layout: "auto" }} />
</keep.Provider>;
```

Enable only the standard card features you need with `features={{ pin: true, archive: true, tags: false }}`. `pin` and `archive` toggle card action buttons, while `tags` controls tag display inside cards. Tag filtering remains independently controlled by `tagFilter`, tag editing by `KeepTagEditor`, and explicit `itemCardProps` values take precedence over `features`.

Saved inputs contain only `id`, `meta`, `targetType`, `note`, and `tags`; persistence timestamps and normalization are handled by KeepKit. Collection queries use the canonical `query` shape with `search`, `sort`, and `pagination`.

The typed factory returns `Provider`, `Button`, `Collection`, `Workspace`, `useItem`, `useList`, `useCollections`, `useNavigator`, and `useShortcut`. `KeepSearchInput`, `KeepSortSelect`, `KeepPagination`, `KeepItemCheckbox`, `KeepTagEditor`, `KeepBulkActions`, `KeepTourBar`, and `KeepReorderableList` are also available as standalone primitives. `KeepBulkActions` exposes `isAllSelected` / `toggleSelectAll` in its render-prop state and as standalone helpers. Use `@keepkit/core/core` for framework-neutral primitives, `@keepkit/core/react` for low-level React bindings, and `@keepkit/core/storage` for adapters.

See `examples/next-app-router` for the Server Component/client boundary pattern and `examples/next-pages-router` for the Pages Router integration.

### v0.26.3 Collection demo, Workspace, URL, layouts, setup presets, and Tailwind integration

Use `<keep.Collection urlSync layout="grid" />` to synchronize search, tags, sorting, and pagination with shareable URLs and browser history. For Next.js Pages Router, pass `createNextPagesRouterAdapter(router)` as `urlAdapter`. Layouts are `list`, `grid`, and `compact`; customize thumbnails, tags, and detail navigation through `itemCardProps`.

Set `selectionScope="page" | "query" | "all"` on `KeepBulkActions` to choose the bulk-action range. Use `useKeepList().removeWithUndo` or `removeBatchWithUndo`, and mount `<KeepUndo />` for timed restoration. `KeepProvider autoRevalidation={{ intervalMs: 60000 }}` revalidates after hydration, on an interval, and after reconnecting.

Use `createKeepKitPreset({ mode: "local" | "sync" | "backup", scope, remote })` to compose isolated storage, sync queues, and backups for a user/tenant. Set `locale` to any of the 16 built-in locales; individual `labels` override the dictionary.

Use `createAuthenticatedSyncKit` when the host supplies authentication. It refreshes the token for each request, reports 401/403 failures through callbacks, isolates storage and queues by scope, and resumes durable offline work after reconnecting. See `examples/authenticated-sync` for a transport recipe.

Use `KeepItemStatusBadge`, `KeepStaleNotice`, and `KeepPruneStaleButton` for unavailable-item recovery. `KeepSyncStatusBanner` and `KeepSyncRecoveryDialog` expose retry, local/server/manual conflict resolution, and backup restoration guidance. Optionally import `@keepkit/ui/theme.css` for CSS-variable theming, dark mode, and mobile typography.
External detail URLs receive `target="_blank"` and `rel="noreferrer"` defaults. Unavailable cards expose `aria-disabled="true"` and normalized `data-item-status` values, while the recovery dialog compares local and remote updated dates and notes side by side.

### v0.26.3 Tailwind and shadcn theme

Tailwind CSS v4 needs two imports in the global CSS entry. The theme is scoped by `KeepThemeProvider`, and its `--keep-*` tokens inherit complete `--color-*` values such as `--color-background`, `--color-primary`, and `--color-ring` when present.

```css
/* globals.css */
@import "tailwindcss";
@import "@keepkit/ui/tailwind.css";
```

```tsx
import { KeepThemeProvider, KeepCollection } from "@keepkit/ui";

<KeepThemeProvider theme="ocean" mode="system" density="comfortable" radius="medium">
  <KeepCollection layout="grid" />
</KeepThemeProvider>;
```

Color themes are `default`, `ocean`, `forest`, `sunset`, and `lavender`. Existing `compact`, `minimal`, `rounded`, `high-contrast`, and `dark` presets remain available. `theme` composes with `mode`, `density`, and `radius`; for example, use `KeepKitProvider theme="forest" mode="dark"`. The exported `keepThemeNames` list can populate a theme selector. `accentColor`, `highContrast`, `reducedMotion`, and `variables` remain available for overrides. `.dark`, `prefers-color-scheme`, mobile one-column fallbacks, and reduced motion are built in. Import `keepKitTheme` from `@keepkit/ui/tailwind` when a JavaScript theme map is useful, or import only `@keepkit/ui/styles/base.css`, `button.css`, `collection.css`, and `sync.css`. KeepKit's Tailwind aliases are namespaced as `--color-keep-*`, so host aliases remain untouched. `KeepButton` accepts `icons={{ save, saved, remove }}` and `iconOnly`, while render props remain the full escape hatch.

The UI includes complete built-in dictionaries for 16 locales: `en`, `ja`, `ko`, `zh-Hans`, `zh-Hant`, `th`, `fr`, `es`, `pt-BR`, `it`, `de`, `ru`, `fil`, `vi`, `id`, and `ms`. `zh-CN` and `zh-TW` remain supported aliases.

See [MIGRATION.md](./MIGRATION.md) for the v0.4 migration and [RELEASE_NOTES.md](./RELEASE_NOTES.md) for the complete changelog.

### Development and validation

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```
