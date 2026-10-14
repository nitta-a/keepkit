import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

function firefoxLaunchOptions() {
  if (process.platform !== "darwin") return undefined;
  // Keep Gecko's app-data bookkeeping out of the user's protected Firefox directories.
  const directory = mkdtempSync(join(tmpdir(), "keepkit-browser-firefox-"));
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value;
  }
  env.MOZ_APP_DATA = join(directory, "data");
  env.MOZ_LOCAL_APP_DATA = join(directory, "local");
  mkdirSync(env.MOZ_APP_DATA);
  mkdirSync(env.MOZ_LOCAL_APP_DATA);
  return { env };
}

export default defineConfig({
  testDir: "./packages/keepkit-ui/test/browser",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 3,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4189",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"], launchOptions: firefoxLaunchOptions() } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "pnpm --filter @keepkit/ui exec vite test/browser/fixture --host 127.0.0.1 --port 4189 --strictPort",
    url: "http://127.0.0.1:4189",
    reuseExistingServer: !process.env.CI,
  },
});
