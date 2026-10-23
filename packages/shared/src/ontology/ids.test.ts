import { describe, expect, it } from "vitest";
import { CountryCode, NamespacedId } from "./ids.js";

describe("NamespacedId", () => {
  it.each([
    "pl:teryt:1465011",
    "wikidata:Q36",
    "pl:krs:0000123456",
    "opensanctions:NK-abc.123",
    "pl:teryt:1465011/located_in/pl:teryt:14",
  ])("accepts %s", (id) => {
    expect(NamespacedId.safeParse(id).success).toBe(true);
  });

  it.each([
    ["no namespace", "1465011"],
    ["uppercase namespace", "PL:teryt:1"],
    ["empty identifier", "pl:teryt:"],
    ["empty segment", "pl::1465011"],
    ["spaces", "pl:teryt:14 65"],
    ["too long", `pl:x:${"a".repeat(200)}`],
  ])("rejects %s", (_reason, id) => {
    expect(NamespacedId.safeParse(id).success).toBe(false);
  });
});

describe("CountryCode", () => {
  it("accepts ISO 3166-1 alpha-2 codes", () => {
    expect(CountryCode.safeParse("PL").success).toBe(true);
  });

  it.each(["pl", "POL", "P"])("rejects %s", (code) => {
    expect(CountryCode.safeParse(code).success).toBe(false);
  });
});
