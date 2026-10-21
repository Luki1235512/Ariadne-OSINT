import Fastify, { type FastifyInstance } from "fastify";
import type { Config } from "./config.js";

export function buildServer(config: Pick<Config, "LOG_LEVEL">): FastifyInstance {
  const app = Fastify({
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

  return app;
}
