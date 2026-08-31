import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.tsx", "src/tailwind.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["@keepkit/core", "react", "react/jsx-runtime"],
});
