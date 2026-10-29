import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import type pg from "pg";

export interface Migration {
  version: string;
  name: string;
  sql: string;
  checksum: string;
}

const FILE_PATTERN = /^(\d{4})_([a-z0-9_]+)\.sql$/;

const MIGRATION_LOCK_KEY = 4_271_993_001;

export const DEFAULT_MIGRATIONS_DIR = new URL("../../migrations/", import.meta.url);

export async function readMigrations(dir: URL = DEFAULT_MIGRATIONS_DIR): Promise<Migration[]> {
  const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
  const migrations: Migration[] = [];

  for (const file of files) {
    const match = FILE_PATTERN.exec(file);
    if (match?.[1] === undefined || match[2] === undefined) {
      throw new Error(`Migration file name must look like 0001_description.sql: ${file}`);
    }
    const sql = (await readFile(new URL(file, dir), "utf8")).replaceAll("\r\n", "\n");
    migrations.push({
      version: match[1],
      name: match[2],
      sql,
      checksum: createHash("sha256").update(sql).digest("hex"),
    });
  }

  const versions = migrations.map((migration) => migration.version);
  const duplicate = versions.find((version, index) => versions.indexOf(version) !== index);
  if (duplicate !== undefined) {
    throw new Error(`Two migration files have the number ${duplicate}`);
  }

  return migrations;
}

interface AppliedRow {
  version: string;
  checksum: string;
}

export async function migrate(client: pg.ClientBase, migrations: Migration[]): Promise<string[]> {
  await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        name text NOT NULL,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const { rows: applied } = await client.query<AppliedRow>(
      "SELECT version, checksum FROM schema_migrations ORDER BY version",
    );
    const byVersion = new Map(migrations.map((migration) => [migration.version, migration]));

    for (const row of applied) {
      const file = byVersion.get(row.version);
      if (file === undefined) {
        throw new Error(`Migration ${row.version} was applied but its file is missing`);
      }
      if (file.checksum !== row.checksum) {
        throw new Error(
          `Migration ${row.version}_${file.name}.sql was edited after it was applied. ` +
            "Applied migrations must not change; add a new migration instead.",
        );
      }
    }

    const appliedVersions = new Set(applied.map((row) => row.version));
    const latestApplied = applied.at(-1)?.version;
    const pending = migrations.filter((migration) => !appliedVersions.has(migration.version));

    for (const migration of pending) {
      if (latestApplied !== undefined && migration.version < latestApplied) {
        throw new Error(
          `Migration ${migration.version}_${migration.name}.sql is numbered before ` +
            `${latestApplied}, which is already applied. Renumber it after ${latestApplied}.`,
        );
      }
    }

    for (const migration of pending) {
      try {
        await client.query("BEGIN");
        await client.query(migration.sql);
        await client.query(
          "INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)",
          [migration.version, migration.name, migration.checksum],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${migration.version}_${migration.name}.sql failed`, {
          cause: error,
        });
      }
    }

    return pending.map((migration) => migration.version);
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]);
  }
}
