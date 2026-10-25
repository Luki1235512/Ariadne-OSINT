import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { removeObject } from "@ariadne/db";
import { createTestDb, resetData } from "@ariadne/db/test-support";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { importPrg, PRG_LAYERS } from "./import.js";

const FIXTURE = fileURLToPath(new URL("../../test-fixtures/prg/2026-01-01", import.meta.url));

const db = createTestDb();
let tempDir: string | undefined;

afterAll(async () => {
  await db.destroy();
});

beforeEach(async () => {
  await resetData(db);
});

afterEach(async () => {
  if (tempDir !== undefined) {
    await rm(tempDir, { recursive: true });
    tempDir = undefined;
  }
});

function importFixture() {
  return importPrg(db, { dir: FIXTURE, release: "2026-01-01", retrievedOn: "2026-01-05" });
}

async function laterRelease(edit: (file: string, lines: string[]) => string[]): Promise<string> {
  tempDir = await mkdtemp(join(tmpdir(), "ariadne-prg-"));
  for (const layer of PRG_LAYERS) {
    const file = `${layer}.geojsonl`;
    const lines = (await readFile(join(FIXTURE, file), "utf8")).split("\n");
    await writeFile(join(tempDir, file), edit(file, lines).join("\n"));
  }
  return tempDir;
}

describe("importPrg", () => {
  it("imports units, boundaries and links, and reports faulty records", async () => {
    const report = await importFixture();

    expect(report.sourceId).toBe("pl:gugik:prg:2026-01-01");
    expect(report.objects).toEqual({ created: 6, updated: 0, unchanged: 0, suppressed: 0 });
    expect(report.boundaries).toEqual({ created: 6, updated: 0, unchanged: 0, suppressed: 0 });
    expect(report.links).toEqual({ created: 5, updated: 0, unchanged: 0, suppressed: 0 });
    expect(report.problems).toHaveLength(2);
    expect(report.problems[0]).toEqual({
      file: "A03_Granice_gmin.geojsonl",
      line: 4,
      message: '1401034 has municipality type digit "4"',
    });
    expect(report.problems[1]?.line).toBe(6);
    expect(report.problems[1]?.message).toMatch(/^pl:teryt:149901: MISSING_OBJECT/);
    expect(report.missing).toEqual([]);
  });

  it("writes nothing of a unit whose link fails", async () => {
    await importFixture();
    const orphan = await db
      .selectFrom("objects")
      .select("id")
      .where("id", "=", "pl:teryt:149901")
      .execute();
    expect(orphan).toEqual([]);
  });

  it("builds the hierarchy municipality → county → voivodeship", async () => {
    await importFixture();
    const links = await db
      .selectFrom("links")
      .select(["from_object_id", "to_object_id"])
      .orderBy("from_object_id")
      .execute();
    expect(links).toEqual([
      { from_object_id: "pl:teryt:1401", to_object_id: "pl:teryt:14" },
      { from_object_id: "pl:teryt:140101", to_object_id: "pl:teryt:1401" },
      { from_object_id: "pl:teryt:140102", to_object_id: "pl:teryt:1401" },
      { from_object_id: "pl:teryt:1465", to_object_id: "pl:teryt:14" },
      { from_object_id: "pl:teryt:146501", to_object_id: "pl:teryt:1465" },
    ]);
  });

  it("records the source and licence of every unit", async () => {
    await importFixture();
    const source = await db.selectFrom("sources").selectAll().executeTakeFirstOrThrow();
    expect(source).toMatchObject({
      id: "pl:gugik:prg:2026-01-01",
      publisher: "Główny Urząd Geodezji i Kartografii",
      license: "Bezpłatne, do dowolnego wykorzystania (Dz.U. 2021 poz. 1373)",
    });
    const refs = await db.selectFrom("object_sources").select("record_ref").execute();
    expect(refs).toHaveLength(6);
    expect(refs).toContainEqual({ record_ref: "PL.PZGIK.200/gmi-1401013" });
  });

  it("changes nothing when the same release is imported again", async () => {
    await importFixture();
    const again = await importFixture();
    expect(again.objects).toEqual({ created: 0, updated: 0, unchanged: 6, suppressed: 0 });
    expect(again.boundaries).toEqual({ created: 0, updated: 0, unchanged: 6, suppressed: 0 });
    expect(again.links).toEqual({ created: 0, updated: 0, unchanged: 5, suppressed: 0 });
  });

  it("reports units missing from a later release without deleting them", async () => {
    await importFixture();
    const dir = await laterRelease((file, lines) =>
      file === "A03_Granice_gmin.geojsonl" ? lines.filter((l) => !l.includes('"Promna"')) : lines,
    );
    const report = await importPrg(db, { dir, release: "2027-01-01", retrievedOn: "2027-01-03" });

    expect(report.missing).toEqual(["pl:teryt:140102"]);
    const promna = await db
      .selectFrom("objects")
      .select("id")
      .where("id", "=", "pl:teryt:140102")
      .execute();
    expect(promna).toHaveLength(1);
  });

  it("moves boundaries to the new release's source", async () => {
    await importFixture();
    const dir = await laterRelease((_file, lines) => lines);
    const report = await importPrg(db, { dir, release: "2027-01-01", retrievedOn: "2027-01-03" });

    expect(report.boundaries.updated).toBe(6);
    const sources = await db
      .selectFrom("object_geometries")
      .select("source_id")
      .distinct()
      .execute();
    expect(sources).toEqual([{ source_id: "pl:gugik:prg:2027-01-01" }]);
  });

  it("skips a removed unit", async () => {
    await importFixture();
    await removeObject(db, "pl:teryt:140102", "Removal request");
    const report = await importFixture();
    expect(report.objects.suppressed).toBe(1);
    expect(report.missing).toEqual([]);
  });
});
