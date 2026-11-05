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
    { name: "chromium", testIgnore: "demo-mobile.spec.ts", use: { ...devices["Desktop Chrome"] } },
    {
      name: "firefox",
      testIgnore: "demo-mobile.spec.ts",
      use: { ...devices["Desktop Firefox"], launchOptions: firefoxLaunchOptions() },
    },
    { name: "webkit", testIgnore: "demo-mobile.spec.ts", use: { ...devices["Desktop Safari"] } },
    {
      name: "pixel-7",
      testMatch: "demo-mobile.spec.ts",
      use: { ...devices["Pixel 7"], baseURL: "http://127.0.0.1:4280" },
    },
    {
      name: "iphone-13",
      testMatch: "demo-mobile.spec.ts",
      use: { ...devices["iPhone 13"], baseURL: "http://127.0.0.1:4280" },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @keepkit/ui exec vite test/browser/fixture --host 127.0.0.1 --port 4189 --strictPort",
      url: "http://127.0.0.1:4189",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "pnpm --filter @keepkit/demo dev --host 127.0.0.1 --port 4280 --strictPort",
      url: "http://127.0.0.1:4280",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
