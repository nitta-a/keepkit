# Release notes

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
