# Monorepo backend image for Railway (includes @voyr/shared)
FROM node:20-alpine AS builder

WORKDIR /app
ENV HUSKY=0

COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY shared ./shared
COPY backend/package.json ./backend/

RUN npm install --workspace=@voyr/backend --include-workspace-root

COPY backend/tsconfig.json ./backend/
COPY backend/src ./backend/src/

WORKDIR /app/shared
RUN npm run build

WORKDIR /app/backend
RUN npm run build

FROM node:20-alpine AS production

WORKDIR /app
ENV HUSKY=0

RUN addgroup -S voyr && adduser -S voyr -G voyr

COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY shared ./shared
COPY backend/package.json ./backend/

RUN npm install --workspace=@voyr/backend --include-workspace-root --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/src/db/migrations ./backend/src/db/migrations
COPY --from=builder /app/shared/dist ./shared/dist

WORKDIR /app/backend
USER voyr

ENV NODE_ENV=production
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3001}/health || exit 1

CMD ["node", "dist/index.js"]
