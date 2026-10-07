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

v0.28.7では、スコープをまたぐ結合と並行所属変更を補強し、履歴・鑑賞記録・進行位置の同一キー更新を保護します。閲覧履歴の文脈、鑑賞記録の作成／更新日時、見出しIDによる読書位置も利用できます。

`createAuthenticatedSyncKit`は、リクエストごとの`getAuthToken`、注入可能なpush/pull transport、401/403時の再認証callback、永続オフラインキュー、`setScope`による安全なユーザー／テナント切替を提供します。スコープを切り替えたり対象スコープのキューを削除・全消去しても、他スコープの未送信操作は保持されます。詳細は[`examples/authenticated-sync`](../../examples/authenticated-sync/README.md)を参照してください。

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

v0.28.7 strengthens scope-aware merging, concurrent membership changes, and same-key updates to history, viewing records, and progress. It also includes history context, viewing-record timestamps, and heading-ID reading positions.

`createAuthenticatedSyncKit` provides a per-request `getAuthToken`, injectable push/pull transport, 401/403 reauthentication callbacks, persistent offline queues, and `setScope` for safe user or tenant changes. Scope changes and scoped queue removal or clearing preserve pending operations for other scopes. See [`examples/authenticated-sync`](../../examples/authenticated-sync/README.md) for a recipe.

The v0.5 factory returns `Provider`, `Button`, `useContext`, `useItem`, `useList`, and `useShortcut`. Existing v0.4 applications should follow the migration guide in the repository root.

## Archive, pin, and collections

`KeepItem` and `KeepItemInput` accept optional `archived`, `pinned`, and `collectionId` fields. `useKeepList` defaults to unarchived items; pass `archived: true` for the archive, `archiveScope: "all"` for both scopes, `collectionId` for an exact collection filter, and `pinnedFirst: true` to stably promote pinned items without changing the existing order inside either group. `useKeepCollections({ targetType, orderBy })` derives de-duplicated collection IDs, names, and counts from the complete saved-item snapshot. `useKeepItem` and the provider expose `toggleArchive`, `archiveItem`, `unarchiveItem`, `togglePin`, and `moveToCollection` operations. Each operation updates `updatedAt`, removes an empty collection ID, and uses the normal persistence, rollback, plugin, and `onChange` pipeline.

The standard browser adapters persist explicit collection definitions and course memberships separately from items. A custom `StorageAdapter` can opt in by implementing `getCollections`, `setCollection`, `removeCollection`, `getCollectionMemberships`, `setCollectionMembership`, and `removeCollectionMembership`. `clear()` still clears saved items only. JSON backup v2 includes definitions and memberships, and remote sync can include definitions through optional collection transport hooks.

## アーカイブ・ピン留め・コレクション

`KeepItem` と `KeepItemInput` は `archived`、`pinned`、`collectionId` を任意で受け取れます。`useKeepList` は未アーカイブを既定とし、`archived: true` でアーカイブを、`archiveScope: "all"` で両方を、`collectionId` で完全一致のコレクションを取得できます。`useKeepCollections({ targetType, orderBy })` は全保存アイテムからコレクションID・名前・件数を重複なく導出します。`pinnedFirst: true` は既存の順序を保ったままピン留め項目を先頭へ安定移動します。`useKeepItem` と Provider には `toggleArchive`、`archiveItem`、`unarchiveItem`、`togglePin`、`moveToCollection` を追加しました。各操作は `updatedAt` を更新し、空のコレクション ID はプロパティを削除して、既存の永続化・rollback・plugin・`onChange` 経路を利用します。

標準ブラウザーストレージは、空のコレクション、変更した名前、コース別の所属と順序をアイテムとは別に永続化します。独自の`StorageAdapter`では`getCollections`、`setCollection`、`removeCollection`と`getCollectionMemberships`、`setCollectionMembership`、`removeCollectionMembership`を実装すると保存できます。`clear()`は保存アイテムのみを消去し、JSONバックアップv2はコレクションと所属も含みます。リモート同期は任意のコレクション用transportを追加すると利用できます。

### v0.28.7の保存・復元補完

