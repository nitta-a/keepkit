import { execFile } from "node:child_process";
import { cp, mkdir, readdir, readFile, realpath, stat, symlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const integrationRoot = fileURLToPath(new URL("../../", import.meta.url));
const fixturesRoot = join(integrationRoot, "fixtures");

export type ExportTarget = string | { [condition: string]: ExportTarget };

export type PackageManifest = {
  name: string;
  version: string;
  type?: string;
  private?: boolean;
  exports?: Record<string, ExportTarget>;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

export type PackedPackage = {
  name: string;
  version: string;
  tarball: string;
  /** Paths inside the tarball, relative to the package root. */
  files: string[];
  /** The manifest as published, after pnpm rewrites workspace protocols. */
  manifest: PackageManifest;
};

export type ConsumerOptions = {
  packages: PackedPackage[];
  /** Third-party dependencies linked from this workspace instead of downloaded. */
  links: string[];
};

/** Packs every non-private package under `packages/` exactly as `pnpm publish` would. */
export async function packPublishablePackages(destination: string): Promise<Map<string, PackedPackage>> {
  const packagesRoot = join(repositoryRoot, "packages");
  const packed = new Map<string, PackedPackage>();
  for (const entry of await readdir(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = join(packagesRoot, entry.name);
    const manifest = parseManifest(await readFile(join(directory, "package.json"), "utf8"));
    if (manifest.private) continue;
    await assertBuilt(directory, manifest.name);
    const result = await packPackage(directory, destination);
    packed.set(result.name, result);
  }
  if (packed.size === 0) throw new Error("No publishable packages were found under packages/.");
  return packed;
}

/** Creates an isolated consumer project from `fixtures/<name>` with the packed tarballs installed. */
export async function createConsumer(
  root: string,
  name: string,
  { packages, links }: ConsumerOptions,
): Promise<string> {
  const directory = join(root, name);
  await cp(join(fixturesRoot, name), directory, { recursive: true });
  await cp(join(fixturesRoot, "shared", "probe-exports.mjs"), join(directory, "probe-exports.mjs"));
  for (const packed of packages) {
    const destination = join(directory, "node_modules", packed.name);
    await mkdir(destination, { recursive: true });
    await execFileAsync("tar", ["-xzf", packed.tarball, "-C", destination, "--strip-components=1"]);
  }
  for (const dependency of links) {
    const target = await realpath(join(integrationRoot, "node_modules", dependency));
    const link = join(directory, "node_modules", dependency);
    await mkdir(dirname(link), { recursive: true });
    await symlink(target, link, "junction");
  }
  return directory;
}

export async function runNode(cwd: string, script: string, args: string[] = []) {
  return execFileAsync(process.execPath, [script, ...args], { cwd });
}

/** Runs the workspace TypeScript compiler and reports diagnostics in the assertion message. */
export async function runTypeScript(cwd: string, project: string): Promise<void> {
  const compiler = join(integrationRoot, "node_modules", "typescript", "bin", "tsc");
  try {
    await execFileAsync(process.execPath, [compiler, "-p", project], { cwd });
  } catch (error) {
    const output = isRecord(error) ? `${String(error.stdout ?? "")}${String(error.stderr ?? "")}` : String(error);
    throw new Error(`TypeScript failed for ${project}:\n${output}`);
  }
}

/** Collects the files referenced by an export target, regardless of condition nesting. */
export function collectExportFiles(target: ExportTarget): string[] {
  if (typeof target === "string") return [target];
  return Object.values(target).flatMap(collectExportFiles);
}

/** Returns the public specifier for an export key, e.g. `@keepkit/core` + `./react`. */
export function toSpecifier(packageName: string, exportKey: string): string {
  return exportKey === "." ? packageName : `${packageName}/${exportKey.slice(2)}`;
}

async function packPackage(directory: string, destination: string): Promise<PackedPackage> {
  const { stdout } = await execFileAsync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["pack", "--json", "--pack-destination", destination],
    { cwd: directory, ...(process.platform === "win32" ? { shell: true } : {}) },
  );
  const result: unknown = JSON.parse(stdout);
  if (!isRecord(result) || typeof result.filename !== "string" || !Array.isArray(result.files)) {
    throw new Error(`Unexpected pnpm pack output for ${directory}:\n${stdout}`);
  }
  const files = result.files.flatMap((file) => (isRecord(file) && typeof file.path === "string" ? [file.path] : []));
  const { stdout: packedManifest } = await execFileAsync("tar", ["-xzOf", result.filename, "package/package.json"]);
  const manifest = parseManifest(packedManifest);
  return { name: manifest.name, version: manifest.version, tarball: result.filename, files, manifest };
}

async function assertBuilt(directory: string, name: string): Promise<void> {
  try {
    await stat(join(directory, "dist"));
  } catch {
    throw new Error(`${name} has no dist output. Run "pnpm build" before the integration tests.`);
  }
}

function parseManifest(text: string): PackageManifest {
  const value: unknown = JSON.parse(text);
  if (!isRecord(value) || typeof value.name !== "string" || typeof value.version !== "string") {
    throw new TypeError("package.json must declare a name and version.");
  }
  return value as PackageManifest;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
