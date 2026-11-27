import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bundleUiConsumer, bundleUiConsumerCode } from "../../../scripts/bundle-ui-consumer.mts";
import {
  collectExportFiles,
  createConsumer,
  type PackedPackage,
  packPublishablePackages,
  runNode,
  runTypeScript,
  toSpecifier,
} from "./support/packed-packages.ts";

const uiExports = ["KeepButton", "KeepCollection", "KeepItemCard", "KeepKitProvider", "createKeepKit"];

/** Non-component entry points. Each Keep* component in the UI root must also have its own path. */
const expectedEntryPoints: Record<string, string[]> = {
  "@keepkit/core/core": [
    "KeepSyncAuthError",
    "createAuthenticatedSyncKit",
    "exportItems",
    "importItems",
    "isKeepSyncAuthError",
  ],
  "@keepkit/core/react": [
    "KeepButton",
    "KeepErrorBoundary",
    "KeepProvider",
    "createKeepKit",
    "useKeepItem",
    "useKeepList",
  ],
  "@keepkit/core/schema": ["KeepSchemaValidationError", "parseKeepMeta", "validateKeepItem"],
  "@keepkit/core/storage": [
    "IndexedDBAdapter",
    "LocalStorageAdapter",
    "LocalStorageSyncQueueAdapter",
    "SyncStorageAdapter",
    "createBrowserStorageAdapter",
  ],
  "@keepkit/ui": uiExports,
  "@keepkit/ui/react": uiExports,
  "@keepkit/ui/tailwind": ["keepKitTheme"],
  "@keepkit/ui/ui-provider-light": ["KeepUiProvider"],
  "@keepkit/ui/kit-provider-light": ["KeepKitProvider"],
  ...Object.fromEntries(
    ["en", "ja", "ko", "zh-Hans", "zh-Hant", "th", "fr", "es", "pt-BR", "it", "de", "ru", "fil", "vi", "id", "ms"].map(
      (locale) => [`@keepkit/ui/locales/${locale}`, [`${locale.replaceAll("-", "_").toUpperCase()}_LABELS`]],
    ),
  ),
};

const privateSpecifiers = ["@keepkit/core", "@keepkit/core/dist/core.js", "@keepkit/ui/dist/index.js"];
const reactLinks = ["react", "react-dom", "@types/react", "@types/react-dom"];

type ProbeFailure = { code: string | null; message: string };
type ImportProbe = { specifier: string; exports?: string[]; error?: ProbeFailure };
type ResolveProbe = { specifier: string; url?: string; error?: ProbeFailure };
type ProbeResult = { imported: ImportProbe[]; resolved: ResolveProbe[] };

type FrameworkNeutralResult = {
  imported: number;
  restored: { id: string; title: string }[];
  parsed: unknown;
  schemaError: string | null;
  browserFallbackItems: unknown[];
  reactEntry: string | null;
};

type SsrResult = { core: string; ui: string };

