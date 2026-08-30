import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/storage.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react/jsx-runtime"],
});
