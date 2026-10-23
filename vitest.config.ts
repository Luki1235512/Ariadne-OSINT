import { configDefaults, defineConfig } from "vitest/config";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: rely on the environment.
}

const unit = {
  include: ["src/**/*.test.{ts,tsx}"],
  exclude: [...configDefaults.exclude, "**/*.integration.test.ts"],
};

export default defineConfig({
  test: {
    projects: [
      { test: { ...unit, name: "shared", root: "packages/shared" } },
      { test: { ...unit, name: "db", root: "packages/db" } },
      { test: { ...unit, name: "ingest", root: "packages/ingest" } },
      { test: { ...unit, name: "api", root: "apps/api" } },
      "apps/web",
      {
        test: {
          name: "integration",
          include: ["{apps,packages}/*/src/**/*.integration.test.ts"],
          globalSetup: ["packages/db/src/test-support/global-setup.ts"],
          fileParallelism: false,
        },
      },
    ],
  },
});
