import { createTestDb } from "@ariadne/db/test-support";
import { afterAll, describe, expect, it } from "vitest";
import { buildServer } from "./server.js";
import { createDb } from "@ariadne/db";

describe("GET /api/ready", () => {
  const db = createTestDb();
  const app = buildServer({ config: { LOG_LEVEL: "silent" }, db });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it("returns ok when the database is reachable", async () => {
    const response = await app.inject({ method: "GET", url: "/api/ready" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("returns 503 with an error code when the database is not reachable", async () => {
    const unreachable = createDb({ connectionString: "postgres://x:y@127.0.0.1:1/none" });
    const broken = buildServer({ config: { LOG_LEVEL: "silent" }, db: unreachable });
    try {
      const response = await broken.inject({ method: "GET", url: "/api/ready" });

      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual({
        error: { code: "DATABASE_UNAVAILABLE", message: "The database is not reachable" },
      });
    } finally {
      await broken.close();
      await unreachable.destroy();
    }
  });
});
