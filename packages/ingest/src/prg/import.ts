import { createReadStream } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import {
  type Db,
  DbWriteError,
  upsertBoundary,
  upsertLink,
  upsertObject,
  upsertSource,
  type WriteResult,
} from "@ariadne/db";
import { mapPrgFeature } from "./map.js";
import { PrgFeature } from "./record.js";
import { PRG_SOURCE_PREFIX, prgSource } from "./source.js";

export const PRG_LAYERS = ["A01_Granice_wojewodztw", "A02_Granice_powiatow", "A03_Granice_gmin"];

export type Counts = Record<WriteResult, number>;

export interface Problem {
  file: string;
  line: number;
  message: string;
}

export interface ImportReport {
  sourceId: string;
  objects: Counts;
  boundaries: Counts;
  links: Counts;
  problems: Problem[];
  missing: string[];
}

export interface ImportOptions {
  dir: string;
  release: string;
  retrievedOn: string;
}

function emptyCounts(): Counts {
  return { created: 0, updated: 0, unchanged: 0, suppressed: 0 };
}

export async function importPrg(db: Db, options: ImportOptions): Promise<ImportReport> {
  const source = prgSource(options.release, options.retrievedOn);
  await upsertSource(db, source);

  const report: ImportReport = {
    sourceId: source.id,
    objects: emptyCounts(),
    boundaries: emptyCounts(),
    links: emptyCounts(),
    problems: [],
    missing: [],
  };
  const seen: string[] = [];

  for (const layer of PRG_LAYERS) {
    const file = `${layer}.geojsonl`;
    const lines = createInterface({ input: createReadStream(join(options.dir, file)) });
    let lineNumber = 0;

    for await (const line of lines) {
      lineNumber += 1;
      if (line.trim() === "") {
        continue;
      }
      const problem = (message: string) => {
        report.problems.push({ file, line: lineNumber, message });
      };

      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        problem("Not valid JSON");
        continue;
      }
      const feature = PrgFeature.safeParse(parsed);
      if (!feature.success) {
        problem(`Unexpected record format: ${feature.error.issues[0]?.message ?? "unknown"}`);
        continue;
      }
      const mapped = mapPrgFeature(feature.data);
      if (!mapped.ok) {
        problem(mapped.problem);
        continue;
      }

      const { object, geometry, parentLink, recordRef } = mapped.unit;
      const refs = [{ sourceId: source.id, recordRef }];
      seen.push(object.id);
      try {
        await db.transaction().execute(async (trx) => {
          const objectResult = await upsertObject(trx, object, refs);
          if (objectResult === "suppressed") {
            report.objects.suppressed += 1;
            return;
          }
          const boundaryResult = await upsertBoundary(trx, {
            objectId: object.id,
            sourceId: source.id,
            geometry,
          });
          const linkResult = parentLink === null ? null : await upsertLink(trx, parentLink, refs);
          report.objects[objectResult] += 1;
          report.boundaries[boundaryResult] += 1;
          if (linkResult !== null) {
            report.links[linkResult] += 1;
          }
        });
      } catch (error) {
        if (error instanceof DbWriteError) {
          problem(`${object.id}: ${error.code}: ${error.message}`);
          continue;
        }
        throw error;
      }
    }
  }

  report.missing = await findMissing(db, seen);
  return report;
}

async function findMissing(db: Db, seen: string[]): Promise<string[]> {
  let query = db
    .selectFrom("object_sources")
    .select("object_id")
    .distinct()
    .where("source_id", "like", `${PRG_SOURCE_PREFIX}%`);
  if (seen.length > 0) {
    query = query.where("object_id", "not in", seen);
  }
  const rows = await query.orderBy("object_id").execute();
  return rows.map((row) => row.object_id);
}
