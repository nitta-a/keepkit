import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { bundleUiConsumer, bundleUiConsumerCode } from "./bundle-ui-consumer.mts";

// This workspace consumer depends on @keepkit/ui through its published exports map.
const consumer = fileURLToPath(new URL("../tests/integration/", import.meta.url));
const manifest = JSON.parse(await readFile(new URL("../packages/keepkit-ui/package.json", import.meta.url), "utf8"));
const jsRows = ["| Component / コンポーネント | Import / インポート | gzip (bytes) |", "| --- | --- | ---: |"];
const cssRows = ["| Stylesheet / スタイルシート | gzip (bytes) |", "| --- | ---: |"];
for (const key of Object.keys(manifest.exports).sort()) {
  if ([".", "./react", "./tailwind"].includes(key)) continue;
  if (key.startsWith("./locales/")) continue;
  const slug = key.slice(2);
  const specifier = `@keepkit/ui/${slug}`;
  const isCss = slug.endsWith(".css");
  const component =
    slug === "ui-provider-light"
      ? "KeepUiProvider"
      : slug === "kit-provider-light"
        ? "KeepKitProvider"
        : `Keep${slug.replace(/(^|-)([a-z])/g, (_, _separator, letter) => letter.toUpperCase())}`;
  const { outputFiles } = await bundleUiConsumer(consumer, specifier, isCss ? undefined : component);
  if (outputFiles.length !== 1) throw new Error(`Expected one standalone output for ${specifier}`);
  const bytes = gzipSync(outputFiles[0].contents, { level: 9 }).byteLength;
  if (isCss) cssRows.push(`| \`${specifier}\` | ${bytes} |`);
  else jsRows.push(`| \`${component}\` | \`${specifier}\` | ${bytes} |`);
}

const example = await bundleUiConsumerCode(
  consumer,
  `export { KeepButton } from "@keepkit/ui/button";
   export { KeepUiProvider } from "@keepkit/ui/ui-provider-light";
   export { JA_LABELS } from "@keepkit/ui/locales/ja";`,
);
const exampleBytes = gzipSync(example.outputFiles[0].contents, { level: 9 }).byteLength;
const tables = [
  ...jsRows,
  "",
  `Button + light UI provider + Japanese / ボタン＋軽量UI Provider＋日本語: **${exampleBytes} bytes gzip**.`,
  "",
  "### CSS",
  "",
  ...cssRows,
].join("\n");
if (process.argv.includes("--write")) {
  const file = new URL("../packages/keepkit-ui/README.md", import.meta.url);
  const previous = await readFile(file, "utf8");
  const marker = /(<!-- sizes:start -->\n)[\s\S]*?(\n<!-- sizes:end -->)/;
  if (!marker.test(previous)) throw new Error("Missing table markers in the UI README");
  await writeFile(file, previous.replace(marker, `$1\n${tables}\n$2`));
} else {
  console.log(tables);
}
