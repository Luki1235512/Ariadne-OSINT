import { describe, expect, it } from "vitest";
import { moveActive } from "./keyboard";

describe("moveActive", () => {
  it("starts at the first option going down and at the last going up", () => {
    expect(moveActive(-1, 1, 3)).toBe(0);
    expect(moveActive(-1, -1, 3)).toBe(2);
  });

  it("moves one step and wraps around at both ends", () => {
    expect(moveActive(0, 1, 3)).toBe(1);
    expect(moveActive(2, 1, 3)).toBe(0);
    expect(moveActive(0, -1, 3)).toBe(2);
  });

  it("has no active option in an empty list", () => {
    expect(moveActive(-1, 1, 0)).toBe(-1);
    expect(moveActive(4, -1, 0)).toBe(-1);
  });
});
