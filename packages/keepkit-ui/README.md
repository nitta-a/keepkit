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
- `KeepItemCard`: タイトル、画像、保存ボタン、削除ボタン。`getImageUrl` とrender propsで表示を差し替えられます。
- `KeepTagFilter`: タグと件数を表示するキーボード操作可能なフィルター。`value` / `onValueChange` のcontrolled APIに対応します。
- `KeepNoteEditor`: ノートの編集・保存フォーム。`render` で完全なカスタムUIにできます。
- `KeepEmptyState` / `KeepStatus`: 空、読み込み中、保存中、同期中、エラー状態の表示。

すべてのルート要素で `className` を利用でき、対応コンポーネントでは `asChild` で既存要素をルートとして利用できます。コンポーネントの標準HTMLは意味的な要素、ネイティブボタン、フォーム、`aria-live` を利用します。

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

The package re-exports `KeepProvider` and the core React hooks for convenient composition. The state and storage implementation remains in `@keepkit/core`; this package only adds the UI layer.
