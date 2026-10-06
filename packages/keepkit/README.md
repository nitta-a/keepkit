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

整理状態は`organization: { collection, tags, note }`の`assigned` / `unassigned`で絞り込めます。`createInboxQuery()`は未分類アイテム向けの既定queryを返します。`useKeepList()`は一括archive、pin、collection移動を提供します。Saved Viewは`KeepSavedViewStorage` / `LocalStorageKeepSavedViewStorage`でアイテムと分けて保存できます。

再発見には`useKeepItem(item).recordOpen()`で`lastOpenedAt`を記録し、`activity`の`opened`、`lastOpenedBefore`、`lastOpenedAfter`、`inactiveForMs`で絞り込めます。`inactiveForMs`は開封済みなら`lastOpenedAt`、未開封なら`savedAt`を基準に判定します。開封記録だけでは`updatedAt`を変更せず、同期・mergeでは新しいActivityを保持します。`createRediscoveryQuery()`は`never-opened`、`forgotten`、`recently-opened`のCore向けプリセットを提供し、`useKeepRediscovery()`はReact向けの一覧hookです。

未保存ガイドも含む閲覧履歴には`LocalStorageKeepHistoryStorage`を使います。`record(itemId)`は保存一覧へアイテムを追加せず、保存解除でも履歴を消しません。`getAll()`、`remove()`、`clear()`、`setLimit()`で一覧・個別削除・全消去・保持件数を管理できます。自己申告の鑑賞は`LocalStorageKeepViewingRecordStorage.add()`で開封と別の複数レコードとして記録し、`set()`で日時や個人メモを更新し、`remove()` / `removeForItem()` / `clear()`で削除できます。

保存順を巡回ルートとして管理する場合は、`reorderKeepItems` / `moveKeepItem`、Reactでは`useKeepNavigator`と`useKeepList().reorder()` / `.move()`を利用できます。`getKeepNavigationState`は現在・前・次のアイテムと進行度を返します。

同じ保存アイテムを複数コースに登録する場合は、`StorageAdapter`の`setCollectionMembership()`と`addKeepItemToCollection()`、`getKeepCollectionItems()`、`reorderKeepCollectionItems()`、`removeKeepItemFromCollection()`を使います。コースごとに順序を保持し、所属を外しても保存アイテムや共有メモは削除しません。従来の`KeepItem.collectionId`は単一分類用途として引き続き利用できます。

`exportItems()`は空の定義を含むコレクションと複数コース所属をv2バックアップへ含め、`importItems()`は従来のアイテムのみのv1バックアップも読み込みます。mergeでは同じIDのコレクション名と同じコース・ガイドの順序をバックアップ側で更新し、同名でも異なるIDのコレクションは別の定義として保ちます。replaceでは既存のアイテム、定義、所属を置き換えます。復元先の独自`StorageAdapter`はコレクションと所属の各メソッドを実装する必要があります。

`RemoteSyncDriver`に`pushCollection()`と`pullCollections()`を実装すると、コレクションの作成・改名・削除を永続キュー経由で同期できます。操作は`userId` / `tenantId`のscopeを持ち、フルスナップショットのpullで見つからない定義は削除として扱い、ローカル所属も削除します。未送信のローカル操作はpullで上書きせず、複数端末で同じ定義を同時変更した場合はリモートtransportが受信順で適用する「最後に受け付けた操作を採用」方針です。認証付き構成では`AuthenticatedSyncTransport`にも同じ2つの関数を指定できます。

コースの再開項目やガイドごとの音声・読書位置は`LocalStorageKeepProgressStorage`で保存します。`saveCourse()` / `getCourse()`、`saveItem()` / `getItem()`、`resetCourse()` / `resetItem()`を利用できます。音声位置はミリ秒、読書位置はアプリ定義の数値として扱います。記録に言語または`contentVersion`がある場合、`getItem()`に一致する値を指定しないと位置を返しません。保存APIは再生を開始しないため、音声の再開はViewer側で利用者の操作から行ってください。

`@keepkit/core/core`はフレームワーク中立、`@keepkit/core/react`はReact、`@keepkit/core/storage`はlocalStorage、IndexedDB、fallback、同期adapter、`@keepkit/core/schema`はschema処理を公開します。パッケージルートにはexportがありません。

