import { describe, expect, it } from "vitest";
import { flattenProperties, formatDate, safeUrl } from "./format";

describe("flattenProperties", () => {
  it("flattens nested objects into dotted names", () => {
    expect(
      flattenProperties({
        kind: "administrative_area",
        adminLevel: 2,
        areaKm2: 517.2,
        countryData: { pl: { teryt: "1465", regon: null } },
      }),
    ).toEqual([
      ["kind", "administrative_area"],
      ["adminLevel", "2"],
      ["areaKm2", "517.2"],
      ["countryData.pl.teryt", "1465"],
      ["countryData.pl.regon", "-"],
    ]);
  });

  it("shows empty values, lists and empty objects readably", () => {
    expect(flattenProperties({ a: "", b: [], c: ["x", 1], d: {}, e: true })).toEqual([
      ["a", "-"],
      ["b", "-"],
      ["c", "x, 1"],
      ["d", "-"],
      ["e", "true"],
    ]);
  });
});

describe("safeUrl", () => {
  it("keeps http and https links", () => {
    expect(safeUrl("https://example.org/a?b=1")).toBe("https://example.org/a?b=1");
    expect(safeUrl("http://example.org/")).toBe("http://example.org/");
  });

  it("drops other schemes and invalid URLs", () => {
    expect(safeUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeUrl("data:text/html,<b>x</b>")).toBeUndefined();
    expect(safeUrl("not a url")).toBeUndefined();
    expect(safeUrl(null)).toBeUndefined();
  });
});

describe("formatDate", () => {
  it("formats a timestamp as a readable date", () => {
    expect(formatDate("2026-10-25T12:00:00.000Z")).toBe("25 Oct 2026");
  });

  it("returns the input when it is not a date", () => {
    expect(formatDate("soon")).toBe("soon");
  });
});
