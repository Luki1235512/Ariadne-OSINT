import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { MAX_SEARCH_RESULTS, MIN_SEARCH_LENGTH, searchObjects, type Db } from "@ariadne/db";
import type { SearchResponse } from "@ariadne/shared";
import { sendError } from "../http/errors.js";
import { RATE_LIMITS, routeLimit } from "../http/rate-limits.js";

export const MAX_QUERY_LENGTH = 100;

export const SearchQuery = z.strictObject({
  q: z.string().trim().min(MIN_SEARCH_LENGTH).max(MAX_QUERY_LENGTH),
  limit: z
    .string()
    .regex(/^[1-9][0-9]?$/)
    .transform(Number)
    .pipe(z.int().max(MAX_SEARCH_RESULTS))
    .optional(),
});

export function registerSearchRoutes(app: FastifyInstance, db: Db): void {
  app.get("/api/search", { config: routeLimit(RATE_LIMITS.search) }, async (request, reply) => {
    const query = SearchQuery.safeParse(request.query);
    if (!query.success) {
      return sendError(
        reply,
        400,
        "INVALID_REQUEST",
        `Expected /api/search?q=<text> with ${String(MIN_SEARCH_LENGTH)} to ${String(MAX_QUERY_LENGTH)} characters, and optionally limit=1-${String(MAX_SEARCH_RESULTS)}`,
      );
    }

    const results = await searchObjects(db, query.data.q, query.data.limit);
    const body: SearchResponse = { results };

    reply.header("cache-control", "no-store");
    return reply.send(body);
  });
}
