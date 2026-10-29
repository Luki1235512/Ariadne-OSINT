import { createDb } from "@ariadne/db";
import { afterAll, describe, expect, it } from "vitest";
import { buildServer } from "../server.js";

describe("GET /api/objects/{id}, invalid requests", () => {
  const db = createDb({ connectionString: "postgres://unused@127.0.0.1:1/unused" });
  const app = buildServer({ config: { LOG_LEVEL: "silent" }, db });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it.each([
    ["an ID without a namespace", "/api/objects/14"],
    ["an upper-case namespace", "/api/objects/PL%3Ateryt%3A14"],
    ["a space in the ID", "/api/objects/pl%3Ateryt%3A1%204"],
    ["an ID that is too long", `/api/objects/pl%3A${"x".repeat(300)}`],
    ["a query parameter", "/api/objects/pl%3Ateryt%3A14?links=5"],
  ])("returns 400 for %s", async (_name, url) => {
    const response = await app.inject({ method: "GET", url });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "INVALID_REQUEST" } });
  });

  it("answers router errors in the API's error format", async () => {
    const tooLong = await app.inject({ method: "GET", url: `/api/objects/${"x".repeat(700)}` });
    const badEncoding = await app.inject({ method: "GET", url: "/api/objects/pl%3Ateryt%E0%A4%A" });

    expect(tooLong.statusCode).toBe(414);
    expect(badEncoding.statusCode).toBe(400);
    for (const response of [tooLong, badEncoding]) {
      expect(response.json()).toEqual({
        error: { code: "INVALID_REQUEST", message: "Malformed or too long URL" },
      });
    }
  });
});
