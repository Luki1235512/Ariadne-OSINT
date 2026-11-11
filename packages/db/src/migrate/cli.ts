import pg from "pg";
import { z } from "zod";
import { CaCertSchema, tlsOptions } from "../connection.js";
import { migrate, readMigrations } from "./migrate.js";

const env = z
  .object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is not set. Copy .env.example to .env."),
    DATABASE_CA_CERT: CaCertSchema.optional(),
  })
  .safeParse(process.env);
if (!env.success) {
  console.error(z.prettifyError(env.error));
  process.exit(1);
}

const ssl = tlsOptions(env.data.DATABASE_CA_CERT);
const client = new pg.Client({
  connectionString: env.data.DATABASE_URL,
  ...(ssl === undefined ? {} : { ssl }),
});
await client.connect();
try {
  const applied = await migrate(client, await readMigrations());
  console.log(
    applied.length === 0 ? "Database is up to date." : `Applied migrations: ${applied.join(", ")}`,
  );
} finally {
  await client.end();
}
