import { upsertBoundary, upsertLink, upsertObject, upsertSource, type Db } from "@ariadne/db";
import type { AreaGeometry } from "@ariadne/shared";

const SOURCE = "test:dataset:e2e";

interface Unit {
  id: string;
  name: string;
  level: number;
  parent: string | null;
  box: [number, number, number, number];
}

export const UNITS: Unit[] = [
  { id: "pl:teryt:14", name: "mazowieckie", level: 1, parent: null, box: [20, 51, 22, 53] },
  {
    id: "pl:teryt:1401",
    name: "powiat białobrzeski",
    level: 2,
    parent: "pl:teryt:14",
    box: [20.6, 51.5, 21, 51.9],
  },
  {
    id: "pl:teryt:1465",
    name: "powiat Warszawa",
    level: 2,
    parent: "pl:teryt:14",
    box: [20.9, 52.1, 21.2, 52.4],
  },
  {
    id: "pl:teryt:140101",
    name: "Białobrzegi",
    level: 3,
    parent: "pl:teryt:1401",
    box: [20.6, 51.6, 20.7, 51.7],
  },
  {
    id: "pl:teryt:146501",
    name: "Warszawa",
    level: 3,
    parent: "pl:teryt:1465",
    box: [20.9, 52.1, 21.2, 52.4],
  },
];

function rectangle([west, south, east, north]: Unit["box"]): AreaGeometry {
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

export async function seed(db: Db): Promise<void> {
  await upsertSource(db, {
    id: SOURCE,
    name: "Synthetic e2e data",
    publisher: "Ariadne tests",
    url: "https://example.org/e2e",
    license: "CC0-1.0",
    licenseUrl: null,
    retrievedAt: "2026-11-09T08:00:00Z",
  });
  for (const unit of UNITS) {
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
      [{ sourceId: SOURCE, recordRef: unit.id }],
    );
    await upsertBoundary(db, {
      objectId: unit.id,
      sourceId: SOURCE,
      geometry: rectangle(unit.box),
    });
  }
  for (const unit of UNITS) {
    if (unit.parent !== null) {
      await upsertLink(
        db,
        {
          id: `${unit.id}/located_in/${unit.parent}`,
          type: "located_in",
          fromObjectId: unit.id,
          toObjectId: unit.parent,
          properties: {},
          validFrom: null,
          validTo: null,
          confidence: null,
        },
        [{ sourceId: SOURCE, recordRef: unit.id }],
      );
    }
  }
}
