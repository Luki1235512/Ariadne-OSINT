import type { AreaGeometry } from "@ariadne/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getObjectDetails } from "./object-details.js";
import { createTestDb, resetData } from "../test-support/index.js";
import {
  removeObject,
  upsertBoundary,
  upsertLink,
  upsertObject,
  upsertSource,
} from "../write/write.js";

const db = createTestDb();

afterAll(async () => {
  await db.destroy();
});

const registry = "test:dataset:registry";
const boundaries = "test:dataset:boundaries";

const square: AreaGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [21, 52],
      [21.2, 52],
      [21.2, 52.1],
      [21, 52.1],
      [21, 52],
    ],
  ],
};

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
    [{ sourceId: registry, recordRef: `row ${id}` }],
  );
}

async function locatedIn(from: string, to: string): Promise<void> {
  await upsertLink(
    db,
    {
      id: `${from}/located_in/${to}`,
      type: "located_in",
      fromObjectId: from,
      toObjectId: to,
      properties: {},
      validFrom: "1999-01-01",
      validTo: null,
      confidence: null,
    },
    [{ sourceId: registry, recordRef: `link ${from}` }],
  );
}

beforeEach(async () => {
  await resetData(db);
  for (const [id, name] of [
    [registry, "Synthetic registry"],
    [boundaries, "Synthetic boundaries"],
  ] as const) {
    await upsertSource(db, {
      id,
      name,
      publisher: "Ariadne tests",
      url: "https://example.org/data",
      license: "CC0-1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      retrievedAt: id === registry ? "2026-10-20T10:00:00Z" : "2026-10-25T10:00:00+02:00",
    });
  }
  await addLocation("test:loc:region", "Region", 1);
  await addLocation("test:loc:county", "County", 2);
  await addLocation("test:loc:zgierz", "Zgierz", 3);
  await addLocation("test:loc:aleksandrow", "Aleksandrów", 3);
  await locatedIn("test:loc:county", "test:loc:region");
  await locatedIn("test:loc:zgierz", "test:loc:county");
  await locatedIn("test:loc:aleksandrow", "test:loc:county");
  await upsertBoundary(db, { objectId: "test:loc:county", sourceId: boundaries, geometry: square });
});

describe("getObjectDetails", () => {
  it("returns undefined for an unknown ID", async () => {
    expect(await getObjectDetails(db, "test:loc:nowhere")).toBeUndefined();
  });

  it("returns the object's fields, location and sources, with the geometry's own source", async () => {
    const details = await getObjectDetails(db, "test:loc:county");

    expect(details).toMatchObject({
      id: "test:loc:county",
      type: "Location",
      displayName: "County",
      countryCode: "PL",
      properties: { kind: "administrative_area", adminLevel: 2, areaKm2: 10, countryData: {} },
    });
    expect(details?.location?.bbox).toEqual([21, 52, 21.2, 52.1]);
    const [lon, lat] = details?.location?.point ?? [0, 0];
    expect(lon).toBeGreaterThan(21);
    expect(lon).toBeLessThan(21.2);
    expect(lat).toBeGreaterThan(52);
    expect(lat).toBeLessThan(52.1);
    expect(details?.location?.source).toEqual({
      id: boundaries,
      name: "Synthetic boundaries",
      publisher: "Ariadne tests",
      url: "https://example.org/data",
      license: "CC0-1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      retrievedAt: "2026-10-25T08:00:00.000Z",
      recordRef: null,
    });
    expect(details?.sources).toEqual([
      expect.objectContaining({
        id: registry,
        retrievedAt: "2026-10-20T10:00:00.000Z",
        recordRef: "row test:loc:county",
      }),
    ]);
  });

  it("returns links in both directions, outgoing first, with the other object and sources", async () => {
    const details = await getObjectDetails(db, "test:loc:county");

    expect(details?.links.total).toBe(3);
    expect(details?.links.items.map((link) => [link.direction, link.other.displayName])).toEqual([
      ["outgoing", "Region"],
      ["incoming", "Aleksandrów"],
      ["incoming", "Zgierz"],
    ]);
    expect(details?.links.items[0]).toEqual({
      id: "test:loc:county/located_in/test:loc:region",
      type: "located_in",
      direction: "outgoing",
      other: { id: "test:loc:region", type: "Location", displayName: "Region" },
      properties: {},
      validFrom: "1999-01-01",
      validTo: null,
      confidence: null,
      sources: [expect.objectContaining({ id: registry, recordRef: "link test:loc:county" })],
    });
  });

  it("limits the number of links but reports the total", async () => {
    const details = await getObjectDetails(db, "test:loc:county", 2);

    expect(details?.links.total).toBe(3);
    expect(details?.links.items).toHaveLength(2);
  });

  it("returns no location for an object without geometry", async () => {
    const details = await getObjectDetails(db, "test:loc:region");

    expect(details?.location).toBeNull();
    expect(details?.links.items.map((link) => link.other.id)).toEqual(["test:loc:county"]);
  });

  it("treats a removed object as unknown, and drops its links from its neighbours", async () => {
    await removeObject(db, "test:loc:zgierz", "Removal requested");

    expect(await getObjectDetails(db, "test:loc:zgierz")).toBeUndefined();
    const county = await getObjectDetails(db, "test:loc:county");
    expect(county?.links.items.map((link) => link.other.id)).not.toContain("test:loc:zgierz");
  });
});
