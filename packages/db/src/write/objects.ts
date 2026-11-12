import type { Kysely } from "kysely";
import type { z } from "zod";
import { ObjectInput, type SourceReference } from "@ariadne/shared";
import { DbWriteError } from "../errors.js";
import type { Database } from "../schema/tables.js";
import {
  inTransaction,
  isSuppressed,
  parse,
  parseSources,
  writeSourceReferences,
  type WriteResult,
} from "./common.js";

export async function upsertObject(
  db: Kysely<Database>,
  input: z.input<typeof ObjectInput>,
  sourceInput: z.input<typeof SourceReference>[],
): Promise<WriteResult> {
  const object = parse(ObjectInput, input, "object");
  const sources = parseSources(sourceInput);

  return inTransaction(db, async (trx) => {
    if (await isSuppressed(trx, [object.id])) {
      return "suppressed";
    }

    const values = {
      country_code: object.countryCode,
      display_name: object.displayName,
      properties: JSON.stringify(object.properties),
    };
    const existing = await trx
      .selectFrom("objects")
      .select("type")
      .where("id", "=", object.id)
      .forUpdate()
      .executeTakeFirst();

    let result: WriteResult;
    if (existing === undefined) {
      await trx
        .insertInto("objects")
        .values({ id: object.id, type: object.type, ...values })
        .execute();
      result = "created";
    } else if (existing.type !== object.type) {
      throw new DbWriteError(
        "OBJECT_TYPE_MISMATCH",
        `Object ${object.id} has type ${existing.type}; it cannot become ${object.type}`,
      );
    } else {
      const update = await trx
        .updateTable("objects")
        .set({ ...values, updated_at: new Date().toISOString() })
        .where("id", "=", object.id)
        .where((eb) =>
          eb.or([
            eb("country_code", "is distinct from", values.country_code),
            eb("display_name", "is distinct from", values.display_name),
            eb(
              "properties",
              "is distinct from",
              eb.cast<Record<string, unknown>>(eb.val(values.properties), "jsonb"),
            ),
          ]),
        )
        .executeTakeFirst();
      result = update.numUpdatedRows > 0n ? "updated" : "unchanged";
    }

    await writeSourceReferences(trx, "object_sources", object.id, sources);
    return result;
  });
}

export async function removeObject(
  db: Kysely<Database>,
  objectId: string,
  reason: string,
): Promise<boolean> {
  if (reason.trim() === "") {
    throw new DbWriteError("INVALID_INPUT", "A reason is required to remove an object");
  }
  return inTransaction(db, async (trx) => {
    const deleted = await trx.deleteFrom("objects").where("id", "=", objectId).executeTakeFirst();
    await trx
      .insertInto("suppressions")
      .values({ object_id: objectId, reason })
      .onConflict((conflict) => conflict.column("object_id").doNothing())
      .execute();
    return deleted.numDeletedRows > 0n;
  });
}
