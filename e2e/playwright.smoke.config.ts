import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.SMOKE_URL ?? "https://ariadne-osint.onrender.com";

export default defineConfig({
  testDir: "smoke",
  retries: 1,
  reporter: "list",
  timeout: 60_000,
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
