import Fastify, { type FastifyInstance } from "fastify";
import { ping, type Db } from "@ariadne/db";
import type { Config } from "./config.js";
import { loggableError, registerErrorHandlers, sendError } from "./http/errors.js";
import { requestLogFields } from "./http/request-log.js";
import { registerObjectRoutes } from "./routes/objects.js";
import { registerSearchRoutes } from "./routes/search.js";
import { registerTileRoutes } from "./routes/tiles.js";
import { registerWebApp } from "./routes/web-app.js";
import { registerRateLimit } from "./security/rate-limits.js";
import { registerSecurityHeaders } from "./security/security-headers.js";

export interface ServerOptions {
  config: Pick<Config, "LOG_LEVEL"> & Partial<Pick<Config, "TRUST_PROXY_HOPS" | "WEB_DIST_DIR">>;
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
        req: requestLogFields,
      },
    },
  });

  registerSecurityHeaders(app);

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
    if (config.WEB_DIST_DIR !== undefined) {
      await registerWebApp(api, config.WEB_DIST_DIR);
    }
  });

  registerErrorHandlers(app);

  return app;
}
