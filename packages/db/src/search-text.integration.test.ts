import { sql } from "kysely";
import { afterAll, describe, expect, it } from "vitest";
import { createTestDb } from "./test-support/index.js";

const db = createTestDb();

afterAll(async () => {
  await db.destroy();
});

async function searchText(input: string): Promise<string> {
  const result = await sql<{ text: string }>`SELECT search_text(${input}) AS text`.execute(db);
  return result.rows[0]?.text ?? "";
}

describe("search_text", () => {
  it("lowercases and removes Polish diacritics, including Ł", async () => {
    expect(await searchText("Łódź")).toBe("lodz");
    expect(await searchText("ŹDŹBŁO Żółć ąęśćń")).toBe("zdzblo zolc aescn");
  });

  it("handles letters of other European languages", async () => {
    expect(await searchText("Kärnten Čeština Ørsted Straße")).toBe(
      "karnten cestina orsted strasse",
    );
  });

  it("is backed by a trigram index on object names", async () => {
    const result = await sql<{ indexdef: string }>`
      SELECT indexdef FROM pg_indexes WHERE indexname = 'objects_search_name_idx'
    `.execute(db);
    expect(result.rows[0]?.indexdef).toContain("gin_trgm_ops");
  });
});
