import { type Db, ping } from "@ariadne/db";
import Fastify, { type FastifyInstance } from "fastify";
import type { Config } from "./config.js";
import { loggableError, registerErrorHandlers, sendError } from "./http/errors.js";
import { registerObjectRoutes } from "./routes/objects.js";
import { registerTileRoutes } from "./routes/tiles.js";

export interface ServerOptions {
  config: Pick<Config, "LOG_LEVEL">;
  db: Db;
}

export function buildServer({ config, db }: ServerOptions): FastifyInstance {
  const app = Fastify({
    routerOptions: { maxParamLength: 600 },
    frameworkErrors: (error, _request, reply) => {
      void sendError(
        reply,
        error.statusCode ?? 400,
        "INVALID_REQUEST",
        "Malformed or too long URL",
      );
    },
    logger: {
      level: config.LOG_LEVEL,
      serializers: {
        req: (request: { method: string; url: string }) => ({
          method: request.method,
          path: request.url.split("?", 1)[0],
        }),
      },
    },
  });

  app.get("/api/health", (_request, reply) => reply.send({ status: "ok" }));

  app.get("/api/ready", async (request, reply) => {
    try {
      await ping(db);
      return await reply.send({ status: "ok" });
    } catch (error) {
      request.log.error({ err: loggableError(error) }, "database not reachable");
      return sendError(reply, 503, "DATABASE_UNAVAILABLE", "The database is not reachable");
    }
  });

  registerObjectRoutes(app, db);
  registerTileRoutes(app, db);
  registerErrorHandlers(app);

  return app;
}
