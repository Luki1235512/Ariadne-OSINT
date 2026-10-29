import { upsertBoundary, upsertObject, upsertSource } from "@ariadne/db";
import { createTestDb, resetData } from "@ariadne/db/test-support";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildServer } from "../server.js";

const db = createTestDb();
const app = buildServer({ config: { LOG_LEVEL: "silent" }, db });

afterAll(async () => {
  await app.close();
  await db.destroy();
});

const sourceId = "test:dataset:api-tiles";

beforeAll(async () => {
  await resetData(db);
  await upsertSource(db, {
    id: sourceId,
    name: "Synthetic tile test data",
    publisher: "Ariadne tests",
    url: "https://example.org/tiles",
    license: "CC0-1.0",
    licenseUrl: null,
    retrievedAt: "2026-10-26T08:00:00Z",
  });
  await upsertObject(
    db,
    {
      id: "test:loc:town",
      type: "Location",
      countryCode: "PL",
      displayName: "Town",
      properties: { kind: "administrative_area", adminLevel: 3, areaKm2: 80, countryData: {} },
    },
    [{ sourceId, recordRef: "town" }],
  );
  await upsertBoundary(db, {
    objectId: "test:loc:town",
    sourceId,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [21, 52],
          [21.1, 52],
          [21.1, 52.1],
          [21, 52.1],
          [21, 52],
        ],
      ],
    },
  });
});

describe("GET /api/tiles/admin/{z}/{x}/{y}", () => {
  it("returns a vector tile with cache headers", async () => {
    const response = await app.inject({ method: "GET", url: "/api/tiles/admin/9/285/168" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("application/vnd.mapbox-vector-tile");
    expect(response.headers["cache-control"]).toBe("public, max-age=3600");
    expect(response.rawPayload.length).toBeGreaterThan(0);
  });

  it("returns 204 for a tile with no data at that zoom level", async () => {
    const response = await app.inject({ method: "GET", url: "/api/tiles/admin/6/35/21" });

    expect(response.statusCode).toBe(204);
    expect(response.headers["cache-control"]).toBe("public, max-age=3600");
    expect(response.rawPayload.length).toBe(0);
  });
});