同じlocalStorageキーへの履歴・鑑賞記録・進行位置の書き込みは、Web Locks APIが使えるブラウザーではタブ・インスタンス間で直列化されます。同一realm内の複数インスタンスもキーごとに直列化します。`saveItem()`は同じガイドの既存進行情報を読み、指定フィールドだけ更新して他の位置情報を保ちます。鑑賞記録・進行レコードの`set()`で古い`updatedAt`の値が届いた場合は、新しい保存値を残します。Web Locks APIがないブラウザーでは、競合上書きを避けるため書き込み前に`KeepActivityStorageError`または`KeepProgressStorageError`で失敗します。ブラウザー保存先がない場合も同じエラー型で失敗します。SSRでは初期化できますが、保存操作はブラウザー側で呼び出してください。

既存ストレージを開いた後、コース別所属を読む機能を使う前に`migrateLegacyCollectionMemberships(storage)`を実行して旧単一所属データを移行します。既存所属を上書きせず、所属保存後に旧`collectionId`を消去するため、利用者が所属を外した後の再実行で復活しません。途中でadapterの書き込みが失敗した場合はエラーを返し、再実行しても所属は重複しません。対象scopeに定義名のないIDは戻り値の`missingCollectionIds`で確認できます。項目削除時はlocalStorage、IndexedDB、スコープadapterが所属も消します。同じadapterへの`addKeepItemToCollection()`・`removeKeepItemFromCollection()`・`reorderKeepCollectionItems()`は、所属の読み取りから順序の再採番・書き込みまで直列化されます。

バックアップには保存アイテム・コレクション定義・所属のみが含まれ、閲覧履歴・鑑賞記録・進行位置は含まれません。`importItems()`の置換モードは空のバックアップでも対象範囲を空にします。v2バックアップと戻り値の`scopes`は含まれる利用者・テナント範囲を示し、`includedData`はデータ種別を示します。`imported`、`failed`、`total`は保存アイテムの件数で、`applied`は項目・定義・所属の適用数を個別に示します。スコープ付きadapterは別scopeを含むbackupを変更前に拒否します。v1の`collectionId`は名前を復元できないため`missingCollectionIds`で通知します。途中失敗は`KeepBackupImportError.failedStage`と`applied`で確認します。置換にrollbackはありません。merge時の同ID名は既定でバックアップ側を採用し、`collectionNameConflict: "existing"`を指定すると既存名を維持します。共有adapterでは項目・コレクションのIDと`tenantId`・`userId`で識別するため、別scopeの同IDデータは別に保たれます。scope未指定と`{}`は同じ扱いで、空文字列の`userId`または`tenantId`は明示値として別scopeです。複数scopeのバックアップは共有adapterへ復元でき、スコープ付きadapterは別scopeを変更前に拒否します。

履歴の文脈には`record(itemId, viewedAt, { language: "ja" })`で言語などを保存でき、`getAll()`で履歴と一緒に取得できます。鑑賞記録は`viewedAt`と`createdAt` / `updatedAt`を分けます。日時がない旧記録は最初に更新した時刻を作成時刻として補います。読書位置は数値offsetと安定した見出しID文字列を受け付けます。`getItem()`には必要な音声ID・言語・コンテンツ版を渡して互換位置だけを取得します。

同期adapterに`RemoteSyncDriver.pushMembership()` / `pullMemberships()`を指定すると、所属の追加・解除・コース別順序を永続キューで同期できます。所属解除はアイテム・コレクション削除より先に送信し、pull時は存在しない親への所属を適用しません。membership transportを実装しないdriverでは所属はローカル保存のみです。コレクション定義には`revision`と`updatedAt`を保存でき、操作は`baseRevision`を送ります。driverは`KeepCollectionSyncResult`で競合と選択結果を返し、アプリは`resolveCollectionSyncConflict()`からローカルまたはリモートを選べます。削除tombstoneの保持と競合方針はdriverまたはサーバーで実装します。これらは低レベルAPIであり標準画面へ自動接続されません。

