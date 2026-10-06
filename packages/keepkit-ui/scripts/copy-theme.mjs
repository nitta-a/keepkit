import { copyFile, mkdir, utimes } from "node:fs/promises";

await mkdir("dist/styles", { recursive: true });
await Promise.all([
  copyThemeAsset("src/theme.css", "dist/theme.css"),
  copyThemeAsset("src/tailwind.css", "dist/tailwind.css"),
  ...["base.css", "button.css", "collection.css", "status.css", "sync.css", "workspace.css"].map((name) =>
    copyThemeAsset(`src/styles/${name}`, `dist/styles/${name}`),
  ),
]);

async function copyThemeAsset(source, destination) {
  await copyFile(source, destination);
  const timestamp = new Date();
  await utimes(destination, timestamp, timestamp);
}
