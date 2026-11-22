import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import { z } from "zod";
import type { Database } from "./schema/tables.js";

export interface ConnectionOptions {
  connectionString: string;
  statementTimeoutMs?: number;
  maxConnections?: number;
  caCert?: string;
}

export const CaCertSchema = z
  .string()
  .trim()
  .startsWith("-----BEGIN CERTIFICATE-----", "DATABASE_CA_CERT must be a PEM certificate");

export function tlsOptions(caCert: string | undefined): pg.ClientConfig["ssl"] {
  return caCert === undefined ? undefined : { ca: caCert, rejectUnauthorized: true };
}

const getTypeParser: pg.CustomTypesConfig["getTypeParser"] = (oid, format) =>
  oid === pg.types.builtins.DATE
    ? (value: string) => value
    : (pg.types.getTypeParser(oid, format) as unknown);

const types: pg.CustomTypesConfig = { getTypeParser };

export function createPool(options: ConnectionOptions): pg.Pool {
  const ssl = tlsOptions(options.caCert);
  return new pg.Pool({
    connectionString: options.connectionString,
    statement_timeout: options.statementTimeoutMs ?? 10_000,
    max: options.maxConnections ?? 10,
    types,
    ...(ssl === undefined ? {} : { ssl }),
  });
}

export function createDb(options: ConnectionOptions): Kysely<Database> {
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool: createPool(options) }) });
}
