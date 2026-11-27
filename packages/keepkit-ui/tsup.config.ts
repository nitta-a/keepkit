import { readdirSync } from "node:fs";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.tsx",
    "src/tailwind.ts",
    "src/entries/*.ts",
    ...readdirSync("src/locales")
      .filter((file) => file.endsWith(".ts") && !["index.ts", "types.ts"].includes(file))
      .map((file) => `src/locales/${file}`),
  ],
  format: ["esm"],
  splitting: true,
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["@keepkit/core", "react", "react-dom", "react/jsx-runtime"],
});
