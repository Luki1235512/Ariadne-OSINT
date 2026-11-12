import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";

export const RATE_LIMITS = {
  default: 300,
  tiles: 1200,
  objects: 120,
  search: 60,
} as const;

export const ONE_MINUTE = 60_000;

export function routeLimit(max: number): { rateLimit: { max: number; timeWindow: number } } {
  return { rateLimit: { max, timeWindow: ONE_MINUTE } };
}

export async function registerRateLimit(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    global: true,
    max: RATE_LIMITS.default,
    timeWindow: ONE_MINUTE,
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      code: "RATE_LIMITED",
      message: `Too many requests. Try again in ${String(Math.ceil(context.ttl / 1000))} seconds.`,
    }),
    onExceeded: (request) => {
      request.log.warn({ route: request.routeOptions.url }, "rate limit exceeded");
    },
  });
}
