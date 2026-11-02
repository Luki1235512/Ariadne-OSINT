import type { SearchResult } from "@ariadne/shared";
import { sql } from "kysely";
import type { Db } from "../schema.js";

export const MAX_SEARCH_RESULTS = 20;

export const MIN_SEARCH_LENGTH = 3;

export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (character) => `\\${character}`);
}

interface SearchRow {
  id: string;
  type: string;
  display_name: string;
  parent_id: string | null;
  parent_type: string | null;
  parent_name: string | null;
}

export async function searchObjects(
  db: Db,
  query: string,
  limit = MAX_SEARCH_RESULTS,
): Promise<SearchResult[]> {
  const text = query.trim();
  if (text.length < MIN_SEARCH_LENGTH) {
    return [];
  }
  const size = Math.min(Math.max(1, Math.trunc(limit)), MAX_SEARCH_RESULTS);
  const pattern = escapeLike(text);

  const result = await sql<SearchRow>`
    WITH q AS (SELECT search_text(${text}) AS text, search_text(${pattern}) AS pattern)
    SELECT o.id, o.type, o.display_name,
      parent.id AS parent_id, parent.type AS parent_type, parent.display_name AS parent_name
    FROM objects o
    CROSS JOIN q
    LEFT JOIN LATERAL (
      SELECT p.id, p.type, p.display_name
      FROM links l
      JOIN objects p ON p.id = l.to_object_id
      WHERE l.from_object_id = o.id AND l.type = 'located_in'
      ORDER BY p.id
      LIMIT 1
    ) parent ON true
    WHERE search_text(o.display_name) LIKE '%' || q.pattern || '%'
       OR q.text <% search_text(o.display_name)
    ORDER BY
      search_text(o.display_name) = q.text DESC,
      search_text(o.display_name) LIKE q.pattern || '%' DESC,
      search_text(o.display_name) LIKE '%' || q.pattern || '%' DESC,
      word_similarity(q.text, search_text(o.display_name)) DESC,
      o.display_name,
      o.id
    LIMIT ${size}
  `.execute(db);

  return result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    displayName: row.display_name,
    parent:
      row.parent_id === null || row.parent_type === null || row.parent_name === null
        ? null
        : { id: row.parent_id, type: row.parent_type, displayName: row.parent_name },
  }));
}
