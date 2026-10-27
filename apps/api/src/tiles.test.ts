import { createDb } from "@ariadne/db";
import { afterAll, describe, expect, it } from "vitest";
import { buildServer } from "./server.js";
import { adminLevelForZoom, TileParams } from "./tiles.js";

describe("adminLevelForZoom", () => {
  it("shows voivodeships up to zoom 6, counties at 7 and 8, municipalities from 9", () => {
    const levels = Array.from({ length: 15 }, (_, zoom) => adminLevelForZoom(zoom));
    expect(levels).toEqual([1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 3, 3, 3, 3, 3]);
  });
});

describe("TileParams", () => {
  it("accepts valid tile coordinates", () => {
    expect(TileParams.parse({ z: "0", x: "0", y: "0" })).toEqual({ z: 0, x: 0, y: 0 });
    expect(TileParams.parse({ z: "14", x: "16383", y: "16383" })).toEqual({
      z: 14,
      x: 16383,
      y: 16383,
    });
  });

  it.each([
    ["x outside the zoom level", { z: "2", x: "4", y: "0" }],
    ["y outside the zoom level", { z: "2", x: "0", y: "4" }],
    ["zoom above the maximum", { z: "15", x: "0", y: "0" }],
    ["a negative number", { z: "3", x: "-1", y: "0" }],
    ["a decimal", { z: "3", x: "1.5", y: "0" }],
    ["an exponent", { z: "1e1", x: "0", y: "0" }],
    ["a leading zero", { z: "03", x: "0", y: "0" }],
    ["an empty value", { z: "", x: "0", y: "0" }],
    ["text", { z: "3", x: "abc", y: "0" }],
    ["an extra field", { z: "3", x: "0", y: "0", format: "png" }],
  ])("rejects %s", (_name, params) => {
    expect(TileParams.safeParse(params).success).toBe(false);
  });
});

describe("GET /api/tiles/admin/{z}/{x}/{y}, invalid requests", () => {
  const db = createDb({ connectionString: "postgres://unused@127.0.0.1:1/unused" });
  const app = buildServer({ config: { LOG_LEVEL: "silent" }, db });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it.each(["/api/tiles/admin/2/4/0", "/api/tiles/admin/99/0/0", "/api/tiles/admin/1/0/0?x=1"])(
    "returns 400 with an error code for %s",
    async (url) => {
      const response = await app.inject({ method: "GET", url });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: { code: "INVALID_REQUEST" } });
    },
  );
});
