import { createDb } from "@ariadne/db";
import { afterAll, describe, expect, it } from "vitest";
import { buildServer } from "./server.js";

const db = createDb({ connectionString: "postgres://unused@127.0.0.1:1/unused" });
const app = buildServer({ config: { LOG_LEVEL: "silent" }, db });

afterAll(async () => {
  await app.close();
  await db.destroy();
});

describe("GET /api/health", () => {
  it("returns ok", async () => {
    const response = await app.inject({ method: "GET", url: "/api/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("returns 404 for unknown routes", async () => {
    const response = await app.inject({ method: "GET", url: "/api/nope" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: { code: "NOT_FOUND", message: "Not found" } });
  });
});

describe("unexpected errors", () => {
  it("return 500 with an error code and no details", async () => {
    const broken = buildServer({ config: { LOG_LEVEL: "silent" }, db });
    broken.get("/api/broken", () => {
      throw new Error("secret detail");
    });
    try {
      const response = await broken.inject({ method: "GET", url: "/api/broken" });

      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({
        error: { code: "INTERNAL_ERROR", message: "Internal error" },
      });
    } finally {
      await broken.close();
    }
  });
});
