import { type AreaGeometry, LinkInput, ObjectInput } from "@ariadne/shared";
import { describe, expect, it } from "vitest";
import { type MappedUnit, mapPrgFeature, normalizeRegon, terytObjectId } from "./map.js";
import { PrgFeature } from "./record.js";

const square: AreaGeometry = {
  type: "Polygon",
  coordinates: [
    [
      [20, 51],
      [20.1, 51],
      [20.1, 51.1],
      [20, 51.1],
      [20, 51],
    ],
  ],
};

function feature(properties: Partial<PrgFeature["properties"]>): PrgFeature {
  return {
    type: "Feature",
    properties: {
      JPT_KOD_JE: "14",
      JPT_SJR_KO: "WOJ",
      JPT_NAZWA_: "mazowieckie",
      JPT_POWIER: 3555858,
      IIP_PRZEST: "PL.PZGIK.200",
      IIP_IDENTY: "4b6c492a-eb04-441d-a92a-f44359c06de7",
      REGON: "01552891000000",
      ...properties,
    },
    geometry: square,
  };
}

const voivodeship = feature({});
const county = feature({
  JPT_KOD_JE: "0401",
  JPT_SJR_KO: "POW",
  JPT_NAZWA_: "powiat aleksandrowski",
  JPT_POWIER: 47461,
  IIP_IDENTY: "20bd1fbc-6150-400a-985a-d7471db79bf0",
  REGON: "91086647100000",
});
const cityCounty = feature({
  JPT_KOD_JE: "1465",
  JPT_SJR_KO: "POW",
  JPT_NAZWA_: "powiat Warszawa",
  REGON: "brak",
});
const municipality = feature({
  JPT_KOD_JE: "1007013",
  JPT_SJR_KO: "GMI",
  JPT_NAZWA_: "Białaczów",
  JPT_POWIER: 11461,
  IIP_IDENTY: "f324915f-b630-403a-856e-c95263a7dc19",
  REGON: "59064782000000",
});

function unit(input: PrgFeature): MappedUnit {
  const result = mapPrgFeature(input);
  if (!result.ok) {
    throw new Error(result.problem);
  }
  return result.unit;
}

function problem(input: PrgFeature): string {
  const result = mapPrgFeature(input);
  if (result.ok) {
    throw new Error("Expected a problem");
  }
  return result.problem;
}

describe("mapPrgFeature", () => {
  it("maps a voivodeship without a parent", () => {
    const { object, parentLink, recordRef } = unit(voivodeship);
    expect(object).toEqual({
      id: "pl:teryt:14",
      type: "Location",
      countryCode: "PL",
      displayName: "mazowieckie",
      properties: {
        kind: "administrative_area",
        adminLevel: 1,
        areaKm2: 35558.58,
        countryData: { pl: { teryt: "14", regon: "015528910" } },
      },
    });
    expect(parentLink).toBeNull();
    expect(recordRef).toBe("PL.PZGIK.200/4b6c492a-eb04-441d-a92a-f44359c06de7");
  });

  it("links a county to its voivodeship", () => {
    const { object, parentLink } = unit(county);
    expect(object.id).toBe("pl:teryt:0401");
    expect(parentLink).toEqual({
      id: "pl:teryt:0401/located_in/pl:teryt:04",
      type: "located_in",
      fromObjectId: "pl:teryt:0401",
      toObjectId: "pl:teryt:04",
      validFrom: null,
      validTo: null,
      confidence: null,
      properties: {},
    });
  });

  it("maps a municipality with a 6-digit ID and links it to its county", () => {
    const { object, parentLink } = unit(municipality);
    expect(object.id).toBe("pl:teryt:100701");
    expect(object.properties).toEqual({
      kind: "administrative_area",
      adminLevel: 3,
      areaKm2: 114.61,
      countryData: {
        pl: { teryt: "1007013", municipalityType: "urban_rural", regon: "590647820" },
      },
    });
    expect(parentLink?.toObjectId).toBe("pl:teryt:1007");
  });

  it('stores no REGON for a unit marked "brak"', () => {
    expect(unit(cityCounty).object.properties.countryData.pl?.regon).toBeNull();
  });

  it("keeps the name exactly as published, without surrounding spaces", () => {
    expect(unit(feature({ JPT_NAZWA_: "  mazowieckie " })).object.displayName).toBe("mazowieckie");
  });

  it("stores no area when PRG has none", () => {
    expect(unit(feature({ JPT_POWIER: null })).object.properties.areaKm2).toBeNull();
  });

  it.each([voivodeship, county, cityCounty, municipality])(
    "produces data the write functions accept (%#)",
    (input) => {
      const { object, parentLink } = unit(input);
      expect(ObjectInput.safeParse(object).success).toBe(true);
      if (parentLink !== null) {
        expect(LinkInput.safeParse(parentLink).success).toBe(true);
      }
    },
  );

  it("reports a code that does not fit the level", () => {
    expect(problem(feature({ JPT_SJR_KO: "POW", JPT_KOD_JE: "14" }))).toMatch(/expected 4 digits/);
  });

  it("reports a municipality code whose type digit is not 1, 2 or 3", () => {
    expect(problem(feature({ JPT_SJR_KO: "GMI", JPT_KOD_JE: "1007014" }))).toMatch(
      /type digit "4"/,
    );
  });

  it("reports a REGON that is not a number", () => {
    expect(problem(feature({ REGON: "unknown" }))).toMatch(/REGON "unknown"/);
  });
});

describe("normalizeRegon", () => {
  it.each([
    ["01552891000000", "015528910"],
    ["01552891012345", "01552891012345"],
    ["015528910", "015528910"],
    ["brak", null],
    ["BRAK", null],
    ["", null],
    [null, null],
    ["0155", undefined],
    ["unknown", undefined],
  ])("turns %j into %j", (raw, expected) => {
    expect(normalizeRegon(raw)).toBe(expected);
  });
});

describe("terytObjectId", () => {
  it.each([
    ["14", "pl:teryt:14"],
    ["0401", "pl:teryt:0401"],
    ["1007013", "pl:teryt:100701"],
  ])("turns %s into %s", (code, id) => {
    expect(terytObjectId(code)).toBe(id);
  });
});

describe("PrgFeature", () => {
  it("accepts a record from the converted files", () => {
    expect(PrgFeature.safeParse(municipality).success).toBe(true);
  });

  it("rejects a record with an unexpected field, for example after a format change", () => {
    const changed = { ...municipality, properties: { ...municipality.properties, NOWE_POLE: "x" } };
    expect(PrgFeature.safeParse(changed).success).toBe(false);
  });

  it("rejects an unknown unit level", () => {
    const district = {
      ...municipality,
      properties: { ...municipality.properties, JPT_SJR_KO: "DZL" },
    };
    expect(PrgFeature.safeParse(district).success).toBe(false);
  });
});
