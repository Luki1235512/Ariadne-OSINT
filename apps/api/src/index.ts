import { loadConfig } from "./config.js";
import { buildServer } from "./server.js";

const config = loadConfig(process.env);
const app = buildServer(config);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, "shutting down");
    app.close().then(
      () => process.exit(0),
      (error: unknown) => {
        app.log.error({ err: error }, "error during shutdown");
        process.exit(1);
      },
    );
  });
}

await app.listen({ host: config.HOST, port: config.PORT });
