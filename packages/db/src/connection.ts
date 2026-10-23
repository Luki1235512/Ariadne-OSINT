import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import type { Database } from "./schema.js";

export interface ConnectionOptions {
  connectionString: string;
  statementTimeoutMs?: number;
  maxConnections?: number;
}

const getTypeParser: pg.CustomTypesConfig["getTypeParser"] = (oid, format) =>
  oid === pg.types.builtins.DATE
    ? (value: string) => value
    : (pg.types.getTypeParser(oid, format) as unknown);

const types: pg.CustomTypesConfig = { getTypeParser };

export function createPool(options: ConnectionOptions): pg.Pool {
  return new pg.Pool({
    connectionString: options.connectionString,
    statement_timeout: options.statementTimeoutMs ?? 10_000,
    max: options.maxConnections ?? 10,
    types,
  });
}

export function createDb(options: ConnectionOptions): Kysely<Database> {
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool: createPool(options) }) });
}
