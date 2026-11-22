import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "@ariadne/db";
import { buildServer } from "../server.js";
import { SECURITY_HEADERS } from "./security-headers.js";

const db = createDb({ connectionString: "postgres://unused@127.0.0.1:1/unused" });
const app = buildServer({ config: { LOG_LEVEL: "silent" }, db });

afterAll(async () => {
  await app.close();
  await db.destroy();
});

describe("security headers", () => {
  it.each(["/api/health", "/api/nope", "/api/search?q=lo"])("are set on %s", async (url) => {
    const response = await app.inject({ method: "GET", url });

    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(response.headers[name]).toBe(value);
    }
  });

  it("allow scripts, styles and connections only from the own origin and the map tiles", () => {
    const csp = SECURITY_HEADERS["content-security-policy"];

    expect(csp).toContain("script-src 'self';");
    expect(csp).toContain("connect-src 'self' https://tiles.openfreemap.org;");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
