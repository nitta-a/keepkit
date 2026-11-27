import { build } from "esbuild";

/** Bundle one public specifier in isolation, as resolved from the consumer (never a source alias). */
export function bundleUiConsumer(directory: string, specifier: string, component?: string) {
  const path = JSON.stringify(specifier);
  return bundleUiConsumerCode(
    directory,
    component ? `export { ${component} } from ${path};` : `@import ${path};`,
    component ? "js" : "css",
  );
}

export function bundleUiConsumerCode(directory: string, contents: string, loader: "js" | "css" = "js") {
  return build({
    absWorkingDir: directory,
    stdin: {
      contents,
      loader,
      resolveDir: directory,
    },
    bundle: true,
    format: "esm",
    target: "es2020",
    platform: "browser",
    external: ["react", "react-dom", "@keepkit/core"],
    minify: true,
    treeShaking: true,
    legalComments: "none",
    logOverride: { "ignored-bare-import": "silent" },
    metafile: true,
    write: false,
  });
}
