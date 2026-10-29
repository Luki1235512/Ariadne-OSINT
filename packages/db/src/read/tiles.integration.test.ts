import type { AreaGeometry } from "@ariadne/shared";
import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, resetData } from "../test-support/index.js";
import { adminAreaTile } from "./tiles.js";
import { upsertBoundary, upsertObject, upsertSource } from "../write/write.js";

const db = createTestDb();

afterAll(async () => {
  await db.destroy();
});

const sourceId = "test:dataset:tiles";

function square(west: number, south: number, size: number): AreaGeometry {
  const east = west + size;
  const north = south + size;
  return {
    type: "Polygon",
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  };
}

const units = [
  { id: "test:loc:region", name: "Region", level: 1, shape: square(20, 51, 2) },
  { id: "test:loc:district", name: "District", level: 2, shape: square(20.5, 51.5, 1) },
  { id: "test:loc:town", name: "Łódź", level: 3, shape: square(21, 52, 0.1) },
  { id: "test:loc:far", name: "Far away", level: 3, shape: square(14.2, 53.5, 0.1) },
];

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
  for (const unit of units) {
    await upsertObject(
      db,
      {
        id: unit.id,
        type: "Location",
        countryCode: "PL",
        displayName: unit.name,
        properties: {
          kind: "administrative_area",
          adminLevel: unit.level,
          areaKm2: 1,
          countryData: {},
        },
      },
      [{ sourceId, recordRef: unit.id }],
    );
    await upsertBoundary(db, { objectId: unit.id, sourceId, geometry: unit.shape });
  }
});

function tileAt(lon: number, lat: number, z: number): { z: number; x: number; y: number } {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const rad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return { z, x, y };
}

function decode(buffer: Buffer): VectorTile {
  return new VectorTile(new PbfReader(buffer));
}

function features(tile: VectorTile, layerName: string) {
  const layer = tile.layers[layerName];
  if (layer === undefined) {
    return [];
  }
  return Array.from({ length: layer.length }, (_, i) => layer.feature(i));
}

describe("adminAreaTile", () => {
  it("contains the areas and points of the requested level, with id and name", async () => {
    const tile = decode(await adminAreaTile(db, { ...tileAt(21.05, 52.05, 9), adminLevel: 3 }));

    const areas = features(tile, "areas");
    const points = features(tile, "points");
    expect(areas.map((f) => f.properties)).toEqual([{ id: "test:loc:town", name: "Łódź" }]);
    expect(points.map((f) => f.properties)).toEqual([{ id: "test:loc:town", name: "Łódź" }]);
    expect(areas[0]?.type).toBe(3);
    expect(points[0]?.type).toBe(1);
  });

  it("only contains units of the requested level", async () => {
    const at = tileAt(21.05, 52.05, 6);
    const regions = decode(await adminAreaTile(db, { ...at, adminLevel: 1 }));
    const districts = decode(await adminAreaTile(db, { ...at, adminLevel: 2 }));

    expect(features(regions, "areas").map((f) => f.properties.id)).toEqual(["test:loc:region"]);
    expect(features(districts, "areas").map((f) => f.properties.id)).toEqual(["test:loc:district"]);
  });

  it("puts the geometry in the right place", async () => {
    const at = tileAt(21.05, 52.05, 9);
    const tile = decode(await adminAreaTile(db, { ...at, adminLevel: 3 }));
    const point = features(tile, "points")[0]?.toGeoJSON(at.x, at.y, at.z);

    expect(point?.geometry.type).toBe("Point");
    if (point?.geometry.type === "Point") {
      const [lon, lat] = point.geometry.coordinates;
      expect(lon).toBeGreaterThan(21);
      expect(lon).toBeLessThan(21.1);
      expect(lat).toBeGreaterThan(52);
      expect(lat).toBeLessThan(52.1);
    }
  });

  it("returns an empty buffer for a tile with no data", async () => {
    const tile = await adminAreaTile(db, { ...tileAt(-40, 30, 9), adminLevel: 3 });
    expect(tile.length).toBe(0);
  });
});
