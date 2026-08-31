import { copyFile } from "node:fs/promises";

await copyFile("src/theme.css", "dist/theme.css");
