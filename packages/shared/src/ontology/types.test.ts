import { describe, expect, it } from "vitest";
import { LINK_ENDPOINTS, LINK_TYPES, LinkInput, OBJECT_TYPES, ObjectInput } from "./types.js";

const location = {
  id: "pl:teryt:146501",
  type: "Location",
  countryCode: "PL",
  displayName: "Warszawa",
  properties: {
    kind: "administrative_area",
    adminLevel: 3,
    areaKm2: 517.2,
    countryData: { pl: { teryt: "1465011", municipalityType: "urban", regon: "015259640" } },
  },
};

const link = {
  id: "pl:teryt:146501/located_in/pl:teryt:1465",
  type: "located_in",
  fromObjectId: "pl:teryt:146501",
  toObjectId: "pl:teryt:1465",
  validFrom: null,
  validTo: null,
  confidence: null,
  properties: {},
};

describe("ObjectInput", () => {
  it("accepts a valid Location", () => {
    expect(ObjectInput.safeParse(location).success).toBe(true);
  });

  it("rejects unknown fields", () => {
    expect(ObjectInput.safeParse({ ...location, extra: 1 }).success).toBe(false);
  });

  it("rejects unknown properties", () => {
    expect(ObjectInput.safeParse({ ...location, properties: { pesel: "x" } }).success).toBe(false);
  });

  it("rejects an unknown type", () => {
    expect(ObjectInput.safeParse({ ...location, type: "Spaceship" }).success).toBe(false);
  });

  it("rejects an empty display name", () => {
    expect(ObjectInput.safeParse({ ...location, displayName: "  " }).success).toBe(false);
  });

  it("allows objects without a country or country-specific data", () => {
    const properties = { ...location.properties, countryData: {} };
    expect(ObjectInput.safeParse({ ...location, countryCode: null, properties }).success).toBe(
      true,
    );
  });

  it("rejects country data of another country", () => {
    expect(ObjectInput.safeParse({ ...location, countryCode: "DE" }).success).toBe(false);
  });

  it("rejects an admin level that contradicts the TERYT code", () => {
    const properties = { ...location.properties, adminLevel: 2 };
    expect(ObjectInput.safeParse({ ...location, properties }).success).toBe(false);
  });

  it("rejects an unknown kind", () => {
    const properties = { ...location.properties, kind: "spaceport" };
    expect(ObjectInput.safeParse({ ...location, properties }).success).toBe(false);
  });
});

describe("LinkInput", () => {
  it("accepts a valid link", () => {
    expect(LinkInput.safeParse(link).success).toBe(true);
  });

  it("rejects a link from an object to itself", () => {
    expect(LinkInput.safeParse({ ...link, toObjectId: link.fromObjectId }).success).toBe(false);
  });

  it("rejects validTo before validFrom", () => {
    const result = LinkInput.safeParse({ ...link, validFrom: "2024-05-01", validTo: "2024-04-30" });
    expect(result.success).toBe(false);
  });

  it("accepts an open-ended validity", () => {
    expect(LinkInput.safeParse({ ...link, validFrom: "2024-05-01" }).success).toBe(true);
  });

  it("rejects dates with a time of day", () => {
    expect(LinkInput.safeParse({ ...link, validFrom: "2024-05-01T10:00:00Z" }).success).toBe(false);
  });

  it.each([-0.1, 1.1])("rejects confidence %s", (confidence) => {
    expect(LinkInput.safeParse({ ...link, confidence }).success).toBe(false);
  });
});

describe("type lists", () => {
  it("lists every object type", () => {
    expect(OBJECT_TYPES).toEqual(["Location", "Event"]);
  });

  it("defines endpoints for every link type", () => {
    expect(Object.keys(LINK_ENDPOINTS).sort()).toEqual([...LINK_TYPES].sort());
  });
});

const event = {
  id: "gdelt:report:abc123",
  type: "Event",
  countryCode: "LV",
  displayName: "Trzy drony wleciały nad Łotwę. NATO poderwało myśliwce",
  startsAt: "2026-11-12T03:00:00Z",
  endsAt: null,
  properties: {
    kind: "media_report",
    category: "military",
    official: false,
    url: "https://wiadomosci.onet.pl/swiat/trzy-drony-wlecialy-nad-lotwe/bd9769j",
    publisher: "wiadomosci.onet.pl",
    locationPrecision: "country",
  },
};

describe("EventInput", () => {
  it("accepts a valid media report", () => {
    expect(ObjectInput.safeParse(event).success).toBe(true);
  });

  it("accepts an event with an end after its start", () => {
    expect(ObjectInput.safeParse({ ...event, endsAt: "2026-11-12T04:00:00+01:00" }).success).toBe(
      true,
    );
  });

  it("rejects an end before the start", () => {
    expect(ObjectInput.safeParse({ ...event, endsAt: "2026-11-12T02:59:59Z" }).success).toBe(false);
  });

  it("rejects a time without a time zone", () => {
    expect(ObjectInput.safeParse({ ...event, startsAt: "2026-11-12T03:00:00" }).success).toBe(
      false,
    );
  });

  it("rejects a link that is not http or https", () => {
    const properties = { ...event.properties, url: "javascript:alert(1)" };
    expect(ObjectInput.safeParse({ ...event, properties }).success).toBe(false);
  });

  it("rejects an unknown category", () => {
    const properties = { ...event.properties, category: "gossip" };
    expect(ObjectInput.safeParse({ ...event, properties }).success).toBe(false);
  });
});
