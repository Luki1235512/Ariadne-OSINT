import type { ObjectDetails } from "@ariadne/shared";
import { upsertBoundary, upsertLink, upsertObject, upsertSource } from "@ariadne/db";
import { createTestDb, resetData } from "@ariadne/db/test-support";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildServer } from "../server.js";

const db = createTestDb();
const app = buildServer({ config: { LOG_LEVEL: "silent" }, db });

afterAll(async () => {
  await app.close();
  await db.destroy();
});

const sourceId = "test:dataset:api-objects";

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
    name: "Synthetic test data",
    publisher: "Ariadne tests",
    url: "https://example.org/objects",
    license: "CC0-1.0",
    licenseUrl: null,
    retrievedAt: "2026-10-28T08:00:00Z",
  });
  await addLocation("test:loc:region", "Region", 1);
  await addLocation("test:loc:town/old", "Łódź", 3);
  await upsertLink(
    db,
    {
      id: "test:loc:town/old/located_in/test:loc:region",
      type: "located_in",
      fromObjectId: "test:loc:town/old",
      toObjectId: "test:loc:region",
      properties: {},
      validFrom: null,
      validTo: null,
      confidence: null,
    },
    [{ sourceId, recordRef: "link" }],
  );
  await upsertBoundary(db, {
    objectId: "test:loc:town/old",
    sourceId,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [19.4, 51.7],
          [19.5, 51.7],
          [19.5, 51.8],
          [19.4, 51.8],
          [19.4, 51.7],
        ],
      ],
    },
  });
});

function url(id: string): string {
  return `/api/objects/${encodeURIComponent(id)}`;
}

describe("GET /api/objects/{id}", () => {
  it("returns the object's details, not cached", async () => {
    const response = await app.inject({ method: "GET", url: url("test:loc:town/old") });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("application/json; charset=utf-8");
    expect(response.headers["cache-control"]).toBe("no-store");
    const details = response.json<ObjectDetails>();
    expect(details).toMatchObject({
      id: "test:loc:town/old",
      type: "Location",
      displayName: "Łódź",
      countryCode: "PL",
    });
    expect(details.location?.bbox).toEqual([19.4, 51.7, 19.5, 51.8]);
    expect(details.sources.map((source) => source.id)).toEqual([sourceId]);
    expect(details.links).toEqual({
      total: 1,
      items: [
        expect.objectContaining({
          direction: "outgoing",
          other: { id: "test:loc:region", type: "Location", displayName: "Region" },
        }),
      ],
    });
  });

  it("also accepts colons that are not encoded", async () => {
    const response = await app.inject({ method: "GET", url: "/api/objects/test:loc:region" });

    expect(response.statusCode).toBe(200);
    expect(response.json<ObjectDetails>().links.items[0]?.direction).toBe("incoming");
  });

  it("returns 404 with an error code for an unknown ID", async () => {
    const response = await app.inject({ method: "GET", url: url("test:loc:nowhere") });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: "NOT_FOUND", message: "No object with this ID" },
    });
  });
});
