import { describe, expect, it } from "vitest";
import { AreaGeometry } from "./geometry.js";

const square = [
  [21, 52],
  [21.1, 52],
  [21.1, 52.1],
  [21, 52.1],
  [21, 52],
];

describe("AreaGeometry", () => {
  it("accepts a Polygon", () => {
    expect(AreaGeometry.safeParse({ type: "Polygon", coordinates: [square] }).success).toBe(true);
  });

  it("accepts a MultiPolygon", () => {
    const geometry = { type: "MultiPolygon", coordinates: [[square], [square]] };
    expect(AreaGeometry.safeParse(geometry).success).toBe(true);
  });

  it("rejects an outline that is not closed", () => {
    const open = [...square.slice(0, 4), [21.05, 52]];
    expect(AreaGeometry.safeParse({ type: "Polygon", coordinates: [open] }).success).toBe(false);
  });

  it("rejects an outline with fewer than four positions", () => {
    const triangle = [
      [21, 52],
      [21.1, 52],
      [21, 52],
    ];
    expect(AreaGeometry.safeParse({ type: "Polygon", coordinates: [triangle] }).success).toBe(
      false,
    );
  });

  it("rejects a latitude outside -90 to 90", () => {
    const wrong = square.map(([lon, lat]) => [lon, (lat ?? 0) + 40]);
    expect(AreaGeometry.safeParse({ type: "Polygon", coordinates: [wrong] }).success).toBe(false);
  });

  it("rejects three-dimensional positions", () => {
    const withHeight = square.map(([lon, lat]) => [lon, lat, 100]);
    expect(AreaGeometry.safeParse({ type: "Polygon", coordinates: [withHeight] }).success).toBe(
      false,
    );
  });

  it("rejects other geometry types", () => {
    expect(AreaGeometry.safeParse({ type: "Point", coordinates: [21, 52] }).success).toBe(false);
  });
});
