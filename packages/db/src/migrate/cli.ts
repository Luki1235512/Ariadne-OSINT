import pg from "pg";
import { z } from "zod";
import { migrate, readMigrations } from "./migrate.js";

const env = z.object({ DATABASE_URL: z.string().min(1) }).safeParse(process.env);
if (!env.success) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: env.data.DATABASE_URL });
await client.connect();
try {
  const applied = await migrate(client, await readMigrations());
  console.log(
    applied.length === 0 ? "Database is up to date." : `Applied migrations: ${applied.join(", ")}`,
  );
} finally {
  await client.end();
}