`KeepProvider`には描画エラーを局所化する`fallback`、`onBoundaryError`、`boundaryResetKey`を指定できます。より細かい境界が必要な場合は`KeepErrorBoundary`を`@keepkit/core/react`から利用できます。

保存対象の公開状態は`KeepItem.status`（`expired`、`removed`、`private`など）と`statusReason`で保持できます。`KeepProvider`の`validateItem` / `resolveItem`を指定すると、引数なしの`revalidateItems()`で検証できます。`revalidateItems`に`removeStatuses`を渡すと検出したアイテムを保存一覧から削除します。`SyncStorageAdapter`は`userId`、`tenantId`、`maxRetries`、`retryDelayMs`、`retryBackoff`に対応し、`retrySync()`で失敗後の同期を再開できます。

v0.28.5では、閲覧履歴・鑑賞記録、複数コースへの所属、コレクションを含むバックアップ、コレクション定義同期、進行位置の保存を追加しました。空のコレクション、Inbox、Saved View、利用履歴、Rediscovery query、URL状態codec、認証付き同期も利用できます。

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

Filter organization with `organization: { collection, tags, note }`, each set to `assigned` or `unassigned`. `createInboxQuery()` returns the default unassigned query. `useKeepList()` includes batch archive, pin, and collection mutations. Saved Views use `KeepSavedViewStorage` and `LocalStorageKeepSavedViewStorage`, separate from item storage.

For rediscovery, call `useKeepItem(item).recordOpen()` to persist `lastOpenedAt`, then filter with `activity.opened`, `lastOpenedBefore`, `lastOpenedAfter`, or `inactiveForMs`. `inactiveForMs` uses `lastOpenedAt` for opened items and `savedAt` for never-opened items. Recording an open does not change `updatedAt`, and sync/merge preserves newer activity independently. `createRediscoveryQuery()` provides framework-neutral `never-opened`, `forgotten`, and `recently-opened` presets, while `useKeepRediscovery()` provides the React list hook.

Use `LocalStorageKeepHistoryStorage` when recently opened guides should include unsaved items. `record(itemId)` never adds an item to the saved list, and removing a saved item does not clear its history. Use `getAll()`, `remove()`, `clear()`, and `setLimit()` to list, delete one entry, clear history, and configure retention. Self-reported viewing events use `LocalStorageKeepViewingRecordStorage.add()` and remain distinct from opens; `set()` updates a timestamp or personal note, and `remove()`, `removeForItem()`, and `clear()` delete records.

Use `reorderKeepItems` / `moveKeepItem` for framework-neutral route ordering, or `useKeepNavigator` with `useKeepList().reorder()` / `.move()` in React. `getKeepNavigationState` returns the current, previous, next, and progress state.

To place one saved guide in several courses, use `StorageAdapter.setCollectionMembership()` with `addKeepItemToCollection()`, `getKeepCollectionItems()`, `reorderKeepCollectionItems()`, and `removeKeepItemFromCollection()`. Each course keeps its own order; removing a membership leaves the shared saved item and note intact. The existing `KeepItem.collectionId` remains available for single-category organization.

`exportItems()` writes backup v2 with collection definitions, including empty ones, and course memberships. `importItems()` also reads existing item-only v1 backups. In merge mode, a backup definition replaces the name for the same collection ID, and a backup membership replaces the order for the same course/item pair; a different ID with the same name remains a separate collection. Replace mode replaces items, definitions, and memberships. Custom storage adapters must implement the collection and membership methods to restore backups that contain this data.

Implement `RemoteSyncDriver.pushCollection()` and `pullCollections()` to sync collection creation, rename, and deletion through the durable queue. Operations carry the configured `userId` / `tenantId` scope. A full pull snapshot is authoritative: a missing definition is treated as deleted and its local memberships are removed. Pending local operations take precedence during pull. For simultaneous changes, the remote transport applies operations in arrival order, so the last accepted operation wins. `AuthenticatedSyncTransport` exposes the same two hooks.

Use `LocalStorageKeepProgressStorage` for a course's current guide and per-guide audio or reading positions. Call `saveCourse()` / `getCourse()`, `saveItem()` / `getItem()`, and `resetCourse()` / `resetItem()`. Audio positions use milliseconds; reading positions are application-defined numbers. When a record has a language or `contentVersion`, pass matching values to `getItem()`; the offset is withheld if the expected value is missing or differs. The storage API never starts playback; the Viewer should resume audio only after a user action.