```ts
import {
  LocalStorageKeepHistoryStorage,
  LocalStorageKeepProgressStorage,
  LocalStorageKeepViewingRecordStorage,
  exportItems,
  importItems,
  migrateLegacyCollectionMemberships,
} from "@keepkit/core/core";
import { createBrowserStorageAdapter } from "@keepkit/core/storage";

const storage = createBrowserStorageAdapter({ key: "my-app:items", scope: { userId: "user-1" } });
const history = new LocalStorageKeepHistoryStorage({ key: "my-app:user-1:history" });
await history.record("guide-1", Date.now(), { language: "ja" });
await migrateLegacyCollectionMemberships(storage);
const backup = await exportItems(storage);
await importItems(storage, backup, { mode: "replace" });

const progress = new LocalStorageKeepProgressStorage({ key: "my-app:user-1:progress" });
await progress.saveItem("guide-1", {
  audioId: "guide-1-ja",
  audioPositionMs: 1250,
  readingPosition: "heading-intro",
  language: "ja",
  contentVersion: "v2",
});
const resume = await progress.getItem("guide-1", {
  audioId: "guide-1-ja",
  language: "ja",
  contentVersion: "v2",
});
const viewings = new LocalStorageKeepViewingRecordStorage({ key: "my-app:user-1:viewings" });
const record = { id: "viewing-1", itemId: "guide-1", viewedAt: Date.now(), note: "Finished" };
await viewings.set(record); // Reuse this stable ID when retrying the write.
```

### Persistence and restore improvements in v0.28.7

Writes to history, viewing records, and progress using the same localStorage key are serialized across tabs and instances when the browser provides the Web Locks API. Separate instances in one realm are also serialized by key. `saveItem()` reads existing progress for the same guide and updates only the supplied fields, preserving other positions. For viewing records and progress, `set()` does not replace a newer record with a value whose `updatedAt` is older. In a browser without Web Locks, writes fail before mutation with `KeepActivityStorageError` or `KeepProgressStorageError` to avoid silently overwriting concurrent data. The same error types report unavailable browser storage. Construction is SSR-safe; call persistent writes in the browser.

After opening existing storage and before reading course-specific memberships, run `migrateLegacyCollectionMemberships(storage)`. Existing memberships are never overwritten, and the legacy `collectionId` is cleared after migration so a later run will not recreate a membership the user removed. Adapter write errors are returned; rerunning after a partial failure is safe and does not duplicate memberships. IDs with no same-scope definition name are listed in `missingCollectionIds`. Removing a saved item also removes its memberships in localStorage, IndexedDB, and scoped adapters. `addKeepItemToCollection()`, `removeKeepItemFromCollection()`, and `reorderKeepCollectionItems()` serialize their read, reindex, and write steps when called concurrently with the same adapter instance.

Backups include saved items, collection definitions, and memberships. They exclude history, viewing records, and progress. Replace imports clear the target scope even for an empty backup. Version 2 backups and results expose represented `scopes`; scoped adapters reject data from a different scope before mutation. `imported`, `failed`, and `total` count saved items; `applied` reports items, definitions, and memberships separately. `includedData` identifies data types, and v1 collection IDs whose names cannot be restored are returned in `missingCollectionIds`. `KeepBackupImportError.failedStage` and `applied` describe partial application. Replace has no rollback. Merge keeps the backup name for a same-ID collision by default; choose `collectionNameConflict: "existing"` to retain the stored name. Shared adapters identify items and collections by ID plus `tenantId` and `userId`, keeping same-ID records in different scopes independent. An omitted scope and `{}` are equivalent; an empty-string `userId` or `tenantId` is an explicit, distinct scope. Shared adapters accept multi-scope backups, while scoped adapters reject another scope before mutation.

History context can be recorded with `record(itemId, viewedAt, { language: "ja" })` and retrieved with each entry from `getAll()`. Viewing records distinguish the self-reported `viewedAt` from `createdAt` / `updatedAt`. A legacy record without these timestamps receives its first-update time as its creation timestamp. Reading positions accept numeric offsets and stable heading ID strings; pass expected audio ID, language, and content version to `getItem()` to reject incompatible positions.

Implement `RemoteSyncDriver.pushMembership()` / `pullMemberships()` to sync membership changes and course-specific order through the durable queue. Membership removals are sent before item or collection deletions, and pulls skip memberships whose parent is missing. Without membership transport hooks, membership changes remain local. Collection definitions can store `revision` and `updatedAt`, and operations send `baseRevision`. Drivers return `KeepCollectionSyncResult` for conflicts and outcomes; the app can choose local or remote with `resolveCollectionSyncConflict()`. The server or driver owns deletion tombstones and conflict policy. These are low-level APIs and are not automatically connected to the standard UI.

The example above imports the persistence APIs from `@keepkit/core/core` and browser adapters from `@keepkit/core/storage`. Keep history and progress keys scoped by the host app's account or tenant when those records should not cross users. Reuse a viewing-record ID with `set()` when retrying so the event is not duplicated.
