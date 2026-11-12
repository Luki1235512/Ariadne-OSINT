import type { Kysely } from "kysely";
import type { z } from "zod";
import { LINK_ENDPOINTS, LinkInput, type ObjectType, type SourceReference } from "@ariadne/shared";
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

export async function upsertLink(
  db: Kysely<Database>,
  input: z.input<typeof LinkInput>,
  sourceInput: z.input<typeof SourceReference>[],
): Promise<WriteResult> {
  const link = parse(LinkInput, input, "link");
  const sources = parseSources(sourceInput);

  return inTransaction(db, async (trx) => {
    const endpointIds = [link.fromObjectId, link.toObjectId];
    if (await isSuppressed(trx, endpointIds)) {
      return "suppressed";
    }

    const endpoints = await trx
      .selectFrom("objects")
      .select(["id", "type"])
      .where("id", "in", endpointIds)
      .execute();
    const typeOf = (id: string): string | undefined =>
      endpoints.find((endpoint) => endpoint.id === id)?.type;

    for (const id of endpointIds) {
      if (typeOf(id) === undefined) {
        throw new DbWriteError("MISSING_OBJECT", `Link ${link.id} refers to missing object ${id}`);
      }
    }

    const allowed = LINK_ENDPOINTS[link.type];
    const fromType = typeOf(link.fromObjectId) as ObjectType;
    const toType = typeOf(link.toObjectId) as ObjectType;
    if (!allowed.from.includes(fromType) || !allowed.to.includes(toType)) {
      throw new DbWriteError(
        "LINK_ENDPOINT_NOT_ALLOWED",
        `A ${link.type} link cannot connect ${fromType} to ${toType}`,
      );
    }

    const values = {
      from_object_id: link.fromObjectId,
      to_object_id: link.toObjectId,
      properties: JSON.stringify(link.properties),
      valid_from: link.validFrom,
      valid_to: link.validTo,
      confidence: link.confidence,
    };
    const existing = await trx
      .selectFrom("links")
      .select("type")
      .where("id", "=", link.id)
      .forUpdate()
      .executeTakeFirst();

    let result: WriteResult;
    if (existing === undefined) {
      await trx
        .insertInto("links")
        .values({ id: link.id, type: link.type, ...values })
        .execute();
      result = "created";
    } else if (existing.type !== link.type) {
      throw new DbWriteError(
        "LINK_TYPE_MISMATCH",
        `Link ${link.id} has type ${existing.type}; it cannot become ${link.type}`,
      );
    } else {
      const update = await trx
        .updateTable("links")
        .set({ ...values, updated_at: new Date().toISOString() })
        .where("id", "=", link.id)
        .where((eb) =>
          eb.or([
            eb("from_object_id", "is distinct from", values.from_object_id),
            eb("to_object_id", "is distinct from", values.to_object_id),
            eb(
              "properties",
              "is distinct from",
              eb.cast<Record<string, unknown>>(eb.val(values.properties), "jsonb"),
            ),
            eb(
              "valid_from",
              "is distinct from",
              eb.cast<string | null>(eb.val(values.valid_from), "date"),
            ),
            eb(
              "valid_to",
              "is distinct from",
              eb.cast<string | null>(eb.val(values.valid_to), "date"),
            ),
            eb("confidence", "is distinct from", values.confidence),
          ]),
        )
        .executeTakeFirst();
      result = update.numUpdatedRows > 0n ? "updated" : "unchanged";
    }

    await writeSourceReferences(trx, "link_sources", link.id, sources);
    return result;
  });
}
