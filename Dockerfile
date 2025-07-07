# syntax=docker/dockerfile:1

FROM node:18 AS base
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile

FROM base AS http-backend-build
RUN pnpm --filter http-backend... build

FROM base AS ws-backend-build
RUN pnpm --filter ws-backend... build

FROM base AS web-build
RUN pnpm --filter web... build

FROM node:18-slim AS http-backend
WORKDIR /app
ENV NODE_ENV=production
COPY --from=http-backend-build /repo/apps/http-backend/dist ./dist
COPY --from=http-backend-build /repo/apps/http-backend/package.json ./package.json
COPY --from=http-backend-build /repo/node_modules ./node_modules
EXPOSE 3001
CMD ["sh", "-c", "npm run migrate && npm run start"]

FROM node:18-slim AS ws-backend
WORKDIR /app
ENV NODE_ENV=production
COPY --from=ws-backend-build /repo/apps/ws-backend/dist ./dist
COPY --from=ws-backend-build /repo/apps/ws-backend/package.json ./package.json
COPY --from=ws-backend-build /repo/node_modules ./node_modules
EXPOSE 8081
CMD ["node", "dist/index.js"]

FROM node:18-slim AS web
WORKDIR /app
ENV NODE_ENV=production
COPY --from=web-build /repo/apps/web/.next ./.next
COPY --from=web-build /repo/apps/web/package.json ./package.json
COPY --from=web-build /repo/apps/web/public ./public
COPY --from=web-build /repo/node_modules ./node_modules
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]