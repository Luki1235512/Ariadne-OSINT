import { adminAreaTile, type Db } from "@ariadne/db";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendError } from "../http/errors.js";
import { NoQuery } from "../http/validation.js";

export const MAX_TILE_ZOOM = 14;

const TILE_CACHE_CONTROL = "public, max-age=3600";

export function adminLevelForZoom(zoom: number): number {
  if (zoom <= 6) {
    return 1;
  }
  if (zoom <= 8) {
    return 2;
  }
  return 3;
}

const tileNumber = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,4})$/)
  .transform(Number);

export const TileParams = z
  .strictObject({
    z: tileNumber.pipe(z.int().max(MAX_TILE_ZOOM)),
    x: tileNumber,
    y: tileNumber,
  })
  .refine((tile) => tile.x < 2 ** tile.z && tile.y < 2 ** tile.z, {
    message: "x and y must be less than 2^z",
  });

export function registerTileRoutes(app: FastifyInstance, db: Db): void {
  app.get("/api/tiles/admin/:z/:x/:y", async (request, reply) => {
    const params = TileParams.safeParse(request.params);
    if (!params.success || !NoQuery.safeParse(request.query).success) {
      return sendError(
        reply,
        400,
        "INVALID_REQUEST",
        `Expected /api/tiles/admin/{z}/{x}/{y} with whole numbers, z from 0 to ${String(MAX_TILE_ZOOM)}, and x and y below 2^z`,
      );
    }

    const { z: zoom, x, y } = params.data;
    const tile = await adminAreaTile(db, { z: zoom, x, y, adminLevel: adminLevelForZoom(zoom) });

    reply.header("cache-control", TILE_CACHE_CONTROL);
    if (tile.length === 0) {
      return reply.code(204).send();
    }
    return reply.type("application/vnd.mapbox-vector-tile").send(tile);
  });
}
