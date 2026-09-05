import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lockDirectory = resolve(repositoryRoot, ".turbo", "keepkit-ui-build.lock");
const lockOwnerPath = resolve(lockDirectory, "pid");
const waitMilliseconds = 100;
const uiPackageRoot = resolve(repositoryRoot, "packages", "keepkit-ui");
const uiBuildOutputs = ["dist/index.js", "dist/index.d.ts", "dist/theme.css", "dist/styles/workspace.css"];
const uiBuildInputs = ["package.json", "tsconfig.json", "tsup.config.ts", "scripts/copy-theme.mjs", "src"];

async function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

async function acquireLock() {
  while (true) {
    try {
      await mkdir(lockDirectory, { recursive: false });
      await writeFile(lockOwnerPath, String(process.pid));
      return;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      try {
        const ownerPid = Number.parseInt(await readFile(lockOwnerPath, "utf8"), 10);
        const lockStats = await stat(lockDirectory);
        const stale = !Number.isInteger(ownerPid) || !(await isProcessRunning(ownerPid));
        if (stale && Date.now() - lockStats.mtimeMs > 1000) await rm(lockDirectory, { recursive: true, force: true });
      } catch (lockError) {
        if (lockError.code === "ENOENT") continue;
        throw lockError;
      }
      await new Promise((resolveWait) => setTimeout(resolveWait, waitMilliseconds));
    }
  }
}

async function runUiBuild() {
  if (await isUiBuildReady()) return;
  await acquireLock();
  try {
    if (await isUiBuildReady()) return;
    await runUiBuildCommand();
  } finally {
    await rm(lockDirectory, { recursive: true, force: true });
  }
}

async function runUiBuildCommand() {
  await new Promise((resolveBuild, rejectBuild) => {
    const child = spawn("pnpm", ["--filter", "@keepkit/ui", "build"], {
      cwd: repositoryRoot,
      stdio: "inherit",
    });
    child.once("error", rejectBuild);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolveBuild();
        return;
      }
      rejectBuild(
        new Error(`@keepkit/ui build failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}.`),
      );
    });
  });
}

async function isUiBuildReady() {
  try {
    const outputStats = await Promise.all(uiBuildOutputs.map((path) => stat(resolve(uiPackageRoot, path))));
    const inputStats = await Promise.all(uiBuildInputs.map((path) => getLatestMtime(resolve(uiPackageRoot, path))));
    const latestInputMtime = Math.max(...inputStats);
    return outputStats.every(({ mtimeMs }) => mtimeMs >= latestInputMtime);
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function getLatestMtime(path) {
  const pathStats = await stat(path);
  if (!pathStats.isDirectory()) return pathStats.mtimeMs;
  const entries = await readdir(path, { withFileTypes: true });
  const childMtimes = await Promise.all(entries.map((entry) => getLatestMtime(resolve(path, entry.name))));
  return Math.max(pathStats.mtimeMs, ...childMtimes);
}

await runUiBuild();
