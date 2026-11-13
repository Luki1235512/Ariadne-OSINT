import { sql, type Kysely } from "kysely";
import type { z } from "zod";
import { PointInput } from "@ariadne/shared";
import { DbWriteError } from "../errors.js";
import type { Database } from "../schema/tables.js";
import {
  inTransaction,
  isForeignKeyViolation,
  isSuppressed,
  parse,
  type WriteResult,
} from "./common.js";

export async function upsertPoint(
  db: Kysely<Database>,
  input: z.input<typeof PointInput>,
): Promise<WriteResult> {
  const point = parse(PointInput, input, "point");
  const [longitude, latitude] = point.position;

  return inTransaction(db, async (trx) => {
    if (await isSuppressed(trx, [point.objectId])) {
      return "suppressed";
    }

    const geometries = await trx
      .selectFrom("object_geometries")
      .select("kind")
      .where("object_id", "=", point.objectId)
      .execute();
    if (geometries.some((geometry) => geometry.kind === "boundary")) {
      throw new DbWriteError(
        "INVALID_INPUT",
        `Object ${point.objectId} has a boundary; its point is derived from the boundary`,
      );
    }

    let written;
    try {
      written = await trx
        .insertInto("object_geometries")
        .values({
          object_id: point.objectId,
          kind: "point",
          geom: sql<string>`ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)`,
          source_id: point.sourceId,
        })
        .onConflict((conflict) =>
          conflict
            .columns(["object_id", "kind"])
            .doUpdateSet((eb) => ({
              geom: eb.ref("excluded.geom"),
              source_id: eb.ref("excluded.source_id"),
              updated_at: sql<string>`now()`,
            }))
            .where((eb) =>
              eb.or([
                eb(
                  sql`ST_AsEWKB(object_geometries.geom)`,
                  "is distinct from",
                  sql`ST_AsEWKB(excluded.geom)`,
                ),
                eb("object_geometries.source_id", "is distinct from", eb.ref("excluded.source_id")),
              ]),
            ),
        )
        .executeTakeFirst();
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new DbWriteError(
          "MISSING_OBJECT",
          `Point refers to a missing object ${point.objectId} or source ${point.sourceId}`,
          { cause: error },
        );
      }
      throw error;
    }

    if ((written.numInsertedOrUpdatedRows ?? 0n) === 0n) {
      return "unchanged";
    }
    return geometries.length === 0 ? "created" : "updated";
  });
}
