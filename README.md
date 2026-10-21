# Ariadne-OSINT

Web app for exploring connected public data.

## Requirements

- Node.js 26. The version is pinned in `.nvmrc`, so with a version manager such as [fnm](https://github.com/Schniz/fnm) or nvm you can run `fnm use` or `nvm use` in the repo folder.
- pnpm 12.14.0. The exact version is pinned in the `packageManager` field of `package.json`.
- Docker with Docker Compose, for the database.

```bash
npm install -g pnpm@12.14.0
```

## Install

```bash
git clone https://github.com/Luki1235512/Ariadne-OSINT.git
cd Ariadne-OSINT
pnpm install
```

pnpm refuses package versions published less than 7 days ago (`minimumReleaseAge` in `pnpm-workspace.yaml`). This protects against compromised releases.

## Configure

Create your local settings once:

```bash
cp .env.example .env
```

Then set `POSTGRES_PASSWORD` in `.env` to a random value, for example the output of `openssl rand -hex 24`. The password is only applied when the database is first created; to change it later, delete the database with `docker compose down -v` and start it again.

## Run

**Development.** The database runs in Docker; the API and web app run on your machine and reload on save:

```bash
docker compose up -d db
pnpm dev
```

The web app is at http://localhost:5173 and forwards `/api` requests to the API on port 3000. Stop the dev servers with Ctrl+C and the database with `docker compose stop db`.

**Everything in containers** (production-style build):

```bash
docker compose up -d --build
```

Open http://localhost:8080. Stop with `docker compose down`. `docker compose down -v` also deletes the database.

## Commands

| Command             | What it does                                           |
| ------------------- | ------------------------------------------------------ |
| `pnpm dev`          | Runs the API and web app with reload on save           |
| `pnpm typecheck`    | Type-checks and compiles all packages                  |
| `pnpm lint`         | Runs ESLint                                            |
| `pnpm format`       | Formats all files with Prettier                        |
| `pnpm format:check` | Checks formatting without changing files               |
| `pnpm test`         | Builds, then runs all tests once                       |
| `pnpm test:watch`   | Reruns tests on every save                             |
| `pnpm build`        | Production build of all packages                       |
| `pnpm clean`        | Removes all build output; use when builds behave oddly |
