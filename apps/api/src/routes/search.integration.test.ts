import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { upsertLink, upsertObject, upsertSource } from "@ariadne/db";
import { createTestDb, resetData } from "@ariadne/db/test-support";
import type { SearchResponse } from "@ariadne/shared";
import { buildServer } from "../server.js";

const db = createTestDb();
const app = buildServer({ config: { LOG_LEVEL: "silent" }, db });

afterAll(async () => {
  await app.close();
  await db.destroy();
});

const sourceId = "test:dataset:api-search";

async function addLocation(id: string, name: string, adminLevel: number): Promise<void> {
  await upsertObject(
    db,
    {
      id,
      type: "Location",
      countryCode: "PL",
      displayName: name,
      properties: { kind: "administrative_area", adminLevel, areaKm2: 10, countryData: {} },
    },
    [{ sourceId, recordRef: id }],
  );
}

beforeAll(async () => {
  await resetData(db);
  await upsertSource(db, {
    id: sourceId,
    name: "Synthetic search data",
    publisher: "Ariadne tests",
    url: "https://example.org/search",
    license: "CC0-1.0",
    licenseUrl: null,
    retrievedAt: "2026-11-02T08:00:00Z",
  });
  await addLocation("test:loc:county", "powiat Łódź", 2);
  await addLocation("test:loc:town", "Łódź", 3);
  await upsertLink(
    db,
    {
      id: "test:loc:town/located_in/test:loc:county",
      type: "located_in",
      fromObjectId: "test:loc:town",
      toObjectId: "test:loc:county",
      properties: {},
      validFrom: null,
      validTo: null,
      confidence: null,
    },
    [{ sourceId, recordRef: "link" }],
  );
});

describe("GET /api/search", () => {
  it("returns matching objects with their parent, not cached", async () => {
    const response = await app.inject({ method: "GET", url: "/api/search?q=lodz" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json<SearchResponse>()).toEqual({
      results: [
        {
          id: "test:loc:town",
          type: "Location",
          displayName: "Łódź",
          parent: { id: "test:loc:county", type: "Location", displayName: "powiat Łódź" },
        },
        { id: "test:loc:county", type: "Location", displayName: "powiat Łódź", parent: null },
      ],
    });
  });

  it("accepts an encoded query with diacritics and respects the limit", async () => {
    const url = `/api/search?q=${encodeURIComponent("ŁÓDŹ")}&limit=1`;
    const response = await app.inject({ method: "GET", url });

    expect(response.statusCode).toBe(200);
    expect(response.json<SearchResponse>().results.map((result) => result.id)).toEqual([
      "test:loc:town",
    ]);
  });

  it("returns an empty list when nothing matches", async () => {
    const response = await app.inject({ method: "GET", url: "/api/search?q=zzzzqqq" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ results: [] });
  });
});
