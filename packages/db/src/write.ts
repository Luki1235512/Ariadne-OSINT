import {
  LINK_ENDPOINTS,
  LinkInput,
  ObjectInput,
  SourceInput,
  SourceReference,
} from "@ariadne/shared";
import type { ObjectType } from "@ariadne/shared";
import type { Kysely, Transaction } from "kysely";
import { z } from "zod";
import { DbWriteError } from "./errors.js";
import type { Database } from "./schema.js";

export type WriteResult = "created" | "updated" | "unchanged" | "suppressed";

const SourceReferences = z.array(SourceReference).min(1);

function parse<T>(schema: z.ZodType<T>, input: unknown, what: string): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new DbWriteError("INVALID_INPUT", `Invalid ${what}:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

function parseSources(input: unknown): SourceReference[] {
  if (Array.isArray(input) && input.length === 0) {
    throw new DbWriteError("NO_SOURCES", "Every object and link needs at least one source");
  }
  return parse(SourceReferences, input, "source references");
}

async function inTransaction<T>(
  db: Kysely<Database>,
  fn: (trx: Transaction<Database> | Kysely<Database>) => Promise<T>,
): Promise<T> {
  return db.isTransaction ? fn(db) : db.transaction().execute(fn);
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23503";
}

export async function upsertSource(
  db: Kysely<Database>,
  input: z.input<typeof SourceInput>,
): Promise<void> {
  const source = parse(SourceInput, input, "source");
  const row = {
    name: source.name,
    publisher: source.publisher,
    url: source.url,
    license: source.license,
    license_url: source.licenseUrl,
    retrieved_at: source.retrievedAt,
  };
  await db
    .insertInto("sources")
    .values({ id: source.id, ...row })
    .onConflict((conflict) => conflict.column("id").doUpdateSet(row))
    .execute();
}

async function isSuppressed(db: Kysely<Database>, objectIds: string[]): Promise<boolean> {
  const row = await db
    .selectFrom("suppressions")
    .select("object_id")
    .where("object_id", "in", objectIds)
    .executeTakeFirst();
  return row !== undefined;
}

async function writeSourceReferences(
  db: Kysely<Database>,
  table: "object_sources" | "link_sources",
  recordId: string,
  sources: SourceReference[],
): Promise<void> {
  try {
    for (const source of sources) {
      if (table === "object_sources") {
        await db
          .insertInto("object_sources")
          .values({ object_id: recordId, source_id: source.sourceId, record_ref: source.recordRef })
          .onConflict((conflict) =>
            conflict
              .columns(["object_id", "source_id"])
              .doUpdateSet({ record_ref: source.recordRef }),
          )
          .execute();
      } else {
        await db
          .insertInto("link_sources")
          .values({ link_id: recordId, source_id: source.sourceId, record_ref: source.recordRef })
          .onConflict((conflict) =>
            conflict
              .columns(["link_id", "source_id"])
              .doUpdateSet({ record_ref: source.recordRef }),
          )
          .execute();
      }
    }
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      const ids = sources.map((source) => source.sourceId).join(", ");
      throw new DbWriteError(
        "UNKNOWN_SOURCE",
        `Unknown source in: ${ids}. Write the source first.`,
        {
          cause: error,
        },
      );
    }
    throw error;
  }
}

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
