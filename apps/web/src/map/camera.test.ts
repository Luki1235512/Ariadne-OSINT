import { describe, expect, it } from "vitest";
import { focusZoom, zoomRangeForLevel } from "./camera";

describe("focusZoom", () => {
  it("keeps a fitting zoom that is inside the level's range", () => {
    expect(focusZoom(5.2, 1)).toBe(5.2);
    expect(focusZoom(8, 2)).toBe(8);
    expect(focusZoom(11, 3)).toBe(11);
  });

  it("moves the zoom into the range where the level is drawn", () => {
    expect(focusZoom(8, 3)).toBe(9);
    expect(focusZoom(10, 2)).toBe(8.9);
    expect(focusZoom(7.5, 1)).toBe(6.9);
  });

  it("only caps the zoom for objects without a level", () => {
    expect(focusZoom(3, null)).toBe(3);
    expect(focusZoom(18, null)).toBe(14);
  });
});

describe("zoomRangeForLevel", () => {
  it("matches the API's rule: level 1 to zoom 6, level 2 at 7 and 8, level 3 from 9", () => {
    expect(zoomRangeForLevel(1)).toEqual([0, 6.9]);
    expect(zoomRangeForLevel(2)).toEqual([7, 8.9]);
    expect(zoomRangeForLevel(3)).toEqual([9, 14]);
  });
});
