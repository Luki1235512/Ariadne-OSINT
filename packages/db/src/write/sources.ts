import type { Kysely } from "kysely";
import type { z } from "zod";
import { SourceInput } from "@ariadne/shared";
import type { Database } from "../schema/tables.js";
import { parse } from "./common.js";

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
