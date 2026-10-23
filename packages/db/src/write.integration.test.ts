import { sql } from "kysely";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DbWriteError } from "./errors.js";
import { createTestDb, resetData } from "./test-support/index.js";
import { upsertObject, upsertSource } from "./write.js";

const db = createTestDb();

afterAll(async () => {
  await db.destroy();
});

const source = {
  id: "test:dataset:2026-10-22",
  name: "Synthetic test dataset",
  publisher: "Ariadne tests",
  url: "https://example.org/dataset",
  license: "CC0-1.0",
  licenseUrl: null,
  retrievedAt: "2026-10-22T08:00:00Z",
};
const ref = (recordRef: string) => [{ sourceId: source.id, recordRef }];

const region = {
  id: "test:loc:region",
  type: "Location" as const,
  countryCode: "PL",
  displayName: "Region",
  properties: {},
};

async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  const error: unknown = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(DbWriteError);
  expect((error as DbWriteError).code).toBe(code);
}

beforeEach(async () => {
  await resetData(db);
  await upsertSource(db, source);
});

describe("upsertObject", () => {
  it("creates an object with its source reference", async () => {
    expect(await upsertObject(db, region, ref("row-1"))).toBe("created");

    const row = await db
      .selectFrom("objects")
      .selectAll()
      .where("id", "=", region.id)
      .executeTakeFirstOrThrow();
    expect(row).toMatchObject({ type: "Location", country_code: "PL", display_name: "Region" });
    expect(row.properties).toEqual({});

    const refs = await db.selectFrom("object_sources").selectAll().execute();
    expect(refs).toEqual([{ object_id: region.id, source_id: source.id, record_ref: "row-1" }]);
  });

  it("is idempotent: writing the same object again changes nothing", async () => {
    await upsertObject(db, region, ref("row-1"));
    const before = await db.selectFrom("objects").select("updated_at").executeTakeFirstOrThrow();

    expect(await upsertObject(db, region, ref("row-1"))).toBe("unchanged");

    const after = await db.selectFrom("objects").select("updated_at").executeTakeFirstOrThrow();
    expect(after.updated_at).toEqual(before.updated_at);
    expect(await db.selectFrom("objects").select("id").execute()).toHaveLength(1);
  });

  it("updates changed fields and updated_at", async () => {
    await upsertObject(db, region, ref("row-1"));
    expect(await upsertObject(db, { ...region, displayName: "Renamed" }, ref("row-1"))).toBe(
      "updated",
    );
    const row = await db.selectFrom("objects").selectAll().executeTakeFirstOrThrow();
    expect(row.display_name).toBe("Renamed");
    expect(row.updated_at.getTime()).toBeGreaterThanOrEqual(row.created_at.getTime());
  });

  it("refuses to change an object's type", async () => {
    await sql`INSERT INTO object_types (name) VALUES ('Other')`.execute(db);
    try {
      await sql`
        INSERT INTO objects (id, type, display_name) VALUES (${region.id}, 'Other', 'Planted')
      `.execute(db);
      await expectCode(upsertObject(db, region, ref("row-1")), "OBJECT_TYPE_MISMATCH");
    } finally {
      await sql`DELETE FROM objects WHERE type = 'Other'`.execute(db);
      await sql`DELETE FROM object_types WHERE name = 'Other'`.execute(db);
    }
  });

  it("requires at least one source", async () => {
    await expectCode(upsertObject(db, region, []), "NO_SOURCES");
  });

  it("rejects a reference to an unknown source", async () => {
    await expectCode(
      upsertObject(db, region, [{ sourceId: "test:nope:1", recordRef: "x" }]),
      "UNKNOWN_SOURCE",
    );
    expect(await db.selectFrom("objects").select("id").execute()).toEqual([]);
  });

  it("rejects invalid input before touching the database", async () => {
    await expectCode(
      upsertObject(db, { ...region, properties: { pesel: "00000000000" } } as never, ref("r")),
      "INVALID_INPUT",
    );
  });
});

describe("database constraints", () => {
  it("rejects an unknown object type", async () => {
    await expect(
      sql`
        INSERT INTO objects (id, type, display_name) VALUES ('test:x:1', 'Spaceship', 'X')
      `.execute(db),
    ).rejects.toThrow(/foreign key/);
  });

  it("refuses to delete a source that still has records", async () => {
    await upsertObject(db, region, ref("row-1"));
    await expect(db.deleteFrom("sources").execute()).rejects.toThrow(/foreign key/);
  });
});
