import { ObjectInput, SourceInput, SourceReference } from "@ariadne/shared";
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
