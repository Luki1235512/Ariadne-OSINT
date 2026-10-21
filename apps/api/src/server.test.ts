import { afterAll, describe, expect, it } from "vitest";
import { buildServer } from "./server.js";

describe("GET /api/health", () => {
  const app = buildServer({ LOG_LEVEL: "silent" });

  afterAll(async () => {
    await app.close();
  });

  it("returns ok", async () => {
    const response = await app.inject({ method: "GET", url: "/api/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("returns 404 for unknown routes", async () => {
    const response = await app.inject({ method: "GET", url: "/api/nope" });

    expect(response.statusCode).toBe(404);
  });
});
