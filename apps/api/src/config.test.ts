import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("uses safe defaults when nothing is set", () => {
    expect(loadConfig({})).toEqual({ HOST: "127.0.0.1", PORT: 3000, LOG_LEVEL: "info" });
  });

  it("reads values from the environment", () => {
    expect(loadConfig({ HOST: "0.0.0.0", PORT: "8000", LOG_LEVEL: "debug" })).toEqual({
      HOST: "0.0.0.0",
      PORT: 8000,
      LOG_LEVEL: "debug",
    });
  });

  it("rejects an invalid port", () => {
    expect(() => loadConfig({ PORT: "not-a-number" })).toThrow(/PORT/);
  });

  it("rejects an unknown log level", () => {
    expect(() => loadConfig({ LOG_LEVEL: "loud" })).toThrow(/LOG_LEVEL/);
  });
});
