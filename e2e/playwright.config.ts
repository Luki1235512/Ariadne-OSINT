import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import { e2eDatabaseUrl, PORT } from "./env.js";

const ci = process.env.CI !== undefined;
const baseURL = `http://127.0.0.1:${String(PORT)}`;

export default defineConfig({
  testDir: "tests",
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [["github"], ["list"]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node ../apps/api/dist/index.js",
    url: `${baseURL}/api/ready`,
    env: {
      DATABASE_URL: e2eDatabaseUrl(),
      HOST: "127.0.0.1",
      PORT: String(PORT),
      LOG_LEVEL: "warn",
      WEB_DIST_DIR: fileURLToPath(new URL("../apps/web/dist", import.meta.url)),
    },
    reuseExistingServer: false,
  },
});
