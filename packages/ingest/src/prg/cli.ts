import { basename } from "node:path";
import { parseArgs } from "node:util";
import { createDb } from "@ariadne/db";
import { z } from "zod";
import { type Counts, type ImportReport, importPrg } from "./import.js";

const USAGE = [
  "Usage: pnpm ingest:prg <folder with converted files> --retrieved-on <YYYY-MM-DD>",
  "  The folder is named after the PRG release date, e.g. data/work/prg/2026-10-23.",
  "  --retrieved-on is the day you downloaded the files.",
].join("\n");

const { values, positionals } = parseArgs({
  options: { "retrieved-on": { type: "string" } },
  allowPositionals: true,
});
const dir = positionals[0]?.replace(/\/+$/, "") ?? "";

const Args = z.object({
  dir: z.string().min(1, "Give the folder with the converted files"),
  release: z.iso.date({ message: "The folder name must be the release date, YYYY-MM-DD" }),
  retrievedOn: z.iso.date({ message: "--retrieved-on must be a date, YYYY-MM-DD" }),
  databaseUrl: z.string().min(1, "DATABASE_URL is not set. Copy .env.example to .env."),
});
const args = Args.safeParse({
  dir,
  release: basename(dir),
  retrievedOn: values["retrieved-on"],
  databaseUrl: process.env.DATABASE_URL ?? "",
});
if (!args.success) {
  console.error(`${z.prettifyError(args.error)}\n\n${USAGE}`);
  process.exit(1);
}

const db = createDb({ connectionString: args.data.databaseUrl, statementTimeoutMs: 60_000 });
const started = Date.now();
let report: ImportReport;
try {
  report = await importPrg(db, {
    dir: args.data.dir,
    release: args.data.release,
    retrievedOn: args.data.retrievedOn,
  });
} finally {
  await db.destroy();
}

function row(name: string, counts: Counts): string {
  const cells = [counts.created, counts.updated, counts.unchanged, counts.suppressed];
  return name.padEnd(12) + cells.map((n) => String(n).padStart(11)).join("");
}

console.log(`Source: ${report.sourceId}`);
console.log(`${"".padEnd(12)}    created    updated  unchanged suppressed`);
console.log(row("objects", report.objects));
console.log(row("boundaries", report.boundaries));
console.log(row("links", report.links));

console.log(`\nProblems: ${String(report.problems.length)}`);
for (const p of report.problems.slice(0, 50)) {
  console.log(`  ${p.file}:${String(p.line)}  ${p.message}`);
}
if (report.problems.length > 50) {
  console.log(`  ... and ${String(report.problems.length - 50)} more`);
}

console.log(`Missing from this release: ${String(report.missing.length)}`);
for (const id of report.missing) {
  console.log(`  ${id}`);
}

console.log(`\nTook ${String(Math.round((Date.now() - started) / 1000))} s`);
process.exit(report.problems.length > 0 ? 1 : 0);
