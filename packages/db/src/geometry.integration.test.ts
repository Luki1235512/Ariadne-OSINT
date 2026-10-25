import { sql } from "kysely";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, resetData } from "./test-support/index.js";
import { upsertObject, upsertSource } from "./write.js";

const db = createTestDb();

afterAll(async () => {
  await db.destroy();
});

const sourceId = "test:dataset:geo";
const objectId = "test:loc:area";

beforeEach(async () => {
  await resetData(db);
  await upsertSource(db, {
    id: sourceId,
    name: "Synthetic geometry test data",
    publisher: "Ariadne tests",
    url: "https://example.org/geo",
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

const square = "POLYGON((21 52, 21.1 52, 21.1 52.1, 21 52.1, 21 52))";

function insert(kind: string, wkt: string, srid = 4326) {
  return sql`
    INSERT INTO object_geometries (object_id, kind, geom, source_id)
    VALUES (${objectId}, ${kind}, ST_GeomFromText(${wkt}, ${srid}), ${sourceId})
  `.execute(db);
}

describe("object_geometries", () => {
  it("stores a boundary and a point for the same object", async () => {
    await insert("boundary", square);
    await insert("point", "POINT(21.05 52.05)");

    const rows = await sql<{ kind: string; geojson: string }>`
      SELECT kind, ST_AsGeoJSON(geom) AS geojson FROM object_geometries ORDER BY kind
    `.execute(db);
    expect(rows.rows.map((row) => row.kind)).toEqual(["boundary", "point"]);
    expect(JSON.parse(rows.rows[1]?.geojson ?? "null")).toEqual({
      type: "Point",
      coordinates: [21.05, 52.05],
    });
  });

  it("finds geometries inside a map area", async () => {
    await insert("point", "POINT(21.05 52.05)");
    const inside = await sql<{ object_id: string }>`
      SELECT object_id FROM object_geometries
      WHERE geom && ST_MakeEnvelope(20.9, 51.9, 21.2, 52.2, 4326)
    `.execute(db);
    const outside = await sql<{ object_id: string }>`
      SELECT object_id FROM object_geometries
      WHERE geom && ST_MakeEnvelope(14, 54, 15, 55, 4326)
    `.execute(db);
    expect(inside.rows).toEqual([{ object_id: objectId }]);
    expect(outside.rows).toEqual([]);
  });

  it("allows only one geometry of each kind per object", async () => {
    await insert("point", "POINT(21.05 52.05)");
    await expect(insert("point", "POINT(21.06 52.06)")).rejects.toThrow(/duplicate key/);
  });

  it("rejects a coordinate system other than WGS 84", async () => {
    await expect(insert("point", "POINT(637000 486000)", 2180)).rejects.toThrow(/SRID/);
  });

  it("rejects a polygon stored as a point", async () => {
    await expect(insert("point", square)).rejects.toThrow(/check constraint/);
  });

  it("rejects a point stored as a boundary", async () => {
    await expect(insert("boundary", "POINT(21.05 52.05)")).rejects.toThrow(/check constraint/);
  });

  it("rejects an invalid shape", async () => {
    const bowTie = "POLYGON((21 52, 21.1 52.1, 21.1 52, 21 52.1, 21 52))";
    await expect(insert("boundary", bowTie)).rejects.toThrow(/check constraint/);
  });

  it("is deleted together with its object", async () => {
    await insert("point", "POINT(21.05 52.05)");
    await db.deleteFrom("objects").where("id", "=", objectId).execute();
    expect(await db.selectFrom("object_geometries").select("object_id").execute()).toEqual([]);
  });
});
