import { sql } from "kysely";
import type { Db } from "./schema.js";

export async function ping(db: Db): Promise<void> {
  await sql`SELECT 1`.execute(db);
}
