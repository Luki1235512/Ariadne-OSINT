import { type Db, ping } from "@ariadne/db";
import Fastify, { type FastifyInstance } from "fastify";
import type { Config } from "./config.js";

export interface ServerOptions {
  config: Pick<Config, "LOG_LEVEL">;
  db: Db;
}

export function buildServer({ config, db }: ServerOptions): FastifyInstance {
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

  app.get("/api/ready", async (request, reply) => {
    try {
      await ping(db);
      return await reply.send({ status: "ok" });
    } catch (error) {
      request.log.error({ err: error }, "database not reachable");
      return reply.code(503).send({
        error: { code: "DATABASE_UNAVAILABLE", message: "The database is not reachable" },
      });
    }
  });

  return app;
}
