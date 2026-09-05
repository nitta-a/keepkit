# Release notes

## [0.26.1] - 2026-09-05

### 日本語

#### 修正

- リリース検証時のBiome整形チェックに合格するよう、VS Code設定のフォーマットを修正しました。

### English

#### Fixed

- Fixed the VS Code settings formatting so the release validation workflow passes its Biome check.

## [0.26.0] - 2026-09-05

### 日本語

#### 追加・改善

- `KeepWorkspace`に領域別の`surface`（`plain` / `compact` / `panel`）と有限の`sectionGap`を追加しました。空のslotは枠を生成しません。
- `KeepCollection`に`toolbarLayout="grouped"`、`toolbarVariant="panel"`、`toolbarStart` / `toolbarEnd` slotを追加し、検索・ソート・フィルターをローカライズされたARIAグループへ整理しました。
- `KeepItemCard`に`cardVariant`を追加し、カードとsurfaceを個別に調整できるテーマトークンとWorkspace用CSS exportを公開しました。

### English

#### Added and changed

- Added per-region `surface` (`plain` / `compact` / `panel`) and finite `sectionGap` options to `KeepWorkspace`; empty slots do not create frames.
- Added `toolbarLayout="grouped"`, `toolbarVariant="panel"`, and `toolbarStart` / `toolbarEnd` slots to `KeepCollection`, with localized ARIA groups for query and filter controls.
- Added `cardVariant` to `KeepItemCard`, independent card/surface theme tokens, and a public Workspace stylesheet export.

## [0.25.0] - 2026-09-05

### 日本語

#### 追加・改善

- `KeepCollection reorderable`にドラッグ、Space把持、矢印キー並び替え、ドロップ位置表示、Undoを統合しました。
- `KeepItemCard showEditButton`と標準QuickEditorダイアログ、`editSlot`を追加しました。
- `archiveScope`（`active` / `archived` / `all`）とURL同期、16言語のラベルを追加しました。
- `useKeepCollections({ targetType, orderBy })`を追加し、QuickEditorとコレクション選択UIへ接続しました。
- `KeepTourBar`に`getItemHref`、`getBackHref`、`onNavigate`を追加しました。

### English

#### Added and changed

- Integrated drag, Space-to-grab, arrow-key reordering, drop indicators, and undo into `KeepCollection reorderable`.
- Added the standard QuickEditor dialog through `KeepItemCard showEditButton`, with `editSlot` customization.
- Added `archiveScope` (`active` / `archived` / `all`), URL synchronization, and labels across all 16 locales.
- Added `useKeepCollections({ targetType, orderBy })` and connected it to QuickEditor and collection selectors.
- Added `getItemHref`, `getBackHref`, and `onNavigate` to `KeepTourBar` for host routing integration.

## [0.23.2] - 2026-09-05

### 日本語

#### 追加・改善

- `KeepCollection features`で標準カードのピン留め、アーカイブ、タグ表示を個別に切り替えられるようにしました。
- `itemCardProps`の`showPinButton`、`showArchiveButton`、`showTags`を指定した場合は、コレクション設定より優先するようにしました。
- UIパッケージのREADMEに、機能を絞った構成例を追加しました。

### English

#### Added and changed

- Added independent `KeepCollection features` toggles for standard card pinning, archiving, and tag display.
- Explicit `itemCardProps` values for `showPinButton`, `showArchiveButton`, and `showTags` take precedence over collection features.
- Added focused feature-configuration examples to the UI package documentation.

## [0.19.0] - 2026-09-04

### 日本語

#### 追加・改善

- `KeepActiveFiltersSummary`で検索語と選択タグをチップ表示し、個別解除と一括クリアを行えるようにしました。
- `KeepEmptyState`が保存アイテム未登録と絞り込み結果0件を区別し、結果0件ではフィルターをクリアして復帰できるようにしました。
- `KeepShortcutHint`、`KeepTourBar showShortcutHint`、`KeepNoteEditor showShortcutHint`でキーボード操作を視覚的に確認できるようにしました。
- `mergeProps` / `createSlot`を追加し、`asChild`のclassName、style、ARIA属性、イベントハンドラ合成を共通化しました。

### English

#### Added and changed

- Added `KeepActiveFiltersSummary` chips for search and selected tags, with individual removal and clear-all actions.
- `KeepEmptyState` now distinguishes an empty storage from zero filtered results and provides filter recovery for the latter.
- Added `KeepShortcutHint`, `KeepTourBar showShortcutHint`, and `KeepNoteEditor showShortcutHint` for visible keyboard-operation hints.
- Added shared `mergeProps` / `createSlot` utilities for composing `asChild` className, style, ARIA attributes, and event handlers.

