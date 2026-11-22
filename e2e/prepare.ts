import { createDb } from "@ariadne/db";
import { createDatabaseIfMissing, migrateDatabase, resetData } from "@ariadne/db/test-support";
import { e2eDatabaseUrl } from "./env.js";
import { seed } from "./seed.js";

async function prepare(): Promise<void> {
  const url = e2eDatabaseUrl();
  await createDatabaseIfMissing(url);
  await migrateDatabase(url);
  const db = createDb({ connectionString: url, maxConnections: 2 });
  try {
    await resetData(db);
    await seed(db);
  } finally {
    await db.destroy();
  }
}

await prepare();
console.log("e2e database ready");
