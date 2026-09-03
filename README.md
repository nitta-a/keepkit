# keepkit

[日本語](#日本語) | [English](#english)

## 日本語

KeepKitは、Reactアプリケーションに保存・コレクション機能を追加するための、非同期・ローカルファーストなツールキットです。v0.16.0では、スケルトンローディング、フィードバックイベント、Compound Card、コンテナクエリ対応レイアウトを追加しました。

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
`@keepkit/ui`は`KeepItemCardSkeleton`、`KeepList loadingCount`、コンテナ幅対応の`layout="auto"`、`KeepItemCard.Media / Content / Title / Tags / Actions`、および`onFeedback` / `useKeepToastFeedback`による外部トースト連携も提供します。

`@keepkit/ui/theme.css`を読み込むと、枠、面色、影、フォーカス表示と、保存・検索・削除・タグ・同期などの標準アイコンが有効になります。アイコンは装飾であり、操作名は引き続きラベルとARIA属性から提供されます。個別に調整する場合は`data-keep-action`を選択し、`--keep-icon-size`、`--keep-control-gap`、`--keep-shadow`、`--keep-success`、`--keep-warning`を上書きできます。CSSを読み込まないheadless利用と、既存の`KeepButton icons`指定は変更されません。

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

### v0.16.0の一覧連携と導入プリセット

`<keep.Collection urlSync layout="grid" />`で検索・タグ・ソート・ページをURL、戻る／進む、共有URLと同期できます。Next.js Pages Routerでは`createNextPagesRouterAdapter(router)`を`urlAdapter`に渡してください。`layout`は`list`、`grid`、`compact`に対応し、`itemCardProps`の`getImageProps`、`renderTags`、`href`、`onOpen`でカード表示と遷移を差し替えられます。

`KeepBulkActions`の`selectionScope="page" | "query" | "all"`で一括操作の範囲を変更できます。削除を`useKeepList().removeWithUndo`または`removeBatchWithUndo`で実行し、`<KeepUndo />`を配置すると期限内の復元操作を表示できます。`KeepProvider autoRevalidation={{ intervalMs: 60000 }}`は一覧表示後、間隔経過後、オンライン復帰時に再検証します。

ユーザー／テナント分離が必要な場合は、`createKeepKitPreset({ mode: "local" | "sync" | "backup", scope, remote })`を使うとstorage、同期キュー、バックアップの構成をまとめられます。ラベルは16個の組み込みlocale（`en`、`ja`、`ko`、`zh-Hans`、`zh-Hant`、`th`、`fr`、`es`、`pt-BR`、`it`、`de`、`ru`、`fil`、`vi`、`id`、`ms`）で切り替えられ、`labels`で上書きできます。`zh-CN`と`zh-TW`も互換aliasとして利用できます。

### v0.16.0 Tailwind／shadcnテーマ

Tailwind CSS v4ではCSSを2行読み込み、必要ならテーマ用Providerを配置します。既存のshadcn/ui変数（`--background`、`--primary`など）があれば`--keep-*`トークンが継承します。

```tsx
import "@keepkit/ui/tailwind.css";
import { KeepThemeProvider } from "@keepkit/ui";

<KeepThemeProvider theme="ocean" mode="system" density="comfortable" radius="medium">
  <KeepCollection layout="grid" />
</KeepThemeProvider>;
```

色テーマは`default`、`ocean`、`forest`、`sunset`、`lavender`から選べます。既存の`compact`、`minimal`、`rounded`、`high-contrast`、`dark`も維持されています。`KeepKitProvider theme="forest" mode="dark"`のように、`theme`を`mode="light" | "dark" | "system"`、`density`、`radius`と組み合わせられます。テーマ選択UIにはexport済みの`keepThemeNames`を利用でき、`accentColor`、`highContrast`、`reducedMotion`、`variables={{ "--keep-card-gap": "1rem" }}`による上書きも可能です。

shadcn用のJSマップが必要な場合は`import { keepKitTheme } from "@keepkit/ui/tailwind"`を使えます。機能別に`@keepkit/ui/styles/base.css`、`button.css`、`collection.css`、`sync.css`だけを読み込むこともできます。`KeepButton`は`icons={{ save, saved, remove }}`、`iconOnly`、render propsで表示を差し替えられます。すべての標準コンポーネントは`data-state`、`data-loading`、`data-disabled`とARIA属性を維持します。

## English

KeepKit is an async, local-first toolkit for adding saved collections to React applications. In v0.16.0, it adds skeleton loading, feedback events, compound card parts, and container-query responsive layouts.

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
`@keepkit/ui` also provides `KeepItemCardSkeleton`, `KeepList loadingCount`, container-aware `layout="auto"`, `KeepItemCard.Media / Content / Title / Tags / Actions`, and external toast integration through `onFeedback` / `useKeepToastFeedback`.

Importing `@keepkit/ui/theme.css` enables the standard borders, surfaces, shadows, focus treatment, and decorative icons for save, search, remove, tags, sync, and other common actions. Accessible names still come from visible labels and ARIA attributes. Target individual controls through `data-keep-action`, or override `--keep-icon-size`, `--keep-control-gap`, `--keep-shadow`, `--keep-success`, and `--keep-warning`. Headless use without CSS and existing `KeepButton icons` overrides remain unchanged.

`keep.Collection` combines search, sorting, pagination, optional tag filtering and bulk actions, loading/empty/error states, and accessible live announcements. Search is debounced by 300ms by default; enable optional behavior with `features`.

Saved inputs contain only `id`, `meta`, `targetType`, `note`, and `tags`; persistence timestamps and normalization are handled by KeepKit. Collection queries use the canonical `query` shape with `search`, `sort`, and `pagination`.

The typed factory returns `Provider`, `Button`, `Collection`, `useItem`, `useList`, and `useShortcut`. `KeepSearchInput`, `KeepSortSelect`, `KeepPagination`, `KeepItemCheckbox`, `KeepTagEditor`, and `KeepBulkActions` are also available as standalone primitives. `KeepBulkActions` exposes `isAllSelected` / `toggleSelectAll` in its render-prop state and as standalone helpers. Use `@keepkit/core/core` for framework-neutral primitives, `@keepkit/core/react` for low-level React bindings, and `@keepkit/core/storage` for adapters.

See `examples/next-app-router` for the Server Component/client boundary pattern and `examples/next-pages-router` for the Pages Router integration.

### v0.16.0 URL, layouts, and setup presets

Use `<keep.Collection urlSync layout="grid" />` to synchronize search, tags, sorting, and pagination with shareable URLs and browser history. For Next.js Pages Router, pass `createNextPagesRouterAdapter(router)` as `urlAdapter`. Layouts are `list`, `grid`, and `compact`; customize thumbnails, tags, and detail navigation through `itemCardProps`.

Set `selectionScope="page" | "query" | "all"` on `KeepBulkActions` to choose the bulk-action range. Use `useKeepList().removeWithUndo` or `removeBatchWithUndo`, and mount `<KeepUndo />` for timed restoration. `KeepProvider autoRevalidation={{ intervalMs: 60000 }}` revalidates after hydration, on an interval, and after reconnecting.

Use `createKeepKitPreset({ mode: "local" | "sync" | "backup", scope, remote })` to compose isolated storage, sync queues, and backups for a user/tenant. Set `locale` to any of the 16 built-in locales; individual `labels` override the dictionary.

Use `createAuthenticatedSyncKit` when the host supplies authentication. It refreshes the token for each request, reports 401/403 failures through callbacks, isolates storage and queues by scope, and resumes durable offline work after reconnecting. See `examples/authenticated-sync` for a transport recipe.

Use `KeepItemStatusBadge`, `KeepStaleNotice`, and `KeepPruneStaleButton` for unavailable-item recovery. `KeepSyncStatusBanner` and `KeepSyncRecoveryDialog` expose retry, local/server/manual conflict resolution, and backup restoration guidance. Optionally import `@keepkit/ui/theme.css` for CSS-variable theming, dark mode, and mobile typography.
External detail URLs receive `target="_blank"` and `rel="noreferrer"` defaults. Unavailable cards expose `aria-disabled="true"` and normalized `data-item-status` values, while the recovery dialog compares local and remote updated dates and notes side by side.

### v0.16.0 Tailwind and shadcn theme

Tailwind CSS v4 needs only a CSS import. The theme is scoped by `KeepThemeProvider`, and its `--keep-*` tokens inherit shadcn/ui variables such as `--background`, `--primary`, and `--ring` when present.

```tsx
import "@keepkit/ui/tailwind.css";
import { KeepThemeProvider, KeepCollection } from "@keepkit/ui";

<KeepThemeProvider theme="ocean" mode="system" density="comfortable" radius="medium">
  <KeepCollection layout="grid" />
</KeepThemeProvider>;
```

Color themes are `default`, `ocean`, `forest`, `sunset`, and `lavender`. Existing `compact`, `minimal`, `rounded`, `high-contrast`, and `dark` presets remain available. `theme` composes with `mode`, `density`, and `radius`; for example, use `KeepKitProvider theme="forest" mode="dark"`. The exported `keepThemeNames` list can populate a theme selector. `accentColor`, `highContrast`, `reducedMotion`, and `variables` remain available for overrides. `.dark`, `prefers-color-scheme`, mobile one-column fallbacks, and reduced motion are built in. Import `keepKitTheme` from `@keepkit/ui/tailwind` when a JavaScript theme map is useful, or import only `@keepkit/ui/styles/base.css`, `button.css`, `collection.css`, and `sync.css`. `KeepButton` accepts `icons={{ save, saved, remove }}` and `iconOnly`, while render props remain the full escape hatch.

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
