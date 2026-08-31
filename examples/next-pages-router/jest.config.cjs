const fs = require("node:fs");
const path = require("node:path");
const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });
const monorepoCoreDist = path.resolve(__dirname, "../../packages/keepkit/dist");
module.exports = createJestConfig({
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testMatch: ["<rootDir>/**/*.test.tsx"],
  moduleNameMapper: fs.existsSync(monorepoCoreDist) ? { "^@keepkit/core/(.+)$": `${monorepoCoreDist}/$1.js` } : {},
});
