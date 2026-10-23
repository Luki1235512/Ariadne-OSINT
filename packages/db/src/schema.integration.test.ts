import { LINK_TYPES, OBJECT_TYPES } from "@ariadne/shared";
import { afterAll, describe, expect, it } from "vitest";
import { createTestDb } from "./test-support/index.js";

describe("ontology types in the database", () => {
  const db = createTestDb();

  afterAll(async () => {
    await db.destroy();
  });

  it("has exactly the object types defined in packages/shared", async () => {
    const rows = await db.selectFrom("object_types").select("name").orderBy("name").execute();
    expect(rows.map((row) => row.name)).toEqual([...OBJECT_TYPES].sort());
  });

  it("has exactly the link types defined in packages/shared", async () => {
    const rows = await db.selectFrom("link_types").select("name").orderBy("name").execute();
    expect(rows.map((row) => row.name)).toEqual([...LINK_TYPES].sort());
  });
});
