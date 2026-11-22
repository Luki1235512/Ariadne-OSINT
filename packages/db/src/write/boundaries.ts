import { sql, type Kysely } from "kysely";
import type { z } from "zod";
import { BoundaryInput } from "@ariadne/shared";
import { DbWriteError } from "../errors.js";
import type { Database } from "../schema/tables.js";
import {
  inTransaction,
  isForeignKeyViolation,
  isSuppressed,
  parse,
  type WriteResult,
} from "./common.js";

export async function upsertBoundary(
  db: Kysely<Database>,
  input: z.input<typeof BoundaryInput>,
): Promise<WriteResult> {
  const boundary = parse(BoundaryInput, input, "boundary");

  return inTransaction(db, async (trx) => {
    if (await isSuppressed(trx, [boundary.objectId])) {
      return "suppressed";
    }

    const object = await trx
      .selectFrom("objects")
      .select("id")
      .where("id", "=", boundary.objectId)
      .executeTakeFirst();
    if (object === undefined) {
      throw new DbWriteError(
        "MISSING_OBJECT",
        `Boundary refers to missing object ${boundary.objectId}`,
      );
    }

    const existing = await trx
      .selectFrom("object_geometries")
      .select("kind")
      .where("object_id", "=", boundary.objectId)
      .where("kind", "=", "boundary")
      .executeTakeFirst();

    let result;
    try {
      result = await sql<{ empty: boolean; written: number }>`
        WITH shape AS (
          SELECT ST_Multi(ST_CollectionExtract(ST_MakeValid(
            ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(boundary.geometry)}), 4326)
          ), 3)) AS geom
        ),
        written AS (
          INSERT INTO object_geometries (object_id, kind, geom, source_id)
          SELECT ${boundary.objectId}, row.kind, row.geom, ${boundary.sourceId}
          FROM shape,
            LATERAL (VALUES ('boundary', shape.geom), ('point', ST_PointOnSurface(shape.geom)))
              AS row (kind, geom)
          WHERE NOT ST_IsEmpty(shape.geom)
          ON CONFLICT (object_id, kind) DO UPDATE
            SET geom = EXCLUDED.geom, source_id = EXCLUDED.source_id, updated_at = now()
            WHERE ST_AsEWKB(object_geometries.geom) IS DISTINCT FROM ST_AsEWKB(EXCLUDED.geom)
              OR object_geometries.source_id IS DISTINCT FROM EXCLUDED.source_id
          RETURNING kind
        )
        SELECT
          (SELECT ST_IsEmpty(geom) FROM shape) AS empty,
          (SELECT count(*)::int FROM written) AS written
      `.execute(trx);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new DbWriteError(
          "UNKNOWN_SOURCE",
          `Unknown source ${boundary.sourceId}. Write the source first.`,
          { cause: error },
        );
      }
      throw error;
    }

    const row = result.rows[0];
    if (row === undefined || row.empty) {
      throw new DbWriteError(
        "INVALID_INPUT",
        `Boundary of ${boundary.objectId} has no area after repairing it`,
      );
    }
    if (row.written === 0) {
      return "unchanged";
    }
    return existing === undefined ? "created" : "updated";
  });
}
