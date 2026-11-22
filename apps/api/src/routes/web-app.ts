import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

export const ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable";
export const PAGE_CACHE_CONTROL = "no-cache";

export async function registerWebApp(app: FastifyInstance, root: string): Promise<void> {
  await app.register(fastifyStatic, {
    root,
    prefix: "/",
    index: "index.html",
    dotfiles: "ignore",
    cacheControl: false,
    setHeaders: (reply, path) => {
      const hashed = path.includes("/assets/");
      reply.header("cache-control", hashed ? ASSET_CACHE_CONTROL : PAGE_CACHE_CONTROL);
    },
  });
}
