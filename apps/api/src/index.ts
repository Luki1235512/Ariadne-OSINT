import { createDb, ping } from "@ariadne/db";
import { loadConfig } from "./config.js";
import { buildServer } from "./server.js";

const config = loadConfig(process.env);
const db = createDb({ connectionString: config.DATABASE_URL });
const app = buildServer({ config, db });

// Fail at startup with a clear message, rather than on the first request.
try {
  await ping(db);
} catch (error) {
  app.log.fatal({ err: error }, "cannot reach the database; check DATABASE_URL");
  await db.destroy();
  process.exit(1);
}

// Docker sends SIGTERM on stop; Ctrl+C sends SIGINT. Finish open requests, then exit.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, "shutting down");
    app
      .close()
      .then(() => db.destroy())
      .then(
        () => process.exit(0),
        (error: unknown) => {
          app.log.error({ err: error }, "error during shutdown");
          process.exit(1);
        },
      );
  });
}

await app.listen({ host: config.HOST, port: config.PORT });
