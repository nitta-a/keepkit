import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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

const packagesRoot = resolve(repositoryRoot, "packages");
const packageDirectories = await readdir(packagesRoot, { withFileTypes: true });
const publishablePackages = [];

for (const directory of packageDirectories) {
  if (!directory.isDirectory()) continue;
  const packageDirectory = resolve(packagesRoot, directory.name);
  const packageJsonPath = resolve(packageDirectory, "package.json");
  let packageJson;
  try {
    packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }

  if (packageJson.private) continue;
  if (!packageJson.exports || typeof packageJson.exports !== "object") {
    throw new Error(`${packageJson.name} must define an exports map.`);
  }
  for (const entryPoint of collectExportedFiles(packageJson.exports)) {
    await access(resolve(packageDirectory, entryPoint), constants.F_OK);
  }
  publishablePackages.push({ packageDirectory, packageJson });
}

if (publishablePackages.length === 0) throw new Error("No publishable packages were found under packages/.");

for (const { packageDirectory, packageJson } of publishablePackages) {
  const { stdout, stderr } = await execFileAsync("pnpm", ["pack", "--dry-run", "--json"], {
    cwd: packageDirectory,
  });

  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);

  console.log(`Package check passed for ${packageJson.name}@${packageJson.version}.`);
}