## [0.17.0] - 2026-09-04

### 日本語

#### 追加・改善

- `KeepItem.order`と`reorderItems` / `moveItem`を追加し、既存ストレージで保存アイテムの巡回順を永続化できるようにしました。
- `getKeepNavigationState`と`useKeepNavigator`で、現在・前・次のアイテムと進行度を取得できるようにしました。
- `KeepTourBar` / `KeepNavigator`、`useKeepTourShortcuts`、`KeepReorderableList`を追加しました。
- Core、UI、demoのテストと公開パッケージ検証を更新しました。

### English

#### Added and changed

- Added `KeepItem.order`, `reorderItems`, and `moveItem` for persisted saved-item route ordering with existing storage adapters.
- Added `getKeepNavigationState` and `useKeepNavigator` for current, previous, next, and progress state.
- Added `KeepTourBar` / `KeepNavigator`, `useKeepTourShortcuts`, and `KeepReorderableList`.
- Updated Core, UI, and demo tests plus publishable-package verification.

## [0.16.0] - 2026-09-04

### 日本語

#### 追加・改善

- `KeepItemCardSkeleton`と`KeepList loadingCount`を追加し、初回ロード時のレイアウトシフトを抑制しました。`prefers-reduced-motion`にも対応します。
- `KeepUiProvider onFeedback`と`useKeepToastFeedback`を追加し、保存、削除、Undo復元、同期成功／失敗、stale pruneを外部通知へ接続できるようにしました。
- `KeepItemCard.Media / Content / Title / Tags / Actions`のCompound APIを追加し、既存のprops形式も維持しました。
- `layout="auto"`とコンテナクエリにより、サイドバーやモーダルなど配置領域の幅に応じて一覧列数を切り替えられるようにしました。
- demoとUIテストを更新し、`@keepkit/core`と`@keepkit/ui`を`0.16.0`へ更新しました。

### English

#### Added and changed

- Added `KeepItemCardSkeleton` and `KeepList loadingCount` to reduce initial layout shift, with `prefers-reduced-motion` support.
- Added `KeepUiProvider onFeedback` and `useKeepToastFeedback` for save, remove, undo restoration, sync success/failure, and stale-prune notifications.
- Added composable `KeepItemCard.Media / Content / Title / Tags / Actions` parts while preserving the existing props-based card API.
- Added `layout="auto"` and container queries so list columns respond to the placement container, including sidebars and modals.
- Updated the demo and UI tests, and bumped `@keepkit/core` and `@keepkit/ui` to `0.16.0`.

## [0.15.0] - 2026-09-03

### 日本語

#### 追加・改善

- opt-inの`@keepkit/ui/theme.css`へ、カード、検索・ソート、ページング、タグ、編集、一括操作、状態・同期UIの枠、面色、影、hover、focus、disabled表現を追加しました。
- 保存、検索、並び替え、ページ移動、削除、タグ、ノート、再試行、同期、バックアップ、Undoへ依存なしの装飾アイコンと`data-keep-action`を追加しました。
- `default`、`ocean`、`forest`、`sunset`、`lavender`のカラーテーマと、選択肢を列挙する`keepThemeNames`を追加しました。`theme`は`mode`、`density`、`radius`と組み合わせられます。
- デモを`KeepCollection`、`KeepItemCard`、`KeepNoteEditor`中心の構成へ変更し、テーマ切替、検索、ソート、タグフィルター、ページングを確認できるようにしました。
- CSS未導入、render props、`asChild`、ローカライズ、ARIA名、既存の`KeepButton.icons`を維持しました。
- `@keepkit/core`と`@keepkit/ui`を`0.15.0`へ更新しました。

### English

#### Added and changed

- Expanded the opt-in `@keepkit/ui/theme.css` with borders, surfaces, shadows, hover, focus, and disabled treatments across cards, query controls, pagination, tags, editors, bulk actions, status, and sync UI.
- Added dependency-free decorative icons and `data-keep-action` hooks for save, search, sort, pagination, removal, tags, notes, retry, sync, backup, and undo actions.
- Added `default`, `ocean`, `forest`, `sunset`, and `lavender` color themes plus the exported `keepThemeNames` list. Themes compose with `mode`, `density`, and `radius`.
- Rebuilt the demo around `KeepCollection`, `KeepItemCard`, and `KeepNoteEditor`, with live theme switching, search, sorting, tag filtering, and pagination.
- Preserved CSS-free usage, render props, `asChild`, localization, accessible names, and existing `KeepButton.icons` overrides.
- Updated `@keepkit/core` and `@keepkit/ui` to `0.15.0`.

