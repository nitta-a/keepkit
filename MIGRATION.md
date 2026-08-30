# KeepKit migration guide

This guide is maintained alongside [`RELEASE_NOTES.md`](./RELEASE_NOTES.md). The revalidation, label, and UI APIs are included in `0.3.0`. KeepKit does not use a root export; each public surface is imported from its explicit subpath.

## 日本語

### 0.2.x から更新する場合

1. `@keepkit/core` からのimportを、`@keepkit/core/core`、`@keepkit/core/react`、`@keepkit/core/storage`、`@keepkit/core/schema` のいずれかへ移します。
2. `KeepItem` のカスタムメタデータ再取得を行う場合は、`useKeepItem(id).refreshMetadata(async (item) => meta)` または `KeepProvider` の `refreshItemMetadata` を使います。`isKeepItemMetadataStale(item, maxAgeMs)` で再取得対象を選べます。成功時に `metaUpdatedAt` と `updatedAt` が更新され、`savedAt` は変わりません。
3. 保存対象の存在確認は `revalidateItems` / `revalidateKeepItems` に切り替えます。`deleted`、`private`、`expired`、`unknown` を返せます。初期状態では検出だけなので、整理する場合だけ `removeStatuses` を指定します。
4. `KeepButton` を翻訳する場合は `savedAriaLabel` と `unsavedAriaLabel` を指定します。複雑な文言は `getAriaLabel` で状態を受け取って生成できます。明示した `aria-label` がある場合はそちらが優先されます。

### 破壊的変更の確認

- `@keepkit/core` のルートimportはサポートされません。
- `queryKeepItems` と `getTagCounts` は `@keepkit/core/core` からimportします。
- `KeepItem` の既存フィールドは維持され、`metaUpdatedAt` は任意フィールドです。

## English

### Upgrading from 0.2.x

1. Move imports from `@keepkit/core` to one of the explicit subpaths: `@keepkit/core/core`, `@keepkit/core/react`, `@keepkit/core/storage`, or `@keepkit/core/schema`.
2. Refresh custom metadata with `useKeepItem(id).refreshMetadata(async (item) => meta)` or `KeepProvider.refreshItemMetadata`. Use `isKeepItemMetadataStale(item, maxAgeMs)` to select stale records. A successful refresh updates `metaUpdatedAt` and `updatedAt` while preserving `savedAt`.
3. Use `revalidateItems` / `revalidateKeepItems` to check whether saved targets still exist. A checker can return `deleted`, `private`, `expired`, or `unknown`. Detection is non-destructive by default; pass `removeStatuses` when cleanup is intended.
4. Localize `KeepButton` with `savedAriaLabel` and `unsavedAriaLabel`, or generate labels with `getAriaLabel`. An explicit `aria-label` still takes precedence.

### Breaking-change checklist

- The `@keepkit/core` root import is not supported.
- Import `queryKeepItems` and `getTagCounts` from `@keepkit/core/core`.
- Existing `KeepItem` fields remain compatible; `metaUpdatedAt` is optional.
