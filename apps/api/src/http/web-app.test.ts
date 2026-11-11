import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "@ariadne/db";
import { buildServer } from "../server.js";
import { ASSET_CACHE_CONTROL, PAGE_CACHE_CONTROL } from "./web-app.js";

const db = createDb({ connectionString: "postgres://unused@127.0.0.1:1/unused" });
let dir: string;
let app: FastifyInstance;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "ariadne-web-"));
  await mkdir(join(dir, "dist", "assets"), { recursive: true });
  await writeFile(join(dir, "dist", "index.html"), "<!doctype html><title>Ariadne</title>");
  await writeFile(join(dir, "dist", "assets", "index-abc123.js"), "console.log(1);");
  await writeFile(join(dir, "dist", "assets", "worker-abc123.mjs"), "export {};");
  await writeFile(join(dir, "dist", "assets", "index-abc123.css"), "body{}");
  await writeFile(join(dir, "dist", ".secret"), "hidden");
  await writeFile(join(dir, "outside.txt"), "not part of the web app");
  app = buildServer({
    config: { LOG_LEVEL: "silent", WEB_DIST_DIR: join(dir, "dist") },
    db,
  });
});

afterAll(async () => {
  await app.close();
  await db.destroy();
  await rm(dir, { recursive: true, force: true });
});

describe("the built web app", () => {
  it("serves the page at /, revalidated on every visit", async () => {
    const response = await app.inject({ method: "GET", url: "/?object=pl%3Ateryt%3A14" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^text\/html/);
    expect(response.headers["cache-control"]).toBe(PAGE_CACHE_CONTROL);
    expect(response.body).toContain("<title>Ariadne</title>");
  });

  it.each([
    ["index-abc123.js", /^text\/javascript|^application\/javascript/],
    ["worker-abc123.mjs", /^text\/javascript|^application\/javascript/],
    ["index-abc123.css", /^text\/css/],
  ])("serves assets/%s with its content type, cached for a year", async (file, type) => {
    const response = await app.inject({ method: "GET", url: `/assets/${file}` });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(type);
    expect(response.headers["cache-control"]).toBe(ASSET_CACHE_CONTROL);
  });

  it.each(["/assets/missing.js", "/.secret", "/../outside.txt", "/%2e%2e/outside.txt"])(
    "answers %s with the API's 404",
    async (url) => {
      const response = await app.inject({ method: "GET", url });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: { code: "NOT_FOUND", message: "Not found" } });
    },
  );

  it("still answers unknown API routes with the API's 404", async () => {
    const response = await app.inject({ method: "GET", url: "/api/nope" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: { code: "NOT_FOUND", message: "Not found" } });
  });

  it("still serves the API", async () => {
    const response = await app.inject({ method: "GET", url: "/api/health" });

    expect(response.json()).toEqual({ status: "ok" });
  });
});