## [0.14.0] - 2026-09-02

### 日本語

#### 追加・改善

- `KeepLayout`、`KeepList`、`KeepCollection`のレイアウト指定を安定した`data-layout`属性へ統一し、テーマCSSからレスポンシブに適用できるようにしました。
- `KeepItemCard`と`KeepItemStatusBadge`の状態表示を強化し、期限切れ・削除済み・制限付きアイテムを明示できるようにしました。
- 外部詳細リンクに`target="_blank"`と`rel="noreferrer"`を既定設定し、利用できないアイテムのリンクを無効化しました。
- 同期競合復旧ダイアログにローカル／リモートの更新日時とメモの比較表示、busy・errorのアクセシビリティ属性を追加しました。
- テーマCSSのダークモード、reduced-motion、保存アニメーション、状態別スタイル、16言語の追加ラベルを整備しました。
- `@keepkit/core`と`@keepkit/ui`を`0.14.0`へ更新しました。

### English

#### Added and changed

- Standardized `data-layout` attributes across `KeepLayout`, `KeepList`, and `KeepCollection` so responsive layouts can be applied from theme CSS.
- Strengthened status presentation in `KeepItemCard` and `KeepItemStatusBadge` for expired, removed, and restricted items.
- Added safe defaults of `target="_blank"` and `rel="noreferrer"` for external detail links and disabled links for unavailable items.
- Added local/remote updated-at and note previews plus busy and error accessibility attributes to the sync recovery dialog.
- Improved theme CSS for dark mode, reduced motion, save feedback animation, state styling, and the additional labels across all 16 locales.
- Updated `@keepkit/core` and `@keepkit/ui` to `0.14.0`.

## [0.13.0] - 2026-09-01

### 日本語

#### 追加・改善

- `KeepThemeProvider`、`default`／`compact`／`minimal`／`rounded`／`high-contrast`／`dark`プリセット、shadcn/ui互換の`--keep-*`トークン、Tailwind CSS v4の`@keepkit/ui/tailwind.css`を追加しました。
- Viewer向けカード／一覧レイアウト、レスポンシブトークン、状態別スタイル、reduced-motion、高コントラスト、Lucide等の`KeepButton`アイコン差し替えを追加しました。
- `@keepkit/ui/styles/base.css`、`button.css`、`collection.css`、`sync.css`の機能別importを追加しました。
- `@keepkit/core`と`@keepkit/ui`を`0.13.0`へ更新しました。

### English

#### Added and changed

- Added `KeepThemeProvider`, six theme presets, shadcn-compatible `--keep-*` tokens, and the Tailwind CSS v4 `@keepkit/ui/tailwind.css` entry point.
- Added Viewer card/list layouts, responsive tokens, state styling, reduced-motion and high-contrast support, and replaceable `KeepButton` icons for Lucide-style components.
- Added feature-level CSS imports: `@keepkit/ui/styles/base.css`, `button.css`, `collection.css`, and `sync.css`.
- Updated `@keepkit/core` and `@keepkit/ui` to `0.13.0`.

## [0.12.0] - 2026-08-31

### 日本語

#### 追加・改善

- npm公開時にCore公開後のレジストリ反映を待機し、Core/UIのタグ・README・package.json・公開済みパッケージを自動検証するリリースゲートを追加しました。
- `@keepkit/ui`に16言語の完全な標準ラベル辞書とロケールaliasを追加しました。
- `createAuthenticatedSyncKit`を追加し、リクエストごとのトークン取得、401/403通知、user/tenant scope分離、永続オフラインキュー、scope変更時のキャッシュパージを提供します。
- `KeepItemStatusBadge`、`KeepStaleNotice`、`KeepPruneStaleButton`を追加し、期限切れ・削除済みアイテムの再取得と一括削除に対応しました。
- `KeepSyncStatusBanner`、`KeepSyncRecoveryDialog`、同期競合のローカル優先／サーバー優先／手動マージを追加しました。
- `@keepkit/ui/theme.css`とCSS変数による任意テーマ、ダークモード、モバイル向けタイポグラフィを追加しました。
- `@keepkit/core`と`@keepkit/ui`を`0.12.0`へ更新しました。

### English

#### Added and changed

