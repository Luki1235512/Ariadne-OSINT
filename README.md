# Ariadne-OSINT

Web app for exploring connected public data.

## Requirements

- Node.js 26. The version is pinned in `.nvmrc`, so with a version manager such as [fnm](https://github.com/Schniz/fnm) or nvm you can run `fnm use` or `nvm use` in the repo folder.
- pnpm 12.14.0. The exact version is pinned in the `packageManager` field of `package.json`.

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

## Run

The web app imports the shared package from its compiled output, so build once before starting it:

```bash
pnpm typecheck
pnpm -C apps/web dev
```

Then open the URL it prints (usually http://localhost:5173).

## Checks

| Command             | What it does                             |
| ------------------- | ---------------------------------------- |
| `pnpm typecheck`    | Type-checks and compiles all packages    |
| `pnpm lint`         | Runs ESLint                              |
| `pnpm format`       | Formats all files with Prettier          |
| `pnpm format:check` | Checks formatting without changing files |
| `pnpm test`         | Builds, then runs all tests once         |
|                     |
