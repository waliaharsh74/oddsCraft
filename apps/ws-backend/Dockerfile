# syntax=docker/dockerfile:1

FROM node:20-slim AS base
ARG DATABASE_URL=postgresql://postgres:mypassword@postgres:5432/postgres
ENV DATABASE_URL=${DATABASE_URL}
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/ws-backend/package.json apps/ws-backend/
COPY packages/Db/package.json packages/Db/
COPY packages/common/package.json packages/common/
COPY packages/ui/package.json packages/ui/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/typescript-config/package.json packages/typescript-config/
RUN pnpm install --frozen-lockfile --filter ws-backend...

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter ws-backend... build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=builder /app/apps/ws-backend/dist ./dist
COPY --from=builder /app/apps/ws-backend/package.json ./package.json
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 8080
CMD ["node", "dist/index.js"]