- Added release gates that wait for npm registry propagation after the core publish and verify package versions, README versions, and isolated latest-package installation before completion.
- Added complete built-in label dictionaries for all 16 supported locales with locale aliases.
- Added `createAuthenticatedSyncKit` with per-request token loading, 401/403 callbacks, user/tenant scope isolation, durable offline queues, and cache purging on scope changes.
- Added `KeepItemStatusBadge`, `KeepStaleNotice`, and `KeepPruneStaleButton` for expired or removed items, retry actions, and bulk cleanup.
- Added `KeepSyncStatusBanner`, `KeepSyncRecoveryDialog`, and local/server/manual conflict resolution for sync recovery.
- Added optional `@keepkit/ui/theme.css` with CSS variables, dark mode, and mobile typography.
- Updated `@keepkit/core` and `@keepkit/ui` to `0.12.0`.

## [0.11.0] - 2026-08-31

### 日本語

#### 追加・改善

- `encodeKeepListQuery` / `decodeKeepListQuery`と`KeepCollection urlSync`を追加し、検索・タグ・ソート・ページをURL、戻る／進む、共有URLと同期できるようにしました。`createNextPagesRouterAdapter`でNext.js Pages Routerにも接続できます。
- `KeepCollection` / `KeepList`に`list`、`grid`、`compact`のレスポンシブレイアウトプリセットを追加し、`KeepItemCard`にサムネイル、タグ、詳細リンク、保存解除の差し替えAPIを追加しました。
- `KeepBulkActions`に`page`、`query`、`all`の選択範囲を追加し、検索結果全体と全保存アイテムを一括操作できるようにしました。
- `removeItemWithUndo` / `removeItemsWithUndo`、`undoLastRemoval`、`KeepUndo`を追加しました。期限内の復元、同期エラー時の自動復元に対応します。
- `ja`、`en`、`ko`、`zh-CN`、`zh-TW`の標準ラベル辞書を追加し、既存の`labels`で個別ラベルを上書きできるようにしました。
- `ScopedStorageAdapter`、`ScopedSyncQueueAdapter`、`createKeepKitPreset`を追加し、ユーザー／テナント単位の保存・キュー・バックアップ導入を簡略化しました。
- `autoRevalidation`で一覧表示後、一定間隔、オンライン復帰時の再検証を自動化できるようにしました。
- `@keepkit/core`と`@keepkit/ui`を`0.11.0`へ更新しました。

### English

#### Added and changed

- Added `encodeKeepListQuery` / `decodeKeepListQuery` and `KeepCollection urlSync` for URL-shared search, tag, sort, and page state, including browser back/forward. `createNextPagesRouterAdapter` connects to the Next.js Pages Router without a Next dependency.
- Added responsive `list`, `grid`, and `compact` layout presets to `KeepCollection` / `KeepList`, plus thumbnail, tag, detail-link, and remove customization to `KeepItemCard`.
- Added `page`, `query`, and `all` selection scopes to `KeepBulkActions` for bulk actions across the current page, the full search result, or every saved item.
- Added `removeItemWithUndo` / `removeItemsWithUndo`, `undoLastRemoval`, and `KeepUndo`, including timed restoration and automatic restoration after a sync failure.
- Added built-in `ja`, `en`, `ko`, `zh-CN`, and `zh-TW` label dictionaries; individual labels still override the dictionary.
- Added `ScopedStorageAdapter`, `ScopedSyncQueueAdapter`, and `createKeepKitPreset` to simplify user/tenant-isolated storage, queues, and backups.
- Added `autoRevalidation` for validation after hydration, on an interval, and when the browser reconnects.
- Updated `@keepkit/core` and `@keepkit/ui` to `0.11.0`.

## [0.10.0] - 2026-08-31

### 日本語

#### 追加・改善

- `KeepItemCard`に詳細ページ用の`href`、`onOpen`、差し替え可能な`linkComponent`、新しいタブ指定を追加しました。利用できない保存対象のリンクは無効化されます。
- `KeepItem`に`status`と`statusReason`を追加し、`KeepProvider`の`validateItem` / `resolveItem`で期限切れ・削除済み・非公開状態を再検証できるようにしました。
- `SyncStorageAdapter`にユーザー／テナント単位のキュー分離、再試行、バックオフ、`retrySync()`を追加しました。
- `@keepkit/ui`にJSONのエクスポート／インポート、merge / replace選択、結果件数、容量エラー表示を行う`KeepBackup`を追加しました。
- `@keepkit/core`と`@keepkit/ui`を`0.10.0`へ更新しました。

### English

#### Added and changed

- Added `href`, `onOpen`, replaceable `linkComponent`, and new-tab options to `KeepItemCard`; unavailable saved items now disable detail links.
- Added `status` and `statusReason` to `KeepItem`, with `KeepProvider` `validateItem` / `resolveItem` hooks for expired, removed, and private content.
- Added user/tenant queue isolation, retries, backoff, and `retrySync()` to `SyncStorageAdapter`.
- Added `KeepBackup` to `@keepkit/ui` for JSON export/import, merge/replace selection, result counts, and quota-error messaging.
- Updated `@keepkit/core` and `@keepkit/ui` to `0.10.0`.

