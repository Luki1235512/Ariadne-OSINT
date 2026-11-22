import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, resetData } from "../test-support/index.js";
import { upsertLink, upsertObject, upsertSource } from "../write/index.js";
import { searchObjects } from "./search.js";

const db = createTestDb();

afterAll(async () => {
  await db.destroy();
});

const sourceId = "test:dataset:search";

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

async function locatedIn(from: string, to: string): Promise<void> {
  await upsertLink(
    db,
    {
      id: `${from}/located_in/${to}`,
      type: "located_in",
      fromObjectId: from,
      toObjectId: to,
      properties: {},
      validFrom: null,
      validTo: null,
      confidence: null,
    },
    [{ sourceId, recordRef: `link ${from}` }],
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
  await addLocation("test:loc:lodzkie", "łódzkie", 1);
  await addLocation("test:loc:powiat-lodz", "powiat Łódź", 2);
  await addLocation("test:loc:lodz", "Łódź", 3);
  await addLocation("test:loc:warszawa", "Warszawa", 3);
  await addLocation("test:loc:nowa-wies-a", "Nowa Wieś", 3);
  await addLocation("test:loc:nowa-wies-b", "Nowa Wieś", 3);
  await addLocation("test:loc:county-a", "powiat A", 2);
  await addLocation("test:loc:county-b", "powiat B", 2);
  await addLocation("test:loc:percent", "Gmina 100% test", 3);
  await locatedIn("test:loc:lodz", "test:loc:powiat-lodz");
  await locatedIn("test:loc:powiat-lodz", "test:loc:lodzkie");
  await locatedIn("test:loc:nowa-wies-a", "test:loc:county-a");
  await locatedIn("test:loc:nowa-wies-b", "test:loc:county-b");
});

async function ids(query: string, limit?: number): Promise<string[]> {
  return (await searchObjects(db, query, limit)).map((result) => result.id);
}

describe("searchObjects", () => {
  it("ignores case and diacritics, and ranks the exact name first", async () => {
    expect(await ids("lodz")).toEqual([
      "test:loc:lodz",
      "test:loc:lodzkie",
      "test:loc:powiat-lodz",
    ]);
  });

  it("ranks names starting with the query before names containing it", async () => {
    expect((await ids("lod")).slice(0, 2)).toEqual(["test:loc:lodz", "test:loc:lodzkie"]);
  });

  it("ignores spaces around the query", async () => {
    expect((await ids("  warszawa  "))[0]).toBe("test:loc:warszawa");
  });

  it("tolerates a small typo", async () => {
    expect(await ids("warszwa")).toContain("test:loc:warszawa");
  });

  it("returns the parent unit, so objects with the same name can be told apart", async () => {
    const results = await searchObjects(db, "nowa wies");
    expect(results.map((result) => result.parent?.displayName)).toEqual(["powiat A", "powiat B"]);
    expect(results[0]).toEqual({
      id: "test:loc:nowa-wies-a",
      type: "Location",
      displayName: "Nowa Wieś",
      parent: { id: "test:loc:county-a", type: "Location", displayName: "powiat A" },
    });
  });

  it("treats % and _ in the query as plain characters", async () => {
    expect(await ids("100%")).toEqual(["test:loc:percent"]);
    expect(await ids("%%%")).toEqual([]);
    expect(await ids("___")).toEqual([]);
  });

  it("returns at most the requested number of results", async () => {
    expect(await ids("powiat", 2)).toHaveLength(2);
  });

  it("returns nothing for queries shorter than three characters", async () => {
    expect(await ids("lo")).toEqual([]);
    expect(await ids("  ł  ")).toEqual([]);
  });

  it("returns nothing for a name that does not exist", async () => {
    expect(await ids("zzzzqqq")).toEqual([]);
  });
});