describe("published packages in consumer projects", () => {
  let workspace = "";
  let packed = new Map<string, PackedPackage>();
  let reactApp = "";
  let nodeService = "";
  let components: string[] = [];

  before(async () => {
    // Resolved module URLs are canonical, so compare them against a canonical workspace path (macOS /var -> /private/var).
    workspace = await realpath(await mkdtemp(join(tmpdir(), "keepkit-consumers-")));
    const tarballs = join(workspace, "tarballs");
    await mkdir(tarballs);
    packed = await packPublishablePackages(tarballs);
    const packages = [...packed.values()];
    reactApp = await createConsumer(workspace, "react-app", { packages, links: reactLinks });
    const root = await probe(reactApp, { imports: ["@keepkit/ui"] });
    components = root.imported[0]?.exports?.filter((name) => /^Keep[A-Z]/.test(name)) ?? [];
    assert.ok(components.includes("KeepButton"), "UI root failed to load its components");
    nodeService = await createConsumer(workspace, "node-service", {
      packages: [getPacked("@keepkit/core")],
      links: [],
    });
  });

  after(async () => {
    if (workspace) await rm(workspace, { recursive: true, force: true });
  });

  function getPacked(name: string): PackedPackage {
    const result = packed.get(name);
    assert.ok(result, `${name} was not packed`);
    return result;
  }

  async function probe(cwd: string, request: { imports?: string[]; resolves?: string[] }): Promise<ProbeResult> {
    const { stdout } = await runNode(cwd, "probe-exports.mjs", [JSON.stringify(request)]);
    return JSON.parse(stdout);
  }

  test("tarballs contain only the manifest, documentation, and build output", () => {
    for (const { name, files, manifest } of packed.values()) {
      const unexpected = files.filter((file) => !/^(package\.json|README\.md|LICENSE(\.md)?|dist\/.+)$/.test(file));
      assert.deepEqual(unexpected, [], `${name} publishes unexpected files`);
      assert.ok(files.includes("README.md"), `${name} must publish its README`);

      const exportTargets = Object.values(manifest.exports ?? {}).flatMap(collectExportFiles);
      const missing = exportTargets
        .map((target) => target.replace(/^\.\//, ""))
        .filter((file) => !files.includes(file));
      assert.deepEqual(missing, [], `${name} exports files that are not in the tarball`);
    }
  });

  test("published manifests replace workspace-only dependency specifiers", () => {
    for (const { name, manifest } of packed.values()) {
      const specifiers = Object.entries({
        ...manifest.dependencies,
        ...manifest.peerDependencies,
        ...manifest.optionalDependencies,
      });
      const local = specifiers.filter(([, range]) => /^(workspace|link|file|catalog|portal):/.test(range));
      assert.deepEqual(local, [], `${name} publishes workspace-only dependency specifiers`);
    }
    assert.equal(getPacked("@keepkit/ui").manifest.dependencies?.["@keepkit/core"], getPacked("@keepkit/core").version);
  });

  test("every JavaScript entry point loads with its documented exports", async () => {
    const componentEntries = Object.fromEntries(components.map((name) => [componentSpecifier(name), [name]]));
    const expected = { ...expectedEntryPoints, ...componentEntries };
    const jsSpecifiers = [...packed.values()].flatMap(({ name, manifest }) =>
      Object.entries(manifest.exports ?? {})
        .filter(([, target]) => collectExportFiles(target).some((file) => file.endsWith(".js")))
        .map(([key]) => toSpecifier(name, key)),
    );
    assert.deepEqual(jsSpecifiers.sort(), Object.keys(expected).sort(), "exports map changed");

    const { imported } = await probe(reactApp, { imports: jsSpecifiers });
    for (const { specifier, exports, error } of imported) {
      assert.equal(error, undefined, `${specifier} failed to load`);
      if (specifier in componentEntries) assert.deepEqual(exports, componentEntries[specifier], specifier);
      const missing = expected[specifier].filter((name) => !exports?.includes(name));
      assert.deepEqual(missing, [], `${specifier} is missing exports`);
    }
    const uiRoot = imported.find(({ specifier }) => specifier === "@keepkit/ui");
    const uiReact = imported.find(({ specifier }) => specifier === "@keepkit/ui/react");
    assert.deepEqual(uiReact?.exports, uiRoot?.exports, "@keepkit/ui/react must alias the package root");
  });

  test("component client entries bundle independently of the root and button excludes unrelated features", async () => {
    const manifest = getPacked("@keepkit/ui").manifest;
    const packageRoot = join(reactApp, "node_modules", "@keepkit", "ui");
    for (const name of components) {
      const specifier = componentSpecifier(name);
      const target = manifest.exports?.[specifier.replace("@keepkit/ui", ".")];
      assert.ok(target && typeof target === "object");
      assert.equal(typeof target.types, "string");
      assert.ok(typeof target.import === "string");
      assert.match(await readFile(join(packageRoot, target.import), "utf8"), /^["']use client["'];/, specifier);

      const { metafile } = await bundleUiConsumer(reactApp, specifier, name);
      const inputs = Object.keys(metafile.inputs);
      assert.ok(!inputs.some((input) => input.endsWith("@keepkit/ui/dist/index.js")), specifier);
      if (name !== "KeepButton" && name !== "KeepItemCardSkeleton" && name !== "KeepLastActivity") continue;

      // Shared chunk names are hashed. Inspect their published maps to identify the actual source modules.
      const sources: string[] = [];
      for (const input of inputs.filter((path) => path.endsWith(".js"))) {
        const map: { sources: string[] } = JSON.parse(await readFile(join(reactApp, `${input}.map`), "utf8"));
        sources.push(...map.sources);
      }
      const module = name === "KeepButton" ? "actions/KeepButton" : `item/${name}`;
      assert.ok(sources.some((path) => path.endsWith(`/features/${module}.tsx`)));
      assert.ok(!sources.some((path) => path.endsWith("/features/item/KeepItemCard.tsx")), specifier);
      assert.deepEqual(
        sources.filter((path) => /\/features\/(collection|workspace|sync|editor)\//.test(path)),
        [],
      );
    }
  });

  test("a Japanese lightweight consumer excludes other locale dictionaries", async () => {
    const { metafile, outputFiles } = await bundleUiConsumerCode(
      reactApp,
      `export { KeepButton } from "@keepkit/ui/button";
       export { KeepUiProvider } from "@keepkit/ui/ui-provider-light";
       export { JA_LABELS } from "@keepkit/ui/locales/ja";`,
    );
    const sources: string[] = [];
    for (const input of Object.keys(metafile.inputs).filter((path) => path.endsWith(".js"))) {
      const map: { sources: string[] } = JSON.parse(await readFile(join(reactApp, `${input}.map`), "utf8"));
      sources.push(...map.sources);
    }
    const locales = [
      ...new Set(
        sources.filter((path) => /\/locales\/(?!types\.)[^/]+\.ts$/.test(path)).map((path) => path.split("/").at(-1)),
      ),
    ].sort();
    assert.deepEqual(locales, ["en.ts", "ja.ts"]);
    assert.ok(outputFiles[0].contents.length > 0);
  });

  test("build internals and the core package root stay private", async () => {
    const { resolved } = await probe(reactApp, { resolves: privateSpecifiers });
    for (const { specifier, url, error } of resolved) {
      assert.equal(url, undefined, `${specifier} must not resolve`);
      assert.equal(error?.code, "ERR_PACKAGE_PATH_NOT_EXPORTED", `${specifier}: ${error?.message}`);
    }
  });

  test("stylesheet exports resolve with imports that stay inside the package", async () => {
    const ui = getPacked("@keepkit/ui");
    const cssSpecifiers = Object.entries(ui.manifest.exports ?? {})
      .filter(([, target]) => collectExportFiles(target).every((file) => file.endsWith(".css")))
      .map(([key]) => toSpecifier(ui.name, key));
    assert.ok(cssSpecifiers.includes("@keepkit/ui/theme.css"));
    assert.ok(cssSpecifiers.includes("@keepkit/ui/tailwind.css"));

    const packageRoot = join(reactApp, "node_modules", "@keepkit", "ui");
    const { resolved } = await probe(reactApp, { resolves: cssSpecifiers });
    for (const { specifier, url, error } of resolved) {
      assert.ok(url, `${specifier} did not resolve: ${error?.message}`);
      const visited = await readCssImportGraph(fileURLToPath(url));
      const escaped = visited.filter((file) => relative(packageRoot, file).startsWith(`..${sep}`));
      assert.deepEqual(escaped, [], `${specifier} imports files outside @keepkit/ui`);
    }
  });

  test("framework-neutral entry points run in a Node service without React", async () => {
    const { resolved } = await probe(nodeService, { resolves: ["react"] });
    assert.equal(resolved[0]?.error?.code, "ERR_MODULE_NOT_FOUND", "the service fixture must not see React");

    const { stdout, stderr } = await runNode(nodeService, "framework-neutral.mjs");
    const result: FrameworkNeutralResult = JSON.parse(stdout);
    assert.deepEqual(result, {
      imported: 1,
      restored: [{ id: "note-1", title: "From the service" }],
      parsed: { title: "Valid" },
      schemaError: "KeepSchemaValidationError",
      browserFallbackItems: [],
      reactEntry: "ERR_MODULE_NOT_FOUND",
    });
    assert.equal(stderr, "");
  });

  test("React entry points server-render with one shared provider context", async () => {
    const { stdout, stderr } = await runNode(reactApp, "ssr.mjs");
    const { core, ui }: SsrResult = JSON.parse(stdout);

    assert.equal(count(core, 'aria-pressed="true"'), 1, core);
    assert.equal(count(core, 'aria-pressed="false"'), 1, core);
    assert.match(ui, /aria-pressed="true"/, "a core KeepButton must read the UI provider's store");
    assert.match(ui, /Packed label/, "subpath components must read the same UI label context");
    assert.match(ui, /data-keepkit="collection"/);
    assert.equal(stderr, "", "server rendering must not log warnings");
  });

  test("React type declarations compile with bundler resolution", async () => {
    await runTypeScript(reactApp, "tsconfig.bundler.json");
  });

  test("React type declarations compile with NodeNext resolution", async () => {
    await runTypeScript(reactApp, "tsconfig.nodenext.json");
  });

  test("framework-neutral type declarations compile without React types", async () => {
    await runTypeScript(nodeService, "tsconfig.json");
  });
});

async function readCssImportGraph(entry: string, visited = new Set<string>()): Promise<string[]> {
  if (visited.has(entry)) return [...visited];
  visited.add(entry);
  const source = await readFile(entry, "utf8");
  for (const [, url = "", quoted = ""] of source.matchAll(
    /@import\s+(?:url\(\s*["']?([^"')]+)["']?\s*\)|["']([^"']+)["'])/g,
  )) {
    const specifier = url || quoted;
    assert.match(specifier, /^\.{1,2}\//, `${entry} imports a non-relative stylesheet: ${specifier}`);
    const target = fileURLToPath(new URL(specifier, pathToFileURL(entry)));
    await readCssImportGraph(target, visited);
  }
  return [...visited];
}

function count(text: string, fragment: string): number {
  return text.split(fragment).length - 1;
}

function componentSpecifier(name: string): string {
  const slug = name
    .slice(4)
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase();
  return `@keepkit/ui/${slug}`;
}
