# Release notes

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
