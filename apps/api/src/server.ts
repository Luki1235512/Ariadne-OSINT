import Fastify, { type FastifyInstance } from "fastify";
import { ping, type Db } from "@ariadne/db";
import type { Config } from "./config.js";
import { loggableError, registerErrorHandlers, sendError } from "./http/errors.js";
import { registerRateLimit } from "./http/rate-limits.js";
import { registerObjectRoutes } from "./routes/objects.js";
import { registerSearchRoutes } from "./routes/search.js";
import { registerTileRoutes } from "./routes/tiles.js";

export interface ServerOptions {
  config: Pick<Config, "LOG_LEVEL"> & Partial<Pick<Config, "TRUST_PROXY_HOPS">>;
  db: Db;
}

export function buildServer({ config, db }: ServerOptions): FastifyInstance {
  const hops = config.TRUST_PROXY_HOPS ?? 0;
  const app = Fastify({
    trustProxy: (_address, hop) => hop < hops,
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

  void app.register(async (api) => {
    await registerRateLimit(api);
    registerObjectRoutes(api, db);
    registerSearchRoutes(api, db);
    registerTileRoutes(api, db);
  });

  registerErrorHandlers(app);

  return app;
}
