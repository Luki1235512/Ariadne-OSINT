import pg from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Migration, migrate } from "./migrate.js";
import { createDatabaseIfMissing, dropDatabase, testDatabaseUrl } from "../test-support/index.js";

function scratchUrl(): string {
  const url = new URL(testDatabaseUrl());
  url.pathname = `${url.pathname}_migrations_test`;
  return url.toString();
}

function migration(version: string, sql: string): Migration {
  return { version, name: `m${version}`, sql, checksum: `checksum-of-${sql}` };
}

let client: pg.Client;

beforeEach(async () => {
  await dropDatabase(scratchUrl());
  await createDatabaseIfMissing(scratchUrl());
  client = new pg.Client({ connectionString: scratchUrl() });
  await client.connect();
});

afterEach(async () => {
  await client.end();
  await dropDatabase(scratchUrl());
});

async function tableExists(name: string): Promise<boolean> {
  const { rows } = await client.query<{ exists: boolean }>(
    "SELECT to_regclass($1) IS NOT NULL AS exists",
    [name],
  );
  return rows[0]?.exists ?? false;
}

describe("migrate", () => {
  const first = migration("0001", "CREATE TABLE a (id int);");
  const second = migration("0002", "CREATE TABLE b (id int);");

  it("applies pending migrations in order and records them", async () => {
    expect(await migrate(client, [first, second])).toEqual(["0001", "0002"]);
    expect(await tableExists("a")).toBe(true);
    expect(await tableExists("b")).toBe(true);
  });

  it("does nothing when everything is applied", async () => {
    await migrate(client, [first, second]);
    expect(await migrate(client, [first, second])).toEqual([]);
  });

  it("applies only the new migration on a later run", async () => {
    await migrate(client, [first]);
    expect(await migrate(client, [first, second])).toEqual(["0002"]);
  });

  it("refuses to run when an applied migration was edited", async () => {
    await migrate(client, [first]);
    const edited = { ...first, checksum: "different" };
    await expect(migrate(client, [edited, second])).rejects.toThrow(/edited after it was applied/);
    expect(await tableExists("b")).toBe(false);
  });

  it("refuses to run when an applied migration's file is missing", async () => {
    await migrate(client, [first, second]);
    await expect(migrate(client, [second])).rejects.toThrow(/file is missing/);
  });

  it("refuses a new migration numbered before an applied one", async () => {
    await migrate(client, [first, migration("0003", "CREATE TABLE c (id int);")]);
    await expect(
      migrate(client, [first, second, migration("0003", "CREATE TABLE c (id int);")]),
    ).rejects.toThrow(/numbered before 0003/);
  });

  it("rolls back a failing migration completely", async () => {
    const broken = migration("0002", "CREATE TABLE b (id int); SELECT * FROM no_such_table;");
    await expect(migrate(client, [first, broken])).rejects.toThrow(/0002_m0002\.sql failed/);
    expect(await tableExists("b")).toBe(false);
    const { rows } = await client.query("SELECT version FROM schema_migrations");
    expect(rows).toEqual([{ version: "0001" }]);
  });

  it("applies each migration once when two processes run at the same time", async () => {
    const other = new pg.Client({ connectionString: scratchUrl() });
    await other.connect();
    try {
      const results = await Promise.all([
        migrate(client, [first, second]),
        migrate(other, [first, second]),
      ]);
      expect(results.flat().sort()).toEqual(["0001", "0002"]);
    } finally {
      await other.end();
    }
  });
});
