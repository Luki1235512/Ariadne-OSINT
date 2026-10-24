FROM node:26-trixie-slim AS build
RUN npm install --global pnpm@12.14.0
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/ingest/package.json packages/ingest/
RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm exec tsc -b apps/api
RUN pnpm --filter @ariadne/api deploy --prod /out

FROM node:26-trixie-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out ./
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
