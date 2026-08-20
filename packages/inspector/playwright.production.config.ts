import { defineConfig } from "@playwright/test";

const PRODUCTION_PREVIEW_PORT = 41738;

export default defineConfig({
  testDir: "./tests/production",
  testMatch: "**/*.spec.ts",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${PRODUCTION_PREVIEW_PORT}`,
    headless: true,
  },
  webServer: {
    command: `./node_modules/.bin/vite preview --outDir dist --host 127.0.0.1 --port ${PRODUCTION_PREVIEW_PORT}`,
    url: `http://127.0.0.1:${PRODUCTION_PREVIEW_PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
