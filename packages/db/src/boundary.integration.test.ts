import type { AreaGeometry } from "@ariadne/shared";
import { sql } from "kysely";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DbWriteError } from "./errors.js";
import { createTestDb, resetData } from "./test-support/index.js";
import { removeObject, upsertBoundary, upsertObject, upsertSource } from "./write.js";

const db = createTestDb();

afterAll(async () => {
  await db.destroy();
});

const sourceId = "test:dataset:boundaries";
const objectId = "test:loc:area";

const square: AreaGeometry = {
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
};

async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  const error: unknown = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(DbWriteError);
  expect((error as DbWriteError).code).toBe(code);
}

interface StoredGeometry {
  kind: string;
  type: string;
  inside: boolean;
}

async function stored(): Promise<StoredGeometry[]> {
  const result = await sql<StoredGeometry>`
    SELECT g.kind, GeometryType(g.geom) AS type,
      ST_Intersects(g.geom, b.geom) AS inside
    FROM object_geometries g
    JOIN object_geometries b ON b.object_id = g.object_id AND b.kind = 'boundary'
    ORDER BY g.kind
  `.execute(db);
  return result.rows;
}

beforeEach(async () => {
  await resetData(db);
  await upsertSource(db, {
    id: sourceId,
    name: "Synthetic boundary test data",
    publisher: "Ariadne tests",
    url: "https://example.org/boundaries",
    license: "CC0-1.0",
    licenseUrl: null,
    retrievedAt: "2026-10-24T08:00:00Z",
  });
  await upsertObject(
    db,
    {
      id: objectId,
      type: "Location",
      countryCode: "PL",
      displayName: "Area",
      properties: { kind: "administrative_area", adminLevel: 3, areaKm2: 80, countryData: {} },
    },
    [{ sourceId, recordRef: "area-1" }],
  );
});

describe("upsertBoundary", () => {
  it("stores the boundary as a MultiPolygon and a marker point inside it", async () => {
    expect(await upsertBoundary(db, { objectId, sourceId, geometry: square })).toBe("created");
    expect(await stored()).toEqual([
      { kind: "boundary", type: "MULTIPOLYGON", inside: true },
      { kind: "point", type: "POINT", inside: true },
    ]);
  });

  it("puts the marker inside an area whose centre lies outside it", async () => {
    const uShape: AreaGeometry = {
      type: "Polygon",
      coordinates: [
        [
          [21, 52],
          [21.3, 52],
          [21.3, 52.3],
          [21.2, 52.3],
          [21.2, 52.1],
          [21.1, 52.1],
          [21.1, 52.3],
          [21, 52.3],
          [21, 52],
        ],
      ],
    };
    await upsertBoundary(db, { objectId, sourceId, geometry: uShape });

    const centre = await sql<{ inside: boolean }>`
      SELECT ST_Contains(geom, ST_Centroid(geom)) AS inside
      FROM object_geometries WHERE kind = 'boundary'
    `.execute(db);
    expect(centre.rows[0]?.inside).toBe(false);
    expect((await stored()).find((row) => row.kind === "point")?.inside).toBe(true);
  });

  it("is idempotent: writing the same boundary again changes nothing", async () => {
    await upsertBoundary(db, { objectId, sourceId, geometry: square });
    expect(await upsertBoundary(db, { objectId, sourceId, geometry: square })).toBe("unchanged");
  });

  it("updates the boundary and moves the point when the shape changes", async () => {
    await upsertBoundary(db, { objectId, sourceId, geometry: square });
    const moved: AreaGeometry = {
      type: "Polygon",
      coordinates: [
        [
          [22, 52],
          [22.1, 52],
          [22.1, 52.1],
          [22, 52.1],
          [22, 52],
        ],
      ],
    };
    expect(await upsertBoundary(db, { objectId, sourceId, geometry: moved })).toBe("updated");

    const point = await sql<{ lon: number }>`
      SELECT ST_X(geom) AS lon FROM object_geometries WHERE kind = 'point'
    `.execute(db);
    expect(point.rows[0]?.lon).toBeGreaterThan(22);
  });

  it("repairs a shape whose outline crosses itself", async () => {
    const bowTie: AreaGeometry = {
      type: "Polygon",
      coordinates: [
        [
          [21, 52],
          [21.1, 52.1],
          [21.1, 52],
          [21, 52.1],
          [21, 52],
        ],
      ],
    };
    expect(await upsertBoundary(db, { objectId, sourceId, geometry: bowTie })).toBe("created");
    expect((await stored()).map((row) => row.type)).toEqual(["MULTIPOLYGON", "POINT"]);
  });

  it("rejects a shape with no area", async () => {
    const flat: AreaGeometry = {
      type: "Polygon",
      coordinates: [
        [
          [21, 52],
          [21.1, 52],
          [21.2, 52],
          [21, 52],
        ],
      ],
    };
    await expectCode(upsertBoundary(db, { objectId, sourceId, geometry: flat }), "INVALID_INPUT");
    expect(await db.selectFrom("object_geometries").select("kind").execute()).toEqual([]);
  });

  it("rejects invalid GeoJSON before touching the database", async () => {
    const geometry = { type: "Polygon", coordinates: [[[21, 52]]] } as never;
    await expectCode(upsertBoundary(db, { objectId, sourceId, geometry }), "INVALID_INPUT");
  });

  it("rejects a boundary for a missing object", async () => {
    await expectCode(
      upsertBoundary(db, { objectId: "test:loc:nowhere", sourceId, geometry: square }),
      "MISSING_OBJECT",
    );
  });

  it("rejects an unknown source", async () => {
    await expectCode(
      upsertBoundary(db, { objectId, sourceId: "test:nope:1", geometry: square }),
      "UNKNOWN_SOURCE",
    );
  });

  it("skips a removed object", async () => {
    await removeObject(db, objectId, "Removal request");
    expect(await upsertBoundary(db, { objectId, sourceId, geometry: square })).toBe("suppressed");
  });
});
