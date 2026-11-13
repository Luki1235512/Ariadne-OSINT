import type { Kysely } from "kysely";
import type { Database } from "../schema/tables.js";

export async function deleteEventsEndedBefore(db: Kysely<Database>, cutoff: Date): Promise<number> {
  const result = await db
    .deleteFrom("objects")
    .where("type", "=", "Event")
    .where("id", "in", (eb) =>
      eb
        .selectFrom("object_times")
        .select("object_id")
        .where((inner) => inner(inner.fn.coalesce("ends_at", "starts_at"), "<", cutoff)),
    )
    .executeTakeFirst();
  return Number(result.numDeletedRows);
}
