import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "@ariadne/db";
import { buildServer } from "../server.js";
import { SearchQuery } from "./search.js";

describe("SearchQuery", () => {
  it("accepts a query, trims it, and reads an optional limit", () => {
    expect(SearchQuery.parse({ q: "  łódź " })).toEqual({ q: "łódź" });
    expect(SearchQuery.parse({ q: "lodz", limit: "5" })).toEqual({ q: "lodz", limit: 5 });
  });

  it.each([
    ["no query", {}],
    ["a query shorter than three characters", { q: "lo" }],
    ["a query of spaces", { q: "      " }],
    ["a query longer than 100 characters", { q: "x".repeat(101) }],
    ["a repeated query", { q: ["lodz", "warszawa"] }],
    ["a limit of 0", { q: "lodz", limit: "0" }],
    ["a limit above 20", { q: "lodz", limit: "21" }],
    ["a limit that is not a number", { q: "lodz", limit: "ten" }],
    ["an unknown parameter", { q: "lodz", sort: "name" }],
  ])("rejects %s", (_name, query) => {
    expect(SearchQuery.safeParse(query).success).toBe(false);
  });
});

describe("GET /api/search, invalid requests", () => {
  const db = createDb({ connectionString: "postgres://unused@127.0.0.1:1/unused" });
  const app = buildServer({ config: { LOG_LEVEL: "silent" }, db });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it.each([
    "/api/search",
    "/api/search?q=lo",
    "/api/search?q=lodz&q=wawa",
    "/api/search?q=lodz&x=1",
  ])("returns 400 with an error code for %s", async (url) => {
    const response = await app.inject({ method: "GET", url });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "INVALID_REQUEST" } });
  });
});
