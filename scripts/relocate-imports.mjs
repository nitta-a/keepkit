import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";

const sourceRoot = resolve("packages");
const pathMap = new Map(
  Object.entries({
    "keepkit/src/backup": "keepkit/src/features/persistence/backup",
    "keepkit/src/migration": "keepkit/src/features/persistence/migration",
    "keepkit/src/schema": "keepkit/src/features/persistence/schema",
    "keepkit/src/scope": "keepkit/src/features/persistence/scope",
    "keepkit/src/navigation": "keepkit/src/features/items/navigation",
    "keepkit/src/presets": "keepkit/src/features/items/presets",
    "keepkit/src/query": "keepkit/src/features/items/query",
    "keepkit/src/revalidation": "keepkit/src/features/items/revalidation",
    "keepkit/src/types": "keepkit/src/features/items/types",
    "keepkit/src/url": "keepkit/src/features/items/url",
    "keepkit/src/integrations": "keepkit/src/features/sync/integrations",
    "keepkit/src/templates/auth-sync": "keepkit/src/features/sync/templates/auth-sync",
    "keepkit/src/store": "keepkit/src/features/store/store",
    "keepkit/src/KeepButton": "keepkit/src/react/components/KeepButton",
    "keepkit/src/KeepErrorBoundary": "keepkit/src/react/components/KeepErrorBoundary",
    "keepkit/src/KeepProvider": "keepkit/src/react/components/KeepProvider",
    "keepkit/src/createKeepKit": "keepkit/src/react/createKeepKit",
    "keepkit/src/hooks/index": "keepkit/src/react/hooks/index",
    "keepkit/src/hooks/useKeepItem": "keepkit/src/react/hooks/useKeepItem",
    "keepkit/src/hooks/useKeepList": "keepkit/src/react/hooks/useKeepList",
    "keepkit/src/hooks/useKeepNavigator": "keepkit/src/react/hooks/useKeepNavigator",
    "keepkit/src/hooks/useKeepShortcut": "keepkit/src/react/hooks/useKeepShortcut",
    "keepkit/src/hooks/useKeepStoreSelector": "keepkit/src/react/hooks/useKeepStoreSelector",
    "keepkit-ui/src/KeepBackup": "keepkit-ui/src/features/actions/KeepBackup",
    "keepkit-ui/src/KeepBulkActions": "keepkit-ui/src/features/actions/KeepBulkActions",
    "keepkit-ui/src/KeepButton": "keepkit-ui/src/features/actions/KeepButton",
    "keepkit-ui/src/KeepItemCheckbox": "keepkit-ui/src/features/actions/KeepItemCheckbox",
    "keepkit-ui/src/KeepUndo": "keepkit-ui/src/features/actions/KeepUndo",
    "keepkit-ui/src/hooks/useKeepBackup": "keepkit-ui/src/features/actions/hooks/useKeepBackup",
    "keepkit-ui/src/hooks/useKeepBulkActions": "keepkit-ui/src/features/actions/hooks/useKeepBulkActions",
    "keepkit-ui/src/hooks/useKeepButton": "keepkit-ui/src/features/actions/hooks/useKeepButton",
    "keepkit-ui/src/hooks/useKeepUndo": "keepkit-ui/src/features/actions/hooks/useKeepUndo",
    "keepkit-ui/src/KeepCollection": "keepkit-ui/src/features/collection/KeepCollection",
    "keepkit-ui/src/KeepLayout": "keepkit-ui/src/features/collection/KeepLayout",
    "keepkit-ui/src/KeepList": "keepkit-ui/src/features/collection/KeepList",
    "keepkit-ui/src/KeepReorderableList": "keepkit-ui/src/features/collection/KeepReorderableList",
    "keepkit-ui/src/hooks/useKeepCollection": "keepkit-ui/src/features/collection/hooks/useKeepCollection",
    "keepkit-ui/src/hooks/useKeepListView": "keepkit-ui/src/features/collection/hooks/useKeepListView",
    "keepkit-ui/src/hooks/useRovingTabIndex": "keepkit-ui/src/features/collection/hooks/useRovingTabIndex",
    "keepkit-ui/src/KeepItemCard": "keepkit-ui/src/features/item/KeepItemCard",
    "keepkit-ui/src/KeepItemStatusBadge": "keepkit-ui/src/features/item/KeepItemStatusBadge",
    "keepkit-ui/src/hooks/useKeepItemCard": "keepkit-ui/src/features/item/hooks/useKeepItemCard",
    "keepkit-ui/src/hooks/useKeepItemStatusBadge": "keepkit-ui/src/features/item/hooks/useKeepItemStatusBadge",
    "keepkit-ui/src/KeepNoteEditor": "keepkit-ui/src/features/editor/KeepNoteEditor",
    "keepkit-ui/src/KeepTagEditor": "keepkit-ui/src/features/editor/KeepTagEditor",
    "keepkit-ui/src/hooks/useKeepNoteEditor": "keepkit-ui/src/features/editor/hooks/useKeepNoteEditor",
    "keepkit-ui/src/hooks/useKeepTagEditor": "keepkit-ui/src/features/editor/hooks/useKeepTagEditor",
    "keepkit-ui/src/KeepTagFilter": "keepkit-ui/src/features/query/KeepTagFilter",
    "keepkit-ui/src/query-controls": "keepkit-ui/src/features/query/query-controls",
    "keepkit-ui/src/hooks/useKeepTagFilter": "keepkit-ui/src/features/query/hooks/useKeepTagFilter",
    "keepkit-ui/src/hooks/useQueryControls": "keepkit-ui/src/features/query/hooks/useQueryControls",
    "keepkit-ui/src/KeepStaleNotice": "keepkit-ui/src/features/status/KeepStaleNotice",
    "keepkit-ui/src/status": "keepkit-ui/src/features/status/status",
    "keepkit-ui/src/hooks/useKeepStaleNotice": "keepkit-ui/src/features/status/hooks/useKeepStaleNotice",
    "keepkit-ui/src/hooks/useStatusViews": "keepkit-ui/src/features/status/hooks/useStatusViews",
    "keepkit-ui/src/KeepSyncFeedbackObserver": "keepkit-ui/src/features/sync/KeepSyncFeedbackObserver",
    "keepkit-ui/src/KeepSyncRecoveryDialog": "keepkit-ui/src/features/sync/KeepSyncRecoveryDialog",
    "keepkit-ui/src/KeepSyncStatusBanner": "keepkit-ui/src/features/sync/KeepSyncStatusBanner",
    "keepkit-ui/src/hooks/useKeepSyncFeedback": "keepkit-ui/src/features/sync/hooks/useKeepSyncFeedback",
    "keepkit-ui/src/hooks/useKeepSyncRecoveryDialog": "keepkit-ui/src/features/sync/hooks/useKeepSyncRecoveryDialog",
    "keepkit-ui/src/hooks/useKeepSyncStatusBanner": "keepkit-ui/src/features/sync/hooks/useKeepSyncStatusBanner",
    "keepkit-ui/src/KeepTourBar": "keepkit-ui/src/features/navigation/KeepTourBar",
    "keepkit-ui/src/hooks/useKeepTourShortcuts": "keepkit-ui/src/features/navigation/hooks/useKeepTourShortcuts",
    "keepkit-ui/src/hooks/useKeepToastFeedback": "keepkit-ui/src/features/feedback/useKeepToastFeedback",
    "keepkit-ui/src/shared": "keepkit-ui/src/foundation/shared",
    "keepkit-ui/src/theme": "keepkit-ui/src/foundation/theme",
    "keepkit-ui/src/ui-context": "keepkit-ui/src/foundation/ui-context",
    "keepkit-ui/src/url-sync": "keepkit-ui/src/adapters/url-sync",
  }),
);

