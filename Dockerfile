# ============================================================
# Stage 1 — "test": install all deps and run the test suite.
# The build fails here if any test fails, so a broken app
# can never become an image.
# ============================================================
FROM node:22-alpine AS test
WORKDIR /app

# Copy dependency manifests first to take advantage of layer caching
COPY package.json package-lock.json ./
RUN npm ci

COPY src ./src
COPY tests ./tests
RUN npm test

# ============================================================
# Stage 2 — "deps": production dependencies only
# ============================================================
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# `mkdir -p node_modules` guarantees the folder exists even when the project
# has zero runtime dependencies (npm ci does not create it in that case).
RUN npm ci --omit=dev \
 && mkdir -p node_modules \
 && npm cache clean --force

# ============================================================
# Stage 3 — "runtime": small final image, non-root user
# ============================================================
FROM node:22-alpine AS runtime

LABEL org.opencontainers.image.title="TaskPilot-WebApp" \
      org.opencontainers.image.description="Task management web app (REST API + UI) built with Node.js" \
      org.opencontainers.image.licenses="MIT"

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATA_DIR=/app/data

WORKDIR /app

# Copy only what the app needs at runtime
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node scripts/healthcheck.js ./scripts/healthcheck.js

# Data folder for the JSON database (mount a volume here to persist tasks)
RUN mkdir -p /app/data && chown node:node /app/data
VOLUME ["/app/data"]

# Run as the unprivileged "node" user that ships with the official image
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "scripts/healthcheck.js"]

# Exec form: node is PID 1 and receives SIGTERM directly → graceful shutdown
CMD ["node", "src/server.js"]
