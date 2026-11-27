import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.tsx", "src/tailwind.ts", "src/entries/*.ts"],
  format: ["esm"],
  splitting: true,
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["@keepkit/core", "react", "react-dom", "react/jsx-runtime"],
});
