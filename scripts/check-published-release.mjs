import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packagesRoot = resolve(repositoryRoot, "packages");
const registry = "https://registry.npmjs.org";
const releaseTag = process.argv[2];
const maxAttempts = 60;
const pollIntervalMs = 10_000;

if (!/^v\d+\.\d+\.\d+$/.test(releaseTag ?? "")) {
  throw new Error(`Expected a semantic-version tag such as v0.1.0, received: ${releaseTag ?? "(missing)"}`);
}

const expectedVersion = releaseTag.slice(1);
const packageNames = await getPublishablePackageNames();
const publishedVersions = await waitForLatestVersions(packageNames, expectedVersion);

console.log(
  `npm latest versions match ${releaseTag}: ${packageNames
    .map((name) => `${name}@${publishedVersions.get(name)}`)
    .join(", ")}.`,
);

const verificationDirectory = await mkdtemp(join(tmpdir(), "keepkit-release-"));
try {
  await run("npm", ["init", "--yes"], verificationDirectory);
  await run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-package-lock",
      "--no-audit",
      "--no-fund",
      ...packageNames.map((name) => `${name}@latest`),
    ],
    verificationDirectory,
  );
  await run(
    "node",
    [
      "--input-type=module",
      "-e",
      "await import('@keepkit/core/core'); await import('@keepkit/core/react'); await import('@keepkit/ui');",
    ],
    verificationDirectory,
  );
  console.log("Clean latest-package install and public-entry imports passed.");
} finally {
  await rm(verificationDirectory, { recursive: true, force: true });
}

async function getPublishablePackageNames() {
  const packageDirectories = await readdir(packagesRoot, { withFileTypes: true });
  const packageNames = [];
  for (const directory of packageDirectories) {
    if (!directory.isDirectory()) continue;
    try {
      const packageJson = JSON.parse(await readFile(resolve(packagesRoot, directory.name, "package.json"), "utf8"));
      if (!packageJson.private && typeof packageJson.name === "string") packageNames.push(packageJson.name);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  if (packageNames.length === 0) throw new Error("No publishable packages were found under packages/.");
  return packageNames.sort();
}

async function waitForLatestVersions(packageNames, expectedVersion) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const versions = new Map();
    for (const packageName of packageNames) versions.set(packageName, await getLatestVersion(packageName));
    if (packageNames.every((packageName) => versions.get(packageName) === expectedVersion)) return versions;

    const summary = packageNames
      .map((packageName) => `${packageName}=${versions.get(packageName) || "unavailable"}`)
      .join(", ");
    if (attempt === maxAttempts) {
      throw new Error(`Timed out waiting for npm latest versions to become ${expectedVersion}: ${summary}`);
    }
    console.log(`Waiting for npm latest versions (attempt ${attempt}/${maxAttempts}): ${summary}`);
    await wait(pollIntervalMs);
  }
  throw new Error("Unreachable npm publication polling state.");
}

async function getLatestVersion(packageName) {
  try {
    const { stdout } = await execFileAsync(
      "npm",
      ["view", `${packageName}@latest`, "version", `--registry=${registry}`],
      {
        cwd: repositoryRoot,
        maxBuffer: 1024 * 1024,
      },
    );
    return stdout.trim();
  } catch {
    return "";
  }
}

async function run(command, args, cwd) {
  try {
    await execFileAsync(command, args, { cwd, maxBuffer: 8 * 1024 * 1024 });
  } catch (error) {
    const output = [error.stdout, error.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${command} ${args.join(" ")} failed${output ? `:\n${output}` : "."}`, { cause: error });
  }
}

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