const inverseMap = new Map([...pathMap].map(([oldPath, newPath]) => [resolve(oldPath), resolve(newPath)]));
const files = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if ([".ts", ".tsx"].includes(extname(path))) files.push(path);
  }
}

await walk(sourceRoot);

for (const file of files) {
  const oldFile = [...inverseMap.entries()].find(([, newPath]) => newPath === resolve(file))?.[0] ?? resolve(file);
  const oldDirectory = dirname(oldFile);
  const source = await readFile(file, "utf8");
  const updated = source.replace(
    /((?:from\s+|import\s*\(\s*))(["'])(\.[^"']+)\2/g,
    (match, prefix, quote, specifier) => {
      const oldTarget = relative(resolve("."), resolve(oldDirectory, specifier));
      const targetKey = pathMap.has(oldTarget) ? oldTarget : oldTarget.replace(/\.(tsx?|jsx?)$/, "");
      const destination = pathMap.get(targetKey);
      if (!destination) return match;
      const nextSpecifier = relative(dirname(file), resolve(destination)).replace(/\.(tsx?|jsx?)$/, "");
      return `${prefix}${quote}${nextSpecifier.startsWith(".") ? nextSpecifier : `./${nextSpecifier}`}${quote}`;
    },
  );
  if (updated !== source) await writeFile(file, updated);
}
