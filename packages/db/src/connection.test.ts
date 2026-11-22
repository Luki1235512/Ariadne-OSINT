import { describe, expect, it } from "vitest";
import { CaCertSchema, createPool } from "./connection.js";

const url = "postgres://user@127.0.0.1:5432/db";
const cert = "-----BEGIN CERTIFICATE-----\nMIIBfake\n-----END CERTIFICATE-----";

describe("createPool", () => {
  it("connects without TLS when no certificate is given", async () => {
    const pool = createPool({ connectionString: url });
    expect(pool.options.ssl).toBeUndefined();
    await pool.end();
  });

  it("checks the server certificate when a certificate is given", async () => {
    const pool = createPool({ connectionString: url, caCert: cert });
    expect(pool.options.ssl).toEqual({ ca: cert, rejectUnauthorized: true });
    await pool.end();
  });
});

describe("CaCertSchema", () => {
  it("accepts a PEM certificate, ignoring surrounding whitespace", () => {
    expect(CaCertSchema.parse(`\n${cert}\n`)).toBe(cert);
  });

  it("rejects a file path or other text", () => {
    expect(CaCertSchema.safeParse("/home/me/ca.crt").success).toBe(false);
  });
});
