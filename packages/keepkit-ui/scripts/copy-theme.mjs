import { copyFile, mkdir } from "node:fs/promises";

await mkdir("dist/styles", { recursive: true });
await Promise.all([
  copyFile("src/theme.css", "dist/theme.css"),
  copyFile("src/tailwind.css", "dist/tailwind.css"),
  ...["base.css", "button.css", "collection.css", "sync.css"].map((name) =>
    copyFile(`src/styles/${name}`, `dist/styles/${name}`),
  ),
]);
