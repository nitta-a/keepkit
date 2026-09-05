import { spawn } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lockDirectory = resolve(repositoryRoot, ".turbo", "keepkit-ui-build.lock");
const lockOwnerPath = resolve(lockDirectory, "pid");
const waitMilliseconds = 100;

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

await acquireLock();
try {
  await runUiBuild();
} finally {
  await rm(lockDirectory, { recursive: true, force: true });
}
