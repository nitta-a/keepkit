import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releaseTag = process.argv[2];

if (!/^v\d+\.\d+\.\d+$/.test(releaseTag ?? "")) {
  throw new Error(`Expected a semantic-version tag such as v0.1.0, received: ${releaseTag ?? "(missing)"}`);
}

const expectedVersion = releaseTag.slice(1);
const packagesRoot = resolve(repositoryRoot, "packages");
const packageDirectories = await readdir(packagesRoot, { withFileTypes: true });
const publishablePackages = [];

for (const directory of packageDirectories) {
  if (!directory.isDirectory()) continue;

  const packagePath = resolve(packagesRoot, directory.name, "package.json");
  try {
    const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
    if (!packageJson.private) publishablePackages.push({ name: packageJson.name, version: packageJson.version });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

if (publishablePackages.length === 0) {
  throw new Error("No publishable packages were found under packages/.");
}

const mismatches = publishablePackages.filter(({ version }) => version !== expectedVersion);
if (mismatches.length > 0) {
  const details = mismatches.map(({ name, version }) => `${name}@${version}`).join(", ");
  throw new Error(`Release tag ${releaseTag} does not match package version ${expectedVersion}: ${details}`);
}

console.log(`Release version check passed for ${publishablePackages.map(({ name }) => name).join(", ")}.`);
