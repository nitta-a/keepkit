# @keepkit/ui

[日本語](#日本語) | [English](#english)

## 日本語

Reactアプリケーション向けの標準利用パッケージです。`@keepkit/core`を内包し、Provider、保存ボタン、検索・ソート・ページング付きの一覧を少ないコードで構成できます。

```bash
pnpm add @keepkit/ui
```

## Minimal Starter Recipe

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

すべてのプリミティブは`data-state`を公開し、処理中は`data-loading="true"`、無効時は`data-disabled="true"`になります。`@keepkit/ui/theme.css`を読み込むと、標準の枠、面色、影、フォーカス表示と装飾アイコンが有効になります。個別の操作は`data-keep-action`で選択でき、`--keep-icon-size`、`--keep-control-gap`、`--keep-shadow`、`--keep-success`、`--keep-warning`で調整できます。CSSを読み込まないheadless利用と`KeepButton icons`による差し替えは維持されます。

```tsx
import "@keepkit/ui/theme.css";
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

`keep.Collection`は検索、ソート、ページング、loading / empty / error、ARIA live通知を標準で提供します。検索は既定で300msデバウンスされます。`features={{ tagFilter: true, bulkActions: true }}`でタグフィルターと一括操作も有効にできます。個別の`KeepList`、`KeepSearchInput`、`KeepSortSelect`、`KeepPagination`、`KeepItemCheckbox`、`KeepTagEditor`などは高度なレイアウト用に利用できます。`KeepBulkActions`はrender propsで操作UIを差し替えられ、`isAllSelected` / `toggleSelectAll`で表示中アイテムを一括操作できます。`KeepNoteEditor`は既定300msのデバウンス保存に対応し、`debounceMs={0}`でフォーム送信のみへ戻せます。通知領域だけを明示的に置く場合は`KeepAnnouncer`（`KeepAnnouncements`のalias）を使えます。
`KeepItemCard`は`href`、`onOpen`、`linkTarget`、`linkComponent`に対応し、保存アイテムから詳細ページへ遷移できます。非公開・期限切れ等の`status`を持つアイテムは自動的にリンクを無効化します。`KeepBackup`はJSONのエクスポート、merge / replaceインポート、結果件数、容量エラー表示を提供します。
外部URLの詳細リンクには`target="_blank"`と`rel="noreferrer"`が既定で補完され、利用できないカードには`aria-disabled="true"`と`data-item-status`が付与されます。同期競合ダイアログではローカルとリモートの更新日時・メモを並べて確認できます。

v0.15.0では`KeepCollection urlSync layout="list" | "grid" | "compact"`、`KeepBulkActions selectionScope="page" | "query" | "all"`、`KeepUndo`を利用できます。`createNextPagesRouterAdapter`はNext.js Pages Router用の注入adapterです。`locale`は英語、日本語、韓国語、中国語簡体字・繁体字、タイ語、フランス語、スペイン語、ポルトガル語、イタリア語、ドイツ語、ロシア語、フィリピン語、ベトナム語、インドネシア語、マレー語の16言語に対応し、`labels`で上書きできます。認証付き同期は`createAuthenticatedSyncKit`から利用できます。
Phase 4の状態UIとして`KeepItemStatusBadge`、`KeepStaleNotice`、`KeepPruneStaleButton`、`KeepSyncStatusBanner`、`KeepSyncRecoveryDialog`を利用できます。`import "@keepkit/ui/theme.css"`でテーマCSSを有効にできます。

### Tailwind／shadcnテーマ

```tsx
import "@keepkit/ui/tailwind.css";
import { KeepThemeProvider, KeepCollection } from "@keepkit/ui";

<KeepThemeProvider theme="ocean" mode="system" density="comfortable" radius="medium">
  <KeepCollection layout="grid" />
</KeepThemeProvider>;
```

色テーマは`default`、`ocean`、`forest`、`sunset`、`lavender`から選べます。既存の`compact`、`minimal`、`rounded`、`high-contrast`、`dark`も引き続き利用できます。`theme`は`mode`、`density`、`radius`と独立しており、`KeepKitProvider theme="forest" mode="dark"`のように組み合わせられます。選択肢をUIへ表示する場合は`keepThemeNames`を利用できます。

shadcn/uiの`--background`、`--foreground`、`--card`、`--muted`、`--border`、`--primary`、`--destructive`、`--ring`を継承し、KeepKit固有の値は`--keep-*`に分離されます。`variables`、`accentColor`、`highContrast`、`reducedMotion`による上書きも維持されます。`keepKitTheme`は`@keepkit/ui/tailwind`から、分割CSSは`@keepkit/ui/styles/base.css`、`button.css`、`collection.css`、`sync.css`から読み込めます。`KeepButton icons={{ save, saved, remove }}`と`iconOnly`でLucide等へ差し替えられます。

Viewer向け保存カードとカスタムテーマは次のように構成できます。`savedAt`、タイトル、タグ、詳細リンク、保存解除ボタン、期限切れ表示は`KeepItemCard`の標準markupに含まれます。

```tsx
import "@keepkit/ui/theme.css";
import { KeepItemCard, KeepThemeProvider } from "@keepkit/ui";

<KeepThemeProvider
  theme="rounded"
  variables={{ "--keep-primary": "oklch(0.55 0.2 250)", "--keep-card-gap": "0.75rem" }}
>
  <KeepItemCard
    item={item}
    href={`/guide/${item.id}`}
    getImageProps={(entry) => ({ src: entry.meta.image, alt: entry.meta.title })}
  />
</KeepThemeProvider>;
```

状態は色だけに依存せず、ラベルと属性でも利用できます。`[data-state="saved"]`、`[data-state="unsaved"]`、`[data-loading="true"]`、`[data-state="error"]`、`[data-state="empty"]`、`[data-state="stale"]`、`[data-status="expired"]`、`[data-status="removed"]`、`[data-state="selected"]`をホストCSSやTailwindのdata variantから参照できます。既存テーマから移行する場合は、`@keepkit/ui/theme.css`を残したまま`--keepkit-*`参照を`--keep-*`へ置き換えてください。Pages Routerでは`createNextPagesRouterAdapter(router)`を`urlAdapter`へ注入します。

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

`keep.Collection` includes search, sorting, pagination, loading/empty/error states, and polite live announcements. Search is debounced by 300ms by default. Enable `features={{ tagFilter: true, bulkActions: true }}` for tag filtering and bulk operations. Use the individual `KeepList`, `KeepSearchInput`, `KeepSortSelect`, `KeepPagination`, `KeepItemCheckbox`, and `KeepTagEditor` primitives when you need a custom layout. `KeepBulkActions` supports render props and exposes `isAllSelected` / `toggleSelectAll` for visible-item selection. `KeepNoteEditor` auto-saves dirty notes after 300ms by default; set `debounceMs={0}` to use form submission only. Mount `KeepAnnouncer` (`KeepAnnouncements` alias) when you need the live region explicitly.

The opt-in theme adds neutral borders, surfaces, shadows, focus treatment, and decorative action icons without changing accessible names. Target individual controls with `data-keep-action`, or override `--keep-icon-size`, `--keep-control-gap`, `--keep-shadow`, `--keep-success`, and `--keep-warning`. Consumers that omit the CSS keep the headless markup, and `KeepButton icons` continues to take precedence over the built-in icon.
`KeepItemCard` accepts `href`, `onOpen`, `linkTarget`, and `linkComponent` for detail-page navigation. Links are disabled for unavailable `status` values such as private or expired. `KeepBackup` provides JSON export, merge/replace import, result counts, and quota-error messaging.
External detail URLs receive `target="_blank"` and `rel="noreferrer"` defaults. Unavailable cards expose `aria-disabled="true"` and normalized `data-item-status` values, and the sync recovery dialog compares local and remote updated dates and notes side by side.

In v0.15.0, use `KeepCollection urlSync` with `layout="list" | "grid" | "compact"`, `KeepBulkActions selectionScope="page" | "query" | "all"`, and `KeepUndo`. `createNextPagesRouterAdapter` is the injected adapter for Next.js Pages Router. `locale` includes complete dictionaries for 16 built-in locales; `labels` overrides individual entries. Authenticated sync is available through `createAuthenticatedSyncKit`.
Phase 4 adds `KeepItemStatusBadge`, `KeepStaleNotice`, `KeepPruneStaleButton`, `KeepSyncStatusBanner`, and `KeepSyncRecoveryDialog` for unavailable items, sync failures, conflict resolution, and backup recovery. Import `@keepkit/ui/theme.css` or `@keepkit/ui/tailwind.css` for the opt-in theme layer.

### Tailwind and shadcn theme

```tsx
import "@keepkit/ui/tailwind.css";
import { KeepThemeProvider, KeepCollection } from "@keepkit/ui";

<KeepThemeProvider theme="ocean" mode="system" density="comfortable" radius="medium">
  <KeepCollection layout="grid" />
</KeepThemeProvider>;
```

Color themes include `default`, `ocean`, `forest`, `sunset`, and `lavender`. Existing `compact`, `minimal`, `rounded`, `high-contrast`, and `dark` presets remain available. `theme` composes independently with `mode`, `density`, and `radius`, so `theme="forest" mode="dark"` is supported. Use the exported `keepThemeNames` list when building a selector.

The scoped `--keep-*` tokens inherit shadcn/ui variables, and the provider supports `.dark`, system preference, `variables`, `accentColor`, `highContrast`, and `reducedMotion`. Use `keepKitTheme` from `@keepkit/ui/tailwind`, feature CSS from `@keepkit/ui/styles/*`, and `icons={{ save, saved, remove }}` / `iconOnly` on `KeepButton` for Lucide or shadcn replacements. The existing Next.js Pages Router recipe remains unchanged: inject `createNextPagesRouterAdapter(router)` into `urlAdapter`.

For a Viewer card, the default `KeepItemCard` markup includes the title, tags, saved date, detail link, remove action, thumbnail, and expired-item notice. Override tokens without replacing the markup, or use render props for a complete replacement:

```tsx
import "@keepkit/ui/theme.css";
import { KeepItemCard, KeepThemeProvider } from "@keepkit/ui";

<KeepThemeProvider
  theme="rounded"
  variables={{ "--keep-primary": "oklch(0.55 0.2 250)", "--keep-card-gap": "0.75rem" }}
>
  <KeepItemCard
    item={item}
    href={`/guide/${item.id}`}
    getImageProps={(entry) => ({ src: entry.meta.image, alt: entry.meta.title })}
  />
</KeepThemeProvider>;
```

Use `[data-state="saved"]`, `[data-state="unsaved"]`, `[data-loading="true"]`, `[data-state="error"]`, `[data-state="empty"]`, `[data-state="stale"]`, `[data-status="expired"]`, `[data-status="removed"]`, and `[data-state="selected"]` from host CSS or Tailwind data variants. For migration, keep importing `@keepkit/ui/theme.css` while replacing direct `--keepkit-*` references with `--keep-*`. In the Pages Router, inject `createNextPagesRouterAdapter(router)` into `urlAdapter`.

Collection queries use one canonical shape: `targetType`, `tags`, `search`, `sort`, `pagination`, `filter`, and `savedBetween`. Saved item inputs contain only `id`, `meta`, `targetType`, `note`, and `tags`; KeepKit owns persistence timestamps.

Framework-neutral APIs remain available from `@keepkit/core/core`, low-level React bindings from `@keepkit/core/react`, and storage adapters from `@keepkit/core/storage`.