## [0.9.0] - 2026-08-31

### 日本語

#### 追加・改善

- `@keepkit/ui`の各UIプリミティブに`data-state`、処理中の`data-loading="true"`、無効状態の`data-disabled="true"`を追加し、ホストアプリのCSS/Tailwindから状態を直接装飾できるようにしました。
- `@keepkit/core/react`に`KeepErrorBoundary`を追加し、`KeepProvider`、`KeepCollection`、`KeepList`で`fallback`、`onBoundaryError`、`boundaryResetKey`を利用できるようにしました。
- demoとNext.js Examplesで`exactOptionalPropertyTypes`を有効化し、strictなconsumer設定での型互換性を検証しました。
- READMEにMinimal Starter Recipeとdata属性・エラー境界の利用方法を追加しました。
- `@keepkit/core`と`@keepkit/ui`を`0.9.0`へ更新しました。

### English

#### Added and changed

- Added `data-state`, `data-loading="true"` while work is pending, and `data-disabled="true"` to UI primitives so host CSS and Tailwind data variants can style state directly.
- Added `KeepErrorBoundary` to `@keepkit/core/react`; `KeepProvider`, `KeepCollection`, and `KeepList` now accept `fallback`, `onBoundaryError`, and `boundaryResetKey`.
- Enabled `exactOptionalPropertyTypes` in the demo and Next.js examples to verify compatibility with strict consumer configurations.
- Added a Minimal Starter Recipe and documented data attributes and render-error boundaries in the READMEs.
- Updated `@keepkit/core` and `@keepkit/ui` to `0.9.0`.

## [0.8.0] - 2026-08-31

### 日本語

#### 追加・改善

- `KeepTagEditor`がIME変換中のEnterをタグ追加として処理しないようにしました。
- `KeepBulkActions`に表示中アイテム向けの`isAllSelected` / `toggleSelectAll`状態とヘルパーを追加しました。ページやquery外の選択は全解除時も維持されます。
- GitHub Actionsで`@keepkit/core`のnpm反映を確認してから`@keepkit/ui`を公開し、公開済みバージョンを隔離環境から検証するようにしました。
- Next.js Pages Router / App Router Examplesをpnpm workspaceへ追加し、Turbo経由のbuild / typecheckをCIで実行するようにしました。
- `@keepkit/core`と`@keepkit/ui`を`0.8.0`へ更新しました。

### English

#### Added and changed

- Guarded `KeepTagEditor` so Enter during IME composition is not treated as a tag submission.
- Added `isAllSelected` / `toggleSelectAll` state and helpers to `KeepBulkActions` for visible items, preserving selections outside the current page or query when deselecting.
- Updated GitHub Actions to wait for `@keepkit/core` to propagate on npm before publishing `@keepkit/ui`, then verify the exact release versions in an isolated environment.
- Added both Next.js examples to the pnpm workspace and run their Turbo build/typecheck tasks in CI.
- Updated `@keepkit/core` and `@keepkit/ui` to `0.8.0`.

## [0.7.0] - 2026-08-31

### 日本語

#### 追加・改善

- `@keepkit/ui`の実装を`KeepButton`、`KeepList`、`KeepCollection`、編集・一括操作・状態表示などのコンポーネント単位へ分割し、公開importを維持しました。
- `KeepNoteEditor`に既定300msのデバウンス保存、`debounceMs={0}`、Ctrl/Cmd+Enterによる保存を追加しました。
- `KeepAnnouncer`を追加し、既存の`KeepAnnouncements`と同じ通知機構を単一コンポーネント名でも利用できるようにしました。
- `@keepkit/ui`自身にTesting Library、jsdom、Vitestによるキーボード・ARIA属性・デバウンス保存テストを追加しました。
- 公開後の隔離ディレクトリで`@keepkit/core@latest`と`@keepkit/ui@latest`をimport検証するリリースステップを追加しました。
- `@keepkit/core`と`@keepkit/ui`を`0.7.0`へ更新しました。

### English

#### Added and changed

