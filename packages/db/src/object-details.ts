import type { LinkDetails, ObjectDetails, SourceSummary } from "@ariadne/shared";
import { sql } from "kysely";
import type { Db } from "./schema.js";

export const MAX_LINKS_PER_RESPONSE = 100;

interface SourceRow {
  id: string;
  name: string;
  publisher: string;
  url: string;
  license: string;
  license_url: string | null;
  retrieved_at: Date;
  record_ref: string | null;
}

function toSourceSummary(row: SourceRow): SourceSummary {
  return {
    id: row.id,
    name: row.name,
    publisher: row.publisher,
    url: row.url,
    license: row.license,
    licenseUrl: row.license_url,
    retrievedAt: row.retrieved_at.toISOString(),
    recordRef: row.record_ref,
  };
}

const sourceColumns = [
  "s.id",
  "s.name",
  "s.publisher",
  "s.url",
  "s.license",
  "s.license_url",
  "s.retrieved_at",
] as const;

interface LinkRow {
  id: string;
  type: string;
  direction: "outgoing" | "incoming";
  properties: Record<string, unknown>;
  valid_from: string | null;
  valid_to: string | null;
  confidence: number | null;
  other_id: string;
  other_type: string;
  other_name: string;
  total: string;
}

interface LocationRow extends SourceRow {
  lon: number;
  lat: number;
  west: number | null;
  south: number | null;
  east: number | null;
  north: number | null;
}

export async function getObjectDetails(
  db: Db,
  id: string,
  linkLimit = MAX_LINKS_PER_RESPONSE,
): Promise<ObjectDetails | undefined> {
  const limit = Math.min(Math.max(1, Math.trunc(linkLimit)), MAX_LINKS_PER_RESPONSE);

  const object = await db
    .selectFrom("objects")
    .select(["id", "type", "country_code", "display_name", "properties", "updated_at"])
    .where("id", "=", id)
    .executeTakeFirst();
  if (object === undefined) {
    return undefined;
  }

  const [location, sources, links] = await Promise.all([
    sql<LocationRow>`
      SELECT ST_X(p.geom) AS lon, ST_Y(p.geom) AS lat,
        ST_XMin(b.geom) AS west, ST_YMin(b.geom) AS south,
        ST_XMax(b.geom) AS east, ST_YMax(b.geom) AS north,
        s.id, s.name, s.publisher, s.url, s.license, s.license_url, s.retrieved_at,
        NULL AS record_ref
      FROM object_geometries p
      JOIN sources s ON s.id = p.source_id
      LEFT JOIN object_geometries b ON b.object_id = p.object_id AND b.kind = 'boundary'
      WHERE p.object_id = ${id} AND p.kind = 'point'
    `.execute(db),
    db
      .selectFrom("object_sources as os")
      .innerJoin("sources as s", "s.id", "os.source_id")
      .select([...sourceColumns, "os.record_ref"])
      .where("os.object_id", "=", id)
      .orderBy("s.retrieved_at", "desc")
      .orderBy("s.id")
      .execute(),
    sql<LinkRow>`
      SELECT l.id, l.type, l.properties, l.valid_from, l.valid_to, l.confidence,
        CASE WHEN l.from_object_id = ${id} THEN 'outgoing' ELSE 'incoming' END AS direction,
        o.id AS other_id, o.type AS other_type, o.display_name AS other_name,
        count(*) OVER () AS total
      FROM links l
      JOIN objects o
        ON o.id = CASE WHEN l.from_object_id = ${id} THEN l.to_object_id ELSE l.from_object_id END
      WHERE l.from_object_id = ${id} OR l.to_object_id = ${id}
      ORDER BY direction DESC, l.type, o.display_name, l.id
      LIMIT ${limit}
    `.execute(db),
  ]);

  const linkIds = links.rows.map((link) => link.id);
  const linkSources =
    linkIds.length === 0
      ? []
      : await db
          .selectFrom("link_sources as ls")
          .innerJoin("sources as s", "s.id", "ls.source_id")
          .select([...sourceColumns, "ls.record_ref", "ls.link_id"])
          .where("ls.link_id", "in", linkIds)
          .orderBy("s.retrieved_at", "desc")
          .orderBy("s.id")
          .execute();

  const sourcesByLink = new Map<string, SourceSummary[]>();
  for (const row of linkSources) {
    const list = sourcesByLink.get(row.link_id) ?? [];
    list.push(toSourceSummary(row));
    sourcesByLink.set(row.link_id, list);
  }

  const items: LinkDetails[] = links.rows.map((row) => ({
    id: row.id,
    type: row.type,
    direction: row.direction,
    other: { id: row.other_id, type: row.other_type, displayName: row.other_name },
    properties: row.properties,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    confidence: row.confidence,
    sources: sourcesByLink.get(row.id) ?? [],
  }));

  const place = location.rows[0];
  return {
    id: object.id,
    type: object.type,
    displayName: object.display_name,
    countryCode: object.country_code,
    properties: object.properties,
    updatedAt: object.updated_at.toISOString(),
    location:
      place === undefined
        ? null
        : {
            point: [place.lon, place.lat],
            bbox:
              place.west === null ||
              place.south === null ||
              place.east === null ||
              place.north === null
                ? null
                : [place.west, place.south, place.east, place.north],
            source: toSourceSummary(place),
          },
    sources: sources.map(toSourceSummary),
    links: { total: Number(links.rows[0]?.total ?? 0), items },
  };
}