Use `@keepkit/core/core` for framework-neutral code, `@keepkit/core/react` for React bindings, `@keepkit/core/storage` for browser/fallback/sync adapters, and `@keepkit/core/schema` for schema validation. The package root has no export.

`KeepProvider` accepts `fallback`, `onBoundaryError`, and `boundaryResetKey` to isolate unexpected render errors. Use the standalone `KeepErrorBoundary` from `@keepkit/core/react` when a smaller boundary is appropriate.

`KeepItem.status` and `statusReason` preserve source availability such as `expired`, `removed`, and `private`. Configure `KeepProvider` with `validateItem` / `resolveItem` to make `revalidateItems()` use those hooks by default. Pass `removeStatuses` to remove detected items from storage. `SyncStorageAdapter` supports scoped queues with `userId` and `tenantId`, configurable retries/backoff, and explicit `retrySync()` recovery.

v0.28.5 adds independent viewing history and records, multi-course memberships, collection-aware backups, scoped collection sync, and resumable reading or audio progress. Empty collections, Inbox, Saved Views, activity tracking, Rediscovery queries, URL state codecs, user/tenant isolation, and authenticated sync are also available.

`createAuthenticatedSyncKit` provides a per-request `getAuthToken`, injectable push/pull transport, 401/403 reauthentication callbacks, persistent offline queues, and `setScope` for safe user or tenant changes. See [`examples/authenticated-sync`](../../examples/authenticated-sync/README.md) for a recipe.

The v0.5 factory returns `Provider`, `Button`, `useContext`, `useItem`, `useList`, and `useShortcut`. Existing v0.4 applications should follow the migration guide in the repository root.

## Archive, pin, and collections

`KeepItem` and `KeepItemInput` accept optional `archived`, `pinned`, and `collectionId` fields. `useKeepList` defaults to unarchived items; pass `archived: true` for the archive, `archiveScope: "all"` for both scopes, `collectionId` for an exact collection filter, and `pinnedFirst: true` to stably promote pinned items without changing the existing order inside either group. `useKeepCollections({ targetType, orderBy })` derives de-duplicated collection IDs, names, and counts from the complete saved-item snapshot. `useKeepItem` and the provider expose `toggleArchive`, `archiveItem`, `unarchiveItem`, `togglePin`, and `moveToCollection` operations. Each operation updates `updatedAt`, removes an empty collection ID, and uses the normal persistence, rollback, plugin, and `onChange` pipeline.

The standard browser adapters persist explicit collection definitions and course memberships separately from items. A custom `StorageAdapter` can opt in by implementing `getCollections`, `setCollection`, `removeCollection`, `getCollectionMemberships`, `setCollectionMembership`, and `removeCollectionMembership`. `clear()` still clears saved items only. JSON backup v2 includes definitions and memberships, and remote sync can include definitions through optional collection transport hooks.

## アーカイブ・ピン留め・コレクション

`KeepItem` と `KeepItemInput` は `archived`、`pinned`、`collectionId` を任意で受け取れます。`useKeepList` は未アーカイブを既定とし、`archived: true` でアーカイブを、`archiveScope: "all"` で両方を、`collectionId` で完全一致のコレクションを取得できます。`useKeepCollections({ targetType, orderBy })` は全保存アイテムからコレクションID・名前・件数を重複なく導出します。`pinnedFirst: true` は既存の順序を保ったままピン留め項目を先頭へ安定移動します。`useKeepItem` と Provider には `toggleArchive`、`archiveItem`、`unarchiveItem`、`togglePin`、`moveToCollection` を追加しました。各操作は `updatedAt` を更新し、空のコレクション ID はプロパティを削除して、既存の永続化・rollback・plugin・`onChange` 経路を利用します。

標準ブラウザーストレージは、空のコレクション、変更した名前、コース別の所属と順序をアイテムとは別に永続化します。独自の`StorageAdapter`では`getCollections`、`setCollection`、`removeCollection`と`getCollectionMemberships`、`setCollectionMembership`、`removeCollectionMembership`を実装すると保存できます。`clear()`は保存アイテムのみを消去し、JSONバックアップv2はコレクションと所属も含みます。リモート同期は任意のコレクション用transportを追加すると利用できます。
