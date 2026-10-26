import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

const DATABASE_URL = "postgres://user:password@127.0.0.1:5432/ariadne";

describe("loadConfig", () => {
  it("uses safe defaults when only the database is set", () => {
    expect(loadConfig({ DATABASE_URL })).toEqual({
      HOST: "127.0.0.1",
      PORT: 3000,
      LOG_LEVEL: "info",
      DATABASE_URL,
    });
  });

  it("reads values from the environment", () => {
    expect(loadConfig({ HOST: "0.0.0.0", PORT: "8000", LOG_LEVEL: "debug", DATABASE_URL })).toEqual(
      { HOST: "0.0.0.0", PORT: 8000, LOG_LEVEL: "debug", DATABASE_URL },
    );
  });

  it("requires the database connection string", () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it("rejects an invalid port", () => {
    expect(() => loadConfig({ DATABASE_URL, PORT: "not-a-number" })).toThrow(/PORT/);
  });

  it("rejects an unknown log level", () => {
    expect(() => loadConfig({ DATABASE_URL, LOG_LEVEL: "loud" })).toThrow(/LOG_LEVEL/);
  });
});
