import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DbWriteError } from "../errors.js";
import { createTestDb, resetData } from "../test-support/index.js";
import {
  deleteEventsEndedBefore,
  upsertBoundary,
  upsertObject,
  upsertPoint,
  upsertSource,
} from "./index.js";

const db = createTestDb();

afterAll(async () => {
  await db.destroy();
});

const source = {
  id: "test:dataset:events",
  name: "Synthetic events",
  publisher: "Ariadne tests",
  url: "https://example.org/events",
  license: "CC0-1.0",
  licenseUrl: null,
  retrievedAt: "2026-11-12T08:00:00Z",
};
const ref = (recordRef: string) => [{ sourceId: source.id, recordRef }];

const report = {
  id: "test:event:drones",
  type: "Event" as const,
  countryCode: "LV",
  displayName: "Three drones flew over Latvia",
  startsAt: "2026-11-12T03:00:00Z",
  endsAt: null,
  properties: {
    kind: "media_report" as const,
    category: "military" as const,
    official: false,
    url: "https://example.org/news/drones",
    publisher: "example.org",
    locationPrecision: "country" as const,
  },
};

const area = {
  id: "test:loc:area",
  type: "Location" as const,
  countryCode: "PL",
  displayName: "Area",
  properties: {
    kind: "administrative_area" as const,
    adminLevel: 1,
    areaKm2: null,
    countryData: {},
  },
};

async function timesOf(id: string) {
  return db
    .selectFrom("object_times")
    .select(["starts_at", "ends_at"])
    .where("object_id", "=", id)
    .executeTakeFirst();
}

beforeEach(async () => {
  await resetData(db);
  await upsertSource(db, source);
});

describe("events", () => {
  it("stores an event with its times", async () => {
    expect(await upsertObject(db, report, ref("1"))).toBe("created");

    expect(await timesOf(report.id)).toEqual({
      starts_at: new Date("2026-11-12T03:00:00Z"),
      ends_at: null,
    });
  });

  it("reports an identical event as unchanged", async () => {
    await upsertObject(db, report, ref("1"));

    expect(await upsertObject(db, report, ref("1"))).toBe("unchanged");
  });

  it("treats the same moment in another time zone as unchanged", async () => {
    await upsertObject(db, report, ref("1"));

    const sameMoment = { ...report, startsAt: "2026-11-12T04:00:00+01:00" };
    expect(await upsertObject(db, sameMoment, ref("1"))).toBe("unchanged");
  });

  it("reports a changed end time as an update", async () => {
    await upsertObject(db, report, ref("1"));

    const ended = { ...report, endsAt: "2026-11-12T05:30:00Z" };
    expect(await upsertObject(db, ended, ref("1"))).toBe("updated");
    expect((await timesOf(report.id))?.ends_at).toEqual(new Date("2026-11-12T05:30:00Z"));
  });

  it("deletes the times together with the event", async () => {
    await upsertObject(db, report, ref("1"));

    await db.deleteFrom("objects").where("id", "=", report.id).execute();

    expect(await timesOf(report.id)).toBeUndefined();
  });
});

describe("upsertPoint", () => {
  const point = { objectId: report.id, sourceId: source.id, position: [24.6, 56.9] as const };

  it("creates, keeps and moves an event's point", async () => {
    await upsertObject(db, report, ref("1"));

    expect(await upsertPoint(db, { ...point, position: [24.6, 56.9] })).toBe("created");
    expect(await upsertPoint(db, { ...point, position: [24.6, 56.9] })).toBe("unchanged");
    expect(await upsertPoint(db, { ...point, position: [24.1, 56.95] })).toBe("updated");
  });

  it("refuses a point for an object that has a boundary", async () => {
    await upsertObject(db, area, ref("area"));
    await upsertBoundary(db, {
      objectId: area.id,
      sourceId: source.id,
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [20, 51],
            [21, 51],
            [21, 52],
            [20, 52],
            [20, 51],
          ],
        ],
      },
    });

    const error: unknown = await upsertPoint(db, {
      objectId: area.id,
      sourceId: source.id,
      position: [20.5, 51.5],
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DbWriteError);
  });

  it("refuses a point for a missing object", async () => {
    const error: unknown = await upsertPoint(db, { ...point, position: [24.6, 56.9] }).catch(
      (e: unknown) => e,
    );
    expect((error as DbWriteError).code).toBe("MISSING_OBJECT");
  });
});

describe("deleteEventsEndedBefore", () => {
  it("deletes events that ended, or without an end started, before the cutoff", async () => {
    const old = { ...report, id: "test:event:old", startsAt: "2026-10-01T00:00:00Z" };
    const ended = {
      ...report,
      id: "test:event:ended",
      startsAt: "2026-10-01T00:00:00Z",
      endsAt: "2026-10-02T00:00:00Z",
    };
    const longRunning = {
      ...report,
      id: "test:event:long",
      startsAt: "2026-10-01T00:00:00Z",
      endsAt: "2026-11-11T00:00:00Z",
    };
    const recent = { ...report, id: "test:event:recent" };
    for (const event of [old, ended, longRunning, recent]) {
      await upsertObject(db, event, ref(event.id));
    }
    await upsertObject(db, area, ref("area"));

    const deleted = await deleteEventsEndedBefore(db, new Date("2026-10-13T00:00:00Z"));

    expect(deleted).toBe(2);
    const left = await db.selectFrom("objects").select("id").orderBy("id").execute();
    expect(left.map((row) => row.id)).toEqual([
      "test:event:long",
      "test:event:recent",
      "test:loc:area",
    ]);
    expect(await db.selectFrom("suppressions").selectAll().execute()).toEqual([]);
  });
});
