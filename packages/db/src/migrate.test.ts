import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { readMigrations } from "./migrate.js";

let dir: string | undefined;

async function folderWith(files: Record<string, string>): Promise<URL> {
  dir = await mkdtemp(join(tmpdir(), "ariadne-migrations-"));
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(dir, name), content);
  }
  return pathToFileURL(`${dir}/`);
}

afterEach(async () => {
  if (dir !== undefined) {
    await rm(dir, { recursive: true });
    dir = undefined;
  }
});

describe("readMigrations", () => {
  it("reads the project's migrations in order", async () => {
    const migrations = await readMigrations();
    expect(migrations.map((m) => `${m.version}_${m.name}`)).toEqual([
      "0001_core_schema",
      "0002_location_type",
    ]);
  });

  it("sorts files by number and ignores non-SQL files", async () => {
    const url = await folderWith({
      "0002_second.sql": "SELECT 2;",
      "0001_first.sql": "SELECT 1;",
      "README.md": "notes",
    });
    const migrations = await readMigrations(url);
    expect(migrations.map((m) => m.version)).toEqual(["0001", "0002"]);
  });

  it("rejects badly named files", async () => {
    const url = await folderWith({ "1_first.sql": "SELECT 1;" });
    await expect(readMigrations(url)).rejects.toThrow(/0001_description\.sql/);
  });

  it("rejects two files with the same number", async () => {
    const url = await folderWith({ "0001_a.sql": "SELECT 1;", "0001_b.sql": "SELECT 1;" });
    await expect(readMigrations(url)).rejects.toThrow(/same number|0001/);
  });

  it("gives the same checksum regardless of line endings", async () => {
    const lf = await readMigrations(await folderWith({ "0001_a.sql": "SELECT 1;\nSELECT 2;\n" }));
    await rm(dir ?? "", { recursive: true });
    const crlf = await readMigrations(
      await folderWith({ "0001_a.sql": "SELECT 1;\r\nSELECT 2;\r\n" }),
    );
    expect(crlf[0]?.checksum).toBe(lf[0]?.checksum);
  });
});