- Split `@keepkit/ui` into component-level modules for buttons, lists, collections, editing, bulk actions, and status UI while preserving public imports.
- Added 300ms debounced note saving to `KeepNoteEditor`, configurable with `debounceMs={0}`, plus Ctrl/Cmd+Enter confirmation.
- Added `KeepAnnouncer` as a singular alias for the existing `KeepAnnouncements` live-region mechanism.
- Added package-local Testing Library, jsdom, and Vitest coverage for keyboard interaction, ARIA attributes, and debounced note persistence.
- Added a post-publish isolated-directory import verification for `@keepkit/core@latest` and `@keepkit/ui@latest`.
- Updated `@keepkit/core` and `@keepkit/ui` to `0.7.0`.

## [0.6.0] - 2026-08-31

### 日本語

#### 追加・改善

- `@keepkit/ui`の実装をUIコンテキスト、クエリ操作、選択操作などの機能別モジュールへ分割し、既存の公開importは維持しました。
- `KeepSearchInput`に既定300msのデバウンスと`debounceMs`を追加しました。
- `KeepSortSelect`の保存日時／更新日時ラベルを明確化し、`KeepPagination`に番号ボタンと`aria-current="page"`を追加しました。
- `KeepItemCheckbox`を公開し、`KeepBulkActions`にrender propsのヘッドレス状態APIを追加しました。
- `KeepTagEditor`で入力欄が空のときBackspaceで最後のタグを削除できるようにしました。
- `KeepKitProvider`が`KeepAnnouncements`を内包し、保存・削除・ノート更新の通知をアプリ全体で利用できるようにしました。
- Next.js App RouterのServer Componentとclient boundaryの公式サンプルを`examples/next-app-router`に追加しました。
- `@keepkit/core`と`@keepkit/ui`を`0.6.0`へ更新しました。

### English

#### Added and changed

- Split `@keepkit/ui` into feature-oriented modules for UI context, query controls, and selection while preserving the existing public imports.
- Added a 300ms default debounce to `KeepSearchInput`, configurable through `debounceMs`.
- Clarified saved/updated date labels in `KeepSortSelect` and added numbered buttons with `aria-current="page"` to `KeepPagination`.
- Published `KeepItemCheckbox` and added a render-prop headless state API to `KeepBulkActions`.
- `KeepTagEditor` now removes the last tag with Backspace when its input is empty.
- `KeepKitProvider` now includes `KeepAnnouncements` so save, remove, and note-update feedback is available app-wide.
- Added an official Next.js App Router example in `examples/next-app-router` showing the Server Component and client-boundary split.
- Updated `@keepkit/core` and `@keepkit/ui` to `0.6.0`.

## [0.5.0] - 2026-08-31

### 日本語

#### 破壊的変更

- `KeepItemInput`を`id`付きの最小入力に統一し、`savedAt` / `updatedAt`はKeepKitが生成するようにしました。
- `useKeepItem(id, payload)`を`useKeepItem(item)`へ変更しました。
- `useKeepShortcut({ id, itemPayload })`を`useKeepShortcut({ item })`へ変更しました。
- `KeepListOptions`を`KeepListQuery`へ変更し、`search`、`sort`、`pagination`に一覧条件を統一しました。
- UIコンポーネントの`options` / `listOptions`を`query`へ変更しました。
- `createKeepKit`の戻り値を`Provider`、`Button`、`Collection`、`useContext`、`useItem`、`useList`、`useShortcut`へ整理しました。

#### 追加・改善

- `KeepKitProvider`を追加し、coreの状態管理とUIラベル設定を一つのProviderに統合しました。
- `KeepCollection`を追加し、検索、ソート、ページング、状態表示、ARIA通知を標準化しました。
- `@keepkit/ui`から主要なstorage adapterを利用できるようにし、通常のReactアプリでは依存パッケージを一つに集約しました。
- `useKeepList`と`queryKeepItems`がページ情報、次ページ有無、前ページ有無を返すようにしました。

### English

#### Breaking changes

- Simplified `KeepItemInput` to an ID-based minimal input; KeepKit now owns persistence timestamps.
- Replaced `useKeepItem(id, payload)` with `useKeepItem(item)`.
- Replaced `useKeepShortcut({ id, itemPayload })` with `useKeepShortcut({ item })`.
- Replaced `KeepListOptions` with `KeepListQuery`, consolidating conditions under `search`, `sort`, and `pagination`.
- Renamed UI `options` / `listOptions` props to `query`.
- `createKeepKit` now returns `Provider`, `Button`, `Collection`, `useContext`, `useItem`, `useList`, and `useShortcut`.

#### Added and changed

- Added `KeepKitProvider` to combine core state and UI labels.
- Added `KeepCollection` with built-in search, sorting, pagination, status states, and live announcements.
- Re-exported the primary storage adapters from `@keepkit/ui` for a shorter standard React setup.
- Added page metadata and navigation flags to `useKeepList` and `queryKeepItems`.

