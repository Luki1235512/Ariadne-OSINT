import { sql } from "kysely";
import type { Db } from "../schema.js";

const EXTENT = 4096;
const BUFFER = 64;

export interface AdminTileRequest {
  z: number;
  x: number;
  y: number;
  adminLevel: number;
}

export async function adminAreaTile(db: Db, request: AdminTileRequest): Promise<Buffer> {
  const { z, x, y, adminLevel } = request;
  const result = await sql<{ tile: Buffer }>`
    WITH bounds AS (
      SELECT
        ST_TileEnvelope(${z}, ${x}, ${y}) AS mercator,
        ST_Transform(ST_TileEnvelope(${z}, ${x}, ${y}, margin => ${BUFFER / EXTENT}), 4326) AS wgs84
    ),
    units AS (
      SELECT o.id, o.display_name AS name, g.kind,
        ST_AsMVTGeom(ST_Transform(g.geom, 3857), bounds.mercator, ${EXTENT}, ${BUFFER}, true) AS geom
      FROM object_geometries g
      JOIN objects o ON o.id = g.object_id
      CROSS JOIN bounds
      WHERE g.geom && bounds.wgs84
        AND o.type = 'Location'
        AND o.properties->>'kind' = 'administrative_area'
        -- Compared as text: a cast to int could fail on another type's properties, because
        -- Postgres does not promise to check o.type first.
        AND o.properties->>'adminLevel' = ${String(adminLevel)}
    ),
    areas AS (SELECT id, name, geom FROM units WHERE kind = 'boundary' AND geom IS NOT NULL),
    points AS (SELECT id, name, geom FROM units WHERE kind = 'point' AND geom IS NOT NULL)
    SELECT
      coalesce((SELECT ST_AsMVT(areas, 'areas', ${EXTENT}, 'geom') FROM areas), '')
      || coalesce((SELECT ST_AsMVT(points, 'points', ${EXTENT}, 'geom') FROM points), '')
      AS tile
  `.execute(db);
  return result.rows[0]?.tile ?? Buffer.alloc(0);
}
