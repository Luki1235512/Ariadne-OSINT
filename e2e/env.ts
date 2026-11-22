try {
  process.loadEnvFile("../.env");
} catch {
  // No .env file: rely on the environment (CI sets the variables directly).
}

export const PORT = 3100;

export function e2eDatabaseUrl(): string {
  const url = process.env.E2E_DATABASE_URL;
  if (url === undefined || url === "") {
    throw new Error("E2E_DATABASE_URL is not set. Copy it from .env.example into .env.");
  }
  const name = decodeURIComponent(new URL(url).pathname.slice(1));
  if (!name.endsWith("_e2e")) {
    throw new Error(
      `Refusing to use database "${name}" for e2e tests: its name must end in "_e2e"`,
    );
  }
  return url;
}