## [0.4.0] - 2026-08-31

### 日本語

#### 破壊的変更

- `@keepkit/ui` のpeer dependencyを `@keepkit/core >=0.4.0` に更新しました。
- `KeepItemCard.getImageUrl` を廃止し、`getImageProps`、`imageComponent`、`renderImage` による画像差し替えAPIへ移行しました。

#### 追加・改善

- `KeepSearchInput`、`KeepSortSelect`、`KeepPagination` を追加しました。
- `KeepTagEditor`、`KeepBulkActions` と複数選択・一括削除・一括タグ更新を追加しました。
- `KeepUiProvider`、`labels`、`locale`、`labelResolver` によるUI全体のラベル管理を追加しました。
- `KeepAnnouncements` とcoreの `lastChange` により、保存・削除・ノート保存の成功を `aria-live` で通知できるようにしました。
- Next.js 15 Pages Router、SSR/hydration、Jest、Testing Library、Next Imageの公式サンプルを拡充しました。
- UI動作テストとヘッドレスUIのカスタマイズ仕様ドキュメントを拡充しました。

### English

#### Breaking changes

- Updated the `@keepkit/ui` peer dependency to `@keepkit/core >=0.4.0`.
- Replaced `KeepItemCard.getImageUrl` with the structured `getImageProps`, `imageComponent`, and `renderImage` image API.

#### Added and changed

- Added `KeepSearchInput`, `KeepSortSelect`, and `KeepPagination`.
- Added `KeepTagEditor`, `KeepBulkActions`, multi-item selection, bulk deletion, and bulk tag updates.
- Added app-wide labels through `KeepUiProvider`, `labels`, `locale`, and `labelResolver`.
- Added `KeepAnnouncements` and core `lastChange` support for `aria-live` success messages after saves, removals, and note saves.
- Expanded the official Next.js 15 Pages Router example with SSR/hydration, Jest, Testing Library, and Next Image guidance.
- Expanded UI behavior tests and headless customization documentation.

## [0.3.0] - 2026-08-31

### 日本語

- `@keepkit/ui` パッケージを追加し、`KeepList`、`KeepItemCard`、`KeepTagFilter`、`KeepNoteEditor`、`KeepEmptyState`、`KeepStatus` を提供します。CSSフレームワークに依存せず、render props、`asChild`、`className`、多言語ラベルAPIに対応します。
- `KeepButton` に `savedAriaLabel`、`unsavedAriaLabel`、状態を受け取る `getAriaLabel` を追加しました。
- `revalidateKeepItems` / `reconcileKeepItems` / `isKeepItemMetadataStale` と、React向けの `refreshItemMetadata` / `revalidateItems` を追加しました。
- Next.js Pages RouterのSSR/hydration、Jest・jsdom、認証付きAPI、オフライン復帰同期の公式サンプルを `examples/next-pages-router` に追加しました。
- 公開APIの移行手順を [MIGRATION.md](./MIGRATION.md) に整理しました。

### English

- Added the independently publishable `@keepkit/ui` package with `KeepList`, `KeepItemCard`, `KeepTagFilter`, `KeepNoteEditor`, `KeepEmptyState`, and `KeepStatus`. It has no CSS framework dependency and supports render props, `asChild`, `className`, and localized labels.
- Added `savedAriaLabel`, `unsavedAriaLabel`, and state-aware `getAriaLabel` to `KeepButton`.
- Added `revalidateKeepItems` / `reconcileKeepItems` / `isKeepItemMetadataStale` and React APIs for `refreshItemMetadata` / `revalidateItems`.
- Added an official Next.js Pages Router example covering SSR/hydration, Jest/jsdom, authenticated APIs, and offline-resume synchronization in `examples/next-pages-router`.
- Added the public API upgrade checklist in [MIGRATION.md](./MIGRATION.md).

## [0.2.0] - 2026-08-31

### 日本語

#### 破壊的変更

- `@keepkit/core` のルートexportを廃止しました。フレームワーク中立のAPIは `@keepkit/core/core`、React APIは `@keepkit/core/react`、ストレージは `@keepkit/core/storage`、スキーマ処理は `@keepkit/core/schema` からimportしてください。
- `queryKeepItems` と `getTagCounts` をReact hookから分離し、フレームワーク中立の `@keepkit/core/core` に移動しました。

### English

#### Breaking changes

- Removed the `@keepkit/core` root export. Import framework-neutral APIs from `@keepkit/core/core`, React APIs from `@keepkit/core/react`, storage adapters from `@keepkit/core/storage`, and schema helpers from `@keepkit/core/schema`.
- Moved `queryKeepItems` and `getTagCounts` out of the React hook module and into the framework-neutral `@keepkit/core/core` entry point.

