# @keepkit/ui

[日本語](#日本語) | [English](#english)

## 日本語

`@keepkit/core` の保存状態を、アプリ固有のCSSやUIライブラリに接続するための、低依存・スタイルレスなReact UIパーツです。Tailwind CSS、shadcn/ui、その他のデザインシステムには依存しません。

```bash
pnpm add @keepkit/core @keepkit/ui
```

```tsx
import { KeepList, KeepProvider, KeepTagFilter } from "@keepkit/ui";

function SavedItems() {
  return (
    <KeepProvider>
      <KeepTagFilter value={selectedTag} onValueChange={setSelectedTag} />
      <KeepList options={{ tag: selectedTag }} />
    </KeepProvider>
  );
}
```

提供するコンポーネントは次のとおりです。

- `KeepButton`: 保存済み状態、`aria-pressed`、ローディング・エラー状態、`asChild`、render props。`labels` または既存の `savedAriaLabel` / `unsavedAriaLabel` で翻訳できます。
- `KeepList`: 保存一覧、読み込み中・空・エラー状態、標準カード、削除操作。`renderItem` で行単位を置き換えられます。
- `KeepItemCard`: タイトル、画像、保存ボタン、削除ボタン。`getImageProps`、`imageComponent`、`renderImage` とrender propsで表示を差し替えられます。
- `KeepTagFilter`: タグと件数を表示するキーボード操作可能なフィルター。`value` / `onValueChange` のcontrolled APIに対応します。
- `KeepNoteEditor`: ノートの編集・保存フォーム。`render` で完全なカスタムUIにできます。
- `KeepSearchInput` / `KeepSortSelect` / `KeepPagination`: `useKeepList` に渡す検索、ソート、offsetページング用のプリミティブ。
- `KeepTagEditor` / `KeepBulkActions`: タグ編集、複数選択、一括削除、一括タグ更新。
- `KeepUiProvider`: `labels`、`locale`、`labelResolver` をUI全体に適用するラベルコンテキスト。
- `KeepAnnouncements`: 保存、削除、ノート保存の成功を `aria-live` で通知します。
- `KeepEmptyState` / `KeepStatus`: 空、読み込み中、保存中、同期中、エラー状態の表示。

すべてのルート要素で `className` を利用でき、対応コンポーネントでは `asChild` で既存要素をルートとして利用できます。コンポーネントの標準HTMLは意味的な要素、ネイティブボタン、フォーム、`aria-live` を利用します。

### カスタマイズ契約

- `render` / render props はstateを受け取り、標準内部マークアップを置き換えます。`KeepList.renderItem` は各アイテムだけを置き換えます。
- `KeepItemCard` の画像は `getImageProps` で `src`、`alt`、`width`、`height`、`srcSet` を作り、`imageComponent` または `renderImage` で描画します。
- `asChild` は単一のReact要素を必要とし、ルート要素だけを置き換えます。内部のアクセシビリティ属性とイベントは保持してください。
- 標準構造は `KeepList` が `div > ul > li`、`KeepTagFilter` が `fieldset`、`KeepNoteEditor` が `form`、一括操作が `section > fieldset` です。
- CSSはルートと渡された標準要素の `className` に適用します。コンポーネントはstyleを持ちません。
- `onClick`、`onSubmit`、`onChange` は利用者のハンドラーを先に実行し、`preventDefault()` された場合は既定操作を実行しません。

ラベルと画像の拡張ポイントは `KeepUiProvider` と `getImageProps`/`imageComponent`/`renderImage` に集約しています。既存の個別label propsも明示的な上書き用途として利用できます。

## English

`@keepkit/ui` provides low-dependency, style-free React UI primitives that connect `@keepkit/core` state to an app's own CSS or design system. It has no direct dependency on Tailwind CSS, shadcn/ui, or another component library.

```bash
pnpm add @keepkit/core @keepkit/ui
```

```tsx
import { KeepList, KeepProvider, KeepTagFilter } from "@keepkit/ui";

function SavedItems() {
  return (
    <KeepProvider>
      <KeepTagFilter value={selectedTag} onValueChange={setSelectedTag} />
      <KeepList options={{ tag: selectedTag }} />
    </KeepProvider>
  );
}
```

Components include `KeepButton`, `KeepList`, `KeepItemCard`, `KeepTagFilter`, `KeepNoteEditor`, `KeepEmptyState`, and `KeepStatus`. They support `className`, render props, localized labels, and `asChild` where a root element can be replaced. The defaults use semantic HTML, native keyboard behavior, `aria-pressed`, and live-region status announcements. `KeepList` includes loading, empty, error, and removal states, while `KeepTagFilter` exposes controlled `value` / `onValueChange` state.

The package also exports `KeepSearchInput`, `KeepSortSelect`, `KeepPagination`, `KeepTagEditor`, `KeepBulkActions`, `KeepUiProvider`, and `KeepAnnouncements`. Configure labels once with `KeepUiProvider`, replace card images with `getImageProps` plus `imageComponent` or `renderImage`, and use `KeepAnnouncements` for success messages in a polite live region.

Customization is explicit: render props replace component markup, `KeepList.renderItem` replaces one item, `asChild` replaces only a single root element, and standard HTML structure is stable (`div > ul > li`, `fieldset`, `form`, and `section > fieldset`). User handlers run before default behavior and `preventDefault()` cancels it. The old URL-only image entry point is replaced by the structured image API; app-wide labels belong in `KeepUiProvider`.

The package re-exports `KeepProvider` and the core React hooks for convenient composition. The state and storage implementation remains in `@keepkit/core`; this package only adds the UI layer. Existing component label props remain available as explicit overrides, while app-wide defaults belong in `KeepUiProvider`.
