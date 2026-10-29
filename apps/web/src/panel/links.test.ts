import type { LinkDetails, SourceSummary } from "@ariadne/shared";
import { describe, expect, it } from "vitest";
import { confidenceLabel, groupLinks } from "./links";

const source: SourceSummary = {
  id: "test:dataset:a",
  name: "Dataset A",
  publisher: "Tests",
  url: "https://example.org/a",
  license: "CC0-1.0",
  licenseUrl: null,
  retrievedAt: "2026-10-29T00:00:00.000Z",
  recordRef: "row",
};

function link(
  id: string,
  type: string,
  direction: LinkDetails["direction"],
  sources = [source],
): LinkDetails {
  return {
    id,
    type,
    direction,
    other: { id: `test:obj:${id}`, type: "Location", displayName: id },
    properties: {},
    validFrom: null,
    validTo: null,
    confidence: null,
    sources,
  };
}

describe("groupLinks", () => {
  it("groups by direction and type, with readable labels, keeping the order", () => {
    const groups = groupLinks([
      link("region", "located_in", "outgoing"),
      link("a", "located_in", "incoming"),
      link("b", "located_in", "incoming"),
    ]);

    expect(groups.map((g) => [g.label, g.links.map((l) => l.id)])).toEqual([
      ["Located in", ["region"]],
      ["Contains", ["a", "b"]],
    ]);
  });

  it("falls back to the raw type name for types without a label", () => {
    expect(groupLinks([link("x", "board_member_of", "outgoing")])[0]?.label).toBe(
      "board_member_of (outgoing)",
    );
  });

  it("lists each source of a group once", () => {
    const other = { ...source, id: "test:dataset:b", name: "Dataset B" };
    const [group] = groupLinks([
      link("a", "located_in", "incoming", [source]),
      link("b", "located_in", "incoming", [source, other]),
    ]);

    expect(group?.sources.map((s) => s.id)).toEqual(["test:dataset:a", "test:dataset:b"]);
  });
});

describe("confidenceLabel", () => {
  it("says nothing for stated links and marks inferred ones", () => {
    expect(confidenceLabel(null)).toBeUndefined();
    expect(confidenceLabel(0.834)).toBe("inferred, 83 % confidence");
  });
});