## [0.1.0] - 2026-08-31

### 日本語

KeepKit の初回公開リリースです。

#### 追加・変更

- お気に入り向けの命名を保存・コレクション向けの命名へ整理し、`KeepProvider`、`KeepButton`、`useKeepItem`、`useKeepList` を追加しました。
- `KeepItem<TMeta>` で、アイテムID、保存・更新時刻、任意の `targetType` と `note`、型付け可能な `meta` を扱えるようにしました。
- `StorageAdapter<TMeta>` を非同期APIとして整理し、`getAll`、`set`、`remove`、`clear` を共通インターフェースにしました。
- ブラウザの `localStorage` を使う `LocalStorageAdapter` を追加し、SSR環境やストレージにアクセスできない環境でもimportできるようにしました。
- `mergeKeepItems` とアダプターの `merge` により、ローカルアイテムとリモートアイテムを更新時刻で統合できるようにしました。
- 保存・削除・エラーのイベントハンドラーと、複数タブでのストレージ変更の再読み込みに対応しました。
- `StorageAdapter.subscribe` によるマルチタブ同期、失敗時のロールバックを伴う楽観的更新、`createKeepKit<TMeta>()` による型付きAPIセットを追加しました。
- `KeepItem.tags` と `useKeepList` のタグ絞り込み・ソート、`KeepButton` の render props / `asChild`、ノート更新イベントを追加しました。
- Providerの保存・削除・再読み込みを直列化し、`isHydrated` / `isMutating`、タグ更新・一括操作を追加しました。
- `KeepStorageQuotaError` などのストレージエラー型、`createStorageAdapter`、失敗件数を返せるversion付きJSONバックアップAPIを追加しました。
- `useSyncExternalStore` ベースの内部ストア、検索・ページネーション用クエリ、タグ一括付与/除去を追加しました。
- `IndexedDBAdapter` と `@keepkit/core/storage` サブパス、プラグインの保存前後フック、`schemaVersion` / `migrateMeta` を追加しました。
- `@keepkit/core/core`、`@keepkit/core/react`、`@keepkit/core/schema` のサブパスを追加し、React非依存コードとReact bindingを分離して利用できるようにしました。`KeepProvider initialItems` による初期スナップショット注入にも対応しました。

#### 破壊的変更

- 旧 `FavoriteButton`、`FavoriteProvider`、`useFavorites`、`FavoriteStorage` などのAPIは新しい `Keep*` APIに置き換わりました。既存の利用箇所は移行が必要です。

### English

This is the first public release of KeepKit.

#### Added and changed

- Reworked the favorites-oriented naming around saved collections and added `KeepProvider`, `KeepButton`, `useKeepItem`, and `useKeepList`.
- Added `KeepItem<TMeta>` with an item ID, save and update timestamps, optional `targetType` and `note`, and typed `meta` data.
- Defined `StorageAdapter<TMeta>` as an async persistence API with `getAll`, `set`, `remove`, and `clear`.
- Added `LocalStorageAdapter` for browser `localStorage`, with safe imports for SSR and environments where storage is unavailable.
- Added `mergeKeepItems` and adapter-level `merge` support for reconciling local and remote items by update time.
- Added save, remove, and error event handlers, plus refreshes triggered by storage changes in other tabs.
- Added adapter-level multi-tab subscriptions, optimistic updates with rollback on failure, and `createKeepKit<TMeta>()` for app-wide typed components and hooks.
- Added item tags with list filtering/sorting, render props / `asChild` support for `KeepButton`, and note-update events.
- Serialized provider mutations and refreshes, exposed `isHydrated` / `isMutating`, and added bulk tag/removal actions.
- Added typed storage errors, `createStorageAdapter`, and versioned JSON backup utilities with failure counts.
- Added a `useSyncExternalStore`-based internal store, query-style search/pagination, and bulk tag add/remove operations.
- Added `IndexedDBAdapter` through the `@keepkit/core/storage` subpath, plugin before/after hooks, and `schemaVersion` / `migrateMeta` support.
- Added `@keepkit/core/core`, `@keepkit/core/react`, and `@keepkit/core/schema` subpaths so framework-neutral code can avoid the React binding, plus `KeepProvider initialItems` for injected initial snapshots.

#### Breaking changes

- The former `FavoriteButton`, `FavoriteProvider`, `useFavorites`, and `FavoriteStorage` APIs have been replaced by the new `Keep*` API. Existing consumers need to migrate.
