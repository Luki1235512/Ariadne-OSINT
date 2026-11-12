import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "@ariadne/db";
import { buildServer } from "../server.js";
import { RATE_LIMITS } from "./rate-limits.js";

const db = createDb({ connectionString: "postgres://unused@127.0.0.1:1/unused" });

afterAll(async () => {
  await db.destroy();
});

async function withServer(
  hops: number,
  run: (app: ReturnType<typeof buildServer>) => Promise<void>,
): Promise<void> {
  const app = buildServer({ config: { LOG_LEVEL: "silent", TRUST_PROXY_HOPS: hops }, db });
  try {
    await run(app);
  } finally {
    await app.close();
  }
}

const search = "/api/search?q=lo";

describe("rate limiting", () => {
  it("answers 429 with an error code once a client exceeds the search limit", async () => {
    await withServer(0, async (app) => {
      for (let i = 0; i < RATE_LIMITS.search; i++) {
        expect((await app.inject({ method: "GET", url: search })).statusCode).toBe(400);
      }
      const response = await app.inject({ method: "GET", url: search });

      expect(response.statusCode).toBe(429);
      expect(response.headers["retry-after"]).toBeDefined();
      expect(response.json()).toMatchObject({ error: { code: "RATE_LIMITED" } });
    });
  });

  it("does not limit the health check", async () => {
    await withServer(0, async (app) => {
      for (let i = 0; i < RATE_LIMITS.default + 10; i++) {
        expect((await app.inject({ method: "GET", url: "/api/health" })).statusCode).toBe(200);
      }
    });
  });

  it("counts clients behind the proxy separately when the proxy is trusted", async () => {
    await withServer(1, async (app) => {
      const as = (client: string) =>
        app.inject({ method: "GET", url: search, headers: { "x-forwarded-for": client } });
      for (let i = 0; i < RATE_LIMITS.search; i++) {
        await as("203.0.113.1");
      }

      expect((await as("203.0.113.1")).statusCode).toBe(429);
      expect((await as("203.0.113.2")).statusCode).toBe(400);
    });
  });

  it("ignores X-Forwarded-For without a trusted proxy, so clients cannot dodge the limit", async () => {
    await withServer(0, async (app) => {
      for (let i = 0; i < RATE_LIMITS.search; i++) {
        await app.inject({
          method: "GET",
          url: search,
          headers: { "x-forwarded-for": `203.0.113.${String(i)}` },
        });
      }
      const response = await app.inject({
        method: "GET",
        url: search,
        headers: { "x-forwarded-for": "198.51.100.7" },
      });

      expect(response.statusCode).toBe(429);
    });
  });
});
