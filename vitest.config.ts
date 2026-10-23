import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],

    projects: [
      { extends: true, test: { name: "shared", root: "packages/shared" } },
      { extends: true, test: { name: "db", root: "packages/db" } },
      { extends: true, test: { name: "ingest", root: "packages/ingest" } },
      { extends: true, test: { name: "api", root: "apps/api" } },
      "apps/web",
    ],
  },
});
