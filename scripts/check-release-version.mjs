import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
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
    if (!packageJson.private) {
      publishablePackages.push({ directory: directory.name, name: packageJson.name, version: packageJson.version });
    }
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

const documentationPaths = [
  resolve(repositoryRoot, "README.md"),
  ...packageDirectories
    .filter((directory) => directory.isDirectory())
    .filter((directory) =>
      publishablePackages.some(({ directory: packageDirectory }) => packageDirectory === directory.name),
    )
    .map((directory) => resolve(packagesRoot, directory.name, "README.md")),
];
const versionPattern = /\bv\d+\.\d+\.\d+\b/g;
const documentationMismatches = [];

for (const documentationPath of documentationPaths) {
  const documentation = await readFile(documentationPath, "utf8");
  const versions = [...new Set(documentation.match(versionPattern) ?? [])];
  if (versions.length === 0) {
    documentationMismatches.push(`${relative(repositoryRoot, documentationPath)} (no release version found)`);
    continue;
  }
  const unexpectedVersions = versions.filter((version) => version !== releaseTag);
  if (unexpectedVersions.length > 0) {
    documentationMismatches.push(`${relative(repositoryRoot, documentationPath)} (${unexpectedVersions.join(", ")})`);
  }
}

if (documentationMismatches.length > 0) {
  throw new Error(
    `Release tag ${releaseTag} does not match documentation versions: ${documentationMismatches.join(", ")}`,
  );
}

console.log(
  `Release version check passed for ${publishablePackages.map(({ name }) => name).join(", ")} and documentation.`,
);
