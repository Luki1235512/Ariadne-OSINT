import { isAbsolute } from "node:path";
import { z } from "zod";
import { CaCertSchema } from "@ariadne/db";

const EnvSchema = z.object({
  HOST: z.string().min(1).default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  WEB_DIST_DIR: z.string().refine(isAbsolute, "WEB_DIST_DIR must be an absolute path").optional(),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is not set. Copy .env.example to .env."),
  DATABASE_CA_CERT: CaCertSchema.optional(),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(env: Record<string, string | undefined>): Config {
  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
