# @keepkit/core

[日本語](#日本語) | [English](#english)

## 日本語

フレームワーク中立の保存・コレクションプリミティブとReactの低レベルbindingを提供します。通常のReactアプリケーションでは、より少ないコードで利用できる`@keepkit/ui`を推奨します。

```tsx
import { KeepButton, KeepProvider, useKeepItem, useKeepList } from "@keepkit/core/react";
import { createBrowserStorageAdapter } from "@keepkit/core/storage";

const storage = createBrowserStorageAdapter({ key: "my-app:items" });
const article = { id: "article-123", targetType: "article", meta: { title: "Example", url: "/article" } };

<KeepProvider storage={storage}>
  <KeepButton item={article} />
</KeepProvider>;

const item = useKeepItem(article);
const list = useKeepList({
  targetType: "article",
  search: { query: "react" },
  sort: { by: "updatedAt", direction: "desc" },
  pagination: { page: 1, pageSize: 20 },
});
```

`KeepItemInput`は`id`、`meta`、`targetType`、`note`、`tags`、`order`を持つ入力です。保存時刻・更新時刻・タグ正規化は内部で処理されます。

`KeepListQuery`は`targetType`、`tags`、`search`、`sort`、`pagination`、`filter`、`savedBetween`で構成されます。`queryKeepItems`はReactなしで同じ条件を適用できます。

保存順を巡回ルートとして管理する場合は、`reorderKeepItems` / `moveKeepItem`、Reactでは`useKeepNavigator`と`useKeepList().reorder()` / `.move()`を利用できます。`getKeepNavigationState`は現在・前・次のアイテムと進行度を返します。

`@keepkit/core/core`はフレームワーク中立、`@keepkit/core/react`はReact、`@keepkit/core/storage`はlocalStorage、IndexedDB、fallback、同期adapter、`@keepkit/core/schema`はschema処理を公開します。パッケージルートにはexportがありません。

`KeepProvider`には描画エラーを局所化する`fallback`、`onBoundaryError`、`boundaryResetKey`を指定できます。より細かい境界が必要な場合は`KeepErrorBoundary`を`@keepkit/core/react`から利用できます。

保存対象の公開状態は`KeepItem.status`（`expired`、`removed`、`private`など）と`statusReason`で保持できます。`KeepProvider`の`validateItem` / `resolveItem`を指定すると、引数なしの`revalidateItems()`で検証できます。`revalidateItems`に`removeStatuses`を渡すと検出したアイテムを保存一覧から削除します。`SyncStorageAdapter`は`userId`、`tenantId`、`maxRetries`、`retryDelayMs`、`retryBackoff`に対応し、`retrySync()`で失敗後の同期を再開できます。

v0.26.3では、`KeepCollection`の構成例を確認できる`apps/collection-demo`を追加しました。coreでは既存の保存順プレイリスト、`useKeepNavigator`、`reorderKeepItems` / `moveKeepItem`、URL状態codec、ユーザー／テナント分離、`createKeepKitPreset`、認証付き同期を引き続き利用できます。

`createAuthenticatedSyncKit`は、リクエストごとの`getAuthToken`、注入可能なpush/pull transport、401/403時の再認証callback、永続オフラインキュー、`setScope`による安全なユーザー／テナント切替を提供します。詳細は[`examples/authenticated-sync`](../../examples/authenticated-sync/README.md)を参照してください。

### 0.4.xからの変更

- `createKeepKit`は`Provider`、`Button`、`useContext`、`useItem`、`useList`、`useShortcut`を返します。
- `useKeepItem(id, payload)`は`useKeepItem(item)`に変わりました。
- `useKeepShortcut({ id, itemPayload })`は`useKeepShortcut({ item })`に変わりました。
- `KeepListOptions`は`KeepListQuery`に変わり、一覧条件は`search`、`sort`、`pagination`へ統一されました。

## English

`@keepkit/core` provides framework-neutral saved-collection primitives and low-level React bindings. For standard React applications, use `@keepkit/ui` for the shortest integration path.

```tsx
import { KeepButton, KeepProvider, useKeepItem, useKeepList } from "@keepkit/core/react";
import { createBrowserStorageAdapter } from "@keepkit/core/storage";

const storage = createBrowserStorageAdapter({ key: "my-app:items" });
const article = { id: "article-123", targetType: "article", meta: { title: "Example", url: "/article" } };

<KeepProvider storage={storage}>
  <KeepButton item={article} />
</KeepProvider>;

const item = useKeepItem(article);
const list = useKeepList({
  targetType: "article",
  search: { query: "react" },
  sort: { by: "updatedAt", direction: "desc" },
  pagination: { page: 1, pageSize: 20 },
});
```

`KeepItemInput` contains `id`, `meta`, `targetType`, `note`, `tags`, and the optional persisted `order`. KeepKit owns persistence timestamps and tag normalization. `KeepListQuery` uses the canonical `targetType`, `tags`, `search`, `sort`, `pagination`, `filter`, and `savedBetween` fields.

Use `reorderKeepItems` / `moveKeepItem` for framework-neutral route ordering, or `useKeepNavigator` with `useKeepList().reorder()` / `.move()` in React. `getKeepNavigationState` returns the current, previous, next, and progress state.

Use `@keepkit/core/core` for framework-neutral code, `@keepkit/core/react` for React bindings, `@keepkit/core/storage` for browser/fallback/sync adapters, and `@keepkit/core/schema` for schema validation. The package root has no export.

`KeepProvider` accepts `fallback`, `onBoundaryError`, and `boundaryResetKey` to isolate unexpected render errors. Use the standalone `KeepErrorBoundary` from `@keepkit/core/react` when a smaller boundary is appropriate.

`KeepItem.status` and `statusReason` preserve source availability such as `expired`, `removed`, and `private`. Configure `KeepProvider` with `validateItem` / `resolveItem` to make `revalidateItems()` use those hooks by default. Pass `removeStatuses` to remove detected items from storage. `SyncStorageAdapter` supports scoped queues with `userId` and `tenantId`, configurable retries/backoff, and explicit `retrySync()` recovery.

v0.26.3 adds `apps/collection-demo` for exploring `KeepCollection` configurations. Core continues to provide persisted playlist ordering with `useKeepNavigator`, `reorderKeepItems`, and `moveKeepItem`, URL state codecs, user/tenant isolation, `createKeepKitPreset({ mode: "local" | "sync" | "backup" })`, and token-aware authenticated sync.

`createAuthenticatedSyncKit` provides a per-request `getAuthToken`, injectable push/pull transport, 401/403 reauthentication callbacks, persistent offline queues, and `setScope` for safe user or tenant changes. See [`examples/authenticated-sync`](../../examples/authenticated-sync/README.md) for a recipe.

The v0.5 factory returns `Provider`, `Button`, `useContext`, `useItem`, `useList`, and `useShortcut`. Existing v0.4 applications should follow the migration guide in the repository root.

## Archive, pin, and collections

`KeepItem` and `KeepItemInput` accept optional `archived`, `pinned`, and `collectionId` fields. `useKeepList` defaults to unarchived items; pass `archived: true` for the archive, `archiveScope: "all"` for both scopes, `collectionId` for an exact collection filter, and `pinnedFirst: true` to stably promote pinned items without changing the existing order inside either group. `useKeepCollections({ targetType, orderBy })` derives de-duplicated collection IDs, names, and counts from the complete saved-item snapshot. `useKeepItem` and the provider expose `toggleArchive`, `archiveItem`, `unarchiveItem`, `togglePin`, and `moveToCollection` operations. Each operation updates `updatedAt`, removes an empty collection ID, and uses the normal persistence, rollback, plugin, and `onChange` pipeline.

## アーカイブ・ピン留め・コレクション

`KeepItem` と `KeepItemInput` は `archived`、`pinned`、`collectionId` を任意で受け取れます。`useKeepList` は未アーカイブを既定とし、`archived: true` でアーカイブを、`archiveScope: "all"` で両方を、`collectionId` で完全一致のコレクションを取得できます。`useKeepCollections({ targetType, orderBy })` は全保存アイテムからコレクションID・名前・件数を重複なく導出します。`pinnedFirst: true` は既存の順序を保ったままピン留め項目を先頭へ安定移動します。`useKeepItem` と Provider には `toggleArchive`、`archiveItem`、`unarchiveItem`、`togglePin`、`moveToCollection` を追加しました。各操作は `updatedAt` を更新し、空のコレクション ID はプロパティを削除して、既存の永続化・rollback・plugin・`onChange` 経路を利用します。
