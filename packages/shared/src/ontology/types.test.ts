import { describe, expect, it } from "vitest";
import { LINK_ENDPOINTS, LINK_TYPES, LinkInput, OBJECT_TYPES, ObjectInput } from "./types.js";

const location = {
  id: "pl:teryt:1465011",
  type: "Location",
  countryCode: "PL",
  displayName: "Warszawa",
  properties: {},
};

const link = {
  id: "pl:teryt:1465011/located_in/pl:teryt:14",
  type: "located_in",
  fromObjectId: "pl:teryt:1465011",
  toObjectId: "pl:teryt:14",
  validFrom: null,
  validTo: null,
  confidence: null,
  properties: {},
};

describe("ObjectInput", () => {
  it("accepts a valid Location", () => {
    expect(ObjectInput.safeParse(location).success).toBe(true);
  });

  it("allows objects without a country", () => {
    expect(ObjectInput.safeParse({ ...location, countryCode: null }).success).toBe(true);
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
    expect(OBJECT_TYPES).toEqual(["Location"]);
  });

  it("defines endpoints for every link type", () => {
    expect(Object.keys(LINK_ENDPOINTS).sort()).toEqual([...LINK_TYPES].sort());
  });
});
