import { defineConfig, devices } from "@playwright/test";
import { API_PORT, e2eDatabaseUrl, WEB_PORT } from "./env.js";

const ci = process.env.CI !== undefined;

export default defineConfig({
  testDir: "tests",
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${String(WEB_PORT)}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node ../apps/api/dist/index.js",
      url: `http://127.0.0.1:${String(API_PORT)}/api/ready`,
      env: {
        DATABASE_URL: e2eDatabaseUrl(),
        HOST: "127.0.0.1",
        PORT: String(API_PORT),
        LOG_LEVEL: "warn",
      },
      reuseExistingServer: false,
    },
    {
      command: `pnpm --filter @ariadne/web exec vite preview --host 127.0.0.1 --port ${String(WEB_PORT)} --strictPort`,
      url: `http://127.0.0.1:${String(WEB_PORT)}`,
      env: { API_URL: `http://127.0.0.1:${String(API_PORT)}` },
      reuseExistingServer: false,
    },
  ],
});
