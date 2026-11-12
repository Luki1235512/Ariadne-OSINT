import type { Kysely, Transaction } from "kysely";
import { z } from "zod";
import { SourceReference } from "@ariadne/shared";
import { DbWriteError } from "../errors.js";
import type { Database } from "../schema/tables.js";

export type WriteResult = "created" | "updated" | "unchanged" | "suppressed";

const SourceReferences = z.array(SourceReference).min(1);

export function parse<T>(schema: z.ZodType<T>, input: unknown, what: string): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new DbWriteError("INVALID_INPUT", `Invalid ${what}:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export function parseSources(input: unknown): SourceReference[] {
  if (Array.isArray(input) && input.length === 0) {
    throw new DbWriteError("NO_SOURCES", "Every object and link needs at least one source");
  }
  return parse(SourceReferences, input, "source references");
}

export async function inTransaction<T>(
  db: Kysely<Database>,
  fn: (trx: Transaction<Database> | Kysely<Database>) => Promise<T>,
): Promise<T> {
  return db.isTransaction ? fn(db) : db.transaction().execute(fn);
}

export function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23503";
}

export async function isSuppressed(db: Kysely<Database>, objectIds: string[]): Promise<boolean> {
  const row = await db
    .selectFrom("suppressions")
    .select("object_id")
    .where("object_id", "in", objectIds)
    .executeTakeFirst();
  return row !== undefined;
}

export async function writeSourceReferences(
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
