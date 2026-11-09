import { describe, expect, it } from "vitest";
import { areasInView, sameAreas } from "./inView";

function feature(id: string | number | undefined, name: unknown) {
  return { id, properties: { id, name } };
}

describe("areasInView", () => {
  it("lists each area once, sorted by name with accented letters in place", () => {
    const areas = areasInView([
      feature("pl:teryt:1061", "Zgierz"),
      feature("pl:teryt:10", "łódzkie"),
      feature("pl:teryt:1061", "Zgierz"),
      feature("pl:teryt:12", "Kraków"),
    ]);

    expect(areas.map((area) => area.name)).toEqual(["Kraków", "łódzkie", "Zgierz"]);
  });

  it("skips features without a text id or a name", () => {
    expect(areasInView([feature(7, "A"), feature(undefined, "B"), feature("x:1", null)])).toEqual(
      [],
    );
  });

  it("orders areas with the same name by id, so the order is stable", () => {
    const areas = areasInView([feature("x:2", "Nowa Wieś"), feature("x:1", "Nowa Wieś")]);
    expect(areas.map((area) => area.id)).toEqual(["x:1", "x:2"]);
  });
});

describe("sameAreas", () => {
  it("compares ids in order", () => {
    const a = [{ id: "x:1", name: "A" }];
    expect(sameAreas(a, [{ id: "x:1", name: "A" }])).toBe(true);
    expect(sameAreas(a, [{ id: "x:2", name: "A" }])).toBe(false);
    expect(sameAreas(a, [])).toBe(false);
  });
});
