import { getObjectDetails, type Db } from "@ariadne/db";
import { ObjectId } from "@ariadne/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendError } from "../http/errors.js";
import { NoQuery } from "../http/validation.js";

const ObjectParams = z.strictObject({ id: ObjectId });

export function registerObjectRoutes(app: FastifyInstance, db: Db): void {
  app.get("/api/objects/:id", async (request, reply) => {
    const params = ObjectParams.safeParse(request.params);
    if (!params.success || !NoQuery.safeParse(request.query).success) {
      return sendError(
        reply,
        400,
        "INVALID_REQUEST",
        'Expected /api/objects/{id} with a namespaced ID such as "pl:teryt:14"',
      );
    }

    const details = await getObjectDetails(db, params.data.id);
    if (details === undefined) {
      return sendError(reply, 404, "NOT_FOUND", "No object with this ID");
    }

    reply.header("cache-control", "no-store");
    return reply.send(details);
  });
}
