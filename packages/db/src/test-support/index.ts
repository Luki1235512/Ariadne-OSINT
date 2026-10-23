import type { Kysely } from "kysely";
import { sql } from "kysely";
import pg from "pg";
import { createDb } from "../connection.js";
import { migrate, readMigrations } from "../migrate.js";
import type { Database } from "../schema.js";

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (url === undefined || url === "") {
    throw new Error(
      "TEST_DATABASE_URL is not set. Copy .env.example to .env, fill it in, " +
        "and start the database with: docker compose up -d db",
    );
  }
  const name = databaseName(url);
  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to use database "${name}" for tests: its name must end in "_test"`);
  }
  return url;
}

function databaseName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.slice(1));
}

function maintenanceUrl(url: string): string {
  const parsed = new URL(url);
  parsed.pathname = "/postgres";
  return parsed.toString();
}

export async function createDatabaseIfMissing(url: string): Promise<void> {
  const name = databaseName(url);
  const client = new pg.Client({ connectionString: maintenanceUrl(url) });
  await client.connect();
  try {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (rowCount === 0) {
      await client.query(`CREATE DATABASE ${client.escapeIdentifier(name)}`);
    }
  } finally {
    await client.end();
  }
}

export async function dropDatabase(url: string): Promise<void> {
  const name = databaseName(url);
  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to drop database "${name}": its name must end in "_test"`);
  }
  const client = new pg.Client({ connectionString: maintenanceUrl(url) });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS ${client.escapeIdentifier(name)} WITH (FORCE)`);
  } finally {
    await client.end();
  }
}

export async function migrateDatabase(url: string): Promise<void> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await migrate(client, await readMigrations());
  } finally {
    await client.end();
  }
}

export function createTestDb(): Kysely<Database> {
  return createDb({ connectionString: testDatabaseUrl(), maxConnections: 2 });
}

export async function resetData(db: Kysely<Database>): Promise<void> {
  await sql`
    TRUNCATE objects, links, sources, object_sources, link_sources, suppressions
  `.execute(db);
}
