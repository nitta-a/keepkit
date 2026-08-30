import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageDirectory = resolve(repositoryRoot, "packages/keepkit");
const packageJson = JSON.parse(await readFile(resolve(packageDirectory, "package.json"), "utf8"));

if (packageJson.private) {
  throw new Error(`${packageJson.name} must be publishable (private must not be true).`);
}

if (!packageJson.exports || typeof packageJson.exports !== "object" || packageJson.exports["."]) {
  throw new Error(`${packageJson.name} must expose explicit subpath exports without a root export.`);
}

function collectExportedFiles(value, files = new Set()) {
  if (typeof value === "string") {
    files.add(value);
    return files;
  }
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) collectExportedFiles(child, files);
  }
  return files;
}

for (const entryPoint of collectExportedFiles(packageJson.exports)) {
  await access(resolve(packageDirectory, entryPoint), constants.F_OK);
}

const { stdout, stderr } = await execFileAsync("pnpm", ["pack", "--dry-run", "--json"], {
  cwd: packageDirectory,
});

if (stdout) process.stdout.write(stdout);
if (stderr) process.stderr.write(stderr);

console.log(`Package check passed for ${packageJson.name}@${packageJson.version}.`);
