import { createDatabaseIfMissing, migrateDatabase, testDatabaseUrl } from "./index.js";

export default async function setup(): Promise<void> {
  const url = testDatabaseUrl();
  await createDatabaseIfMissing(url);
  await migrateDatabase(url);
}
