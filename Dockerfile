# Debian rather than Alpine on purpose: sqlite3 ships prebuilt bindings for
# glibc, and on musl it has to be compiled from source on every build.

# --- backend dependencies -------------------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app

# Only needed if no prebuilt sqlite3 binding matches this platform.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- dashboard build ------------------------------------------------------
FROM node:22-bookworm-slim AS dashboard
WORKDIR /app/dashboard

# The build host injects NODE_ENV=production, which makes npm skip the
# devDependencies this stage builds with (typescript, vite, tailwind).
ENV NODE_ENV=development

COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci --include=dev

COPY dashboard/ ./
RUN npm run build

# --- runtime --------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    # Must listen on every interface: the proxy reaches the container by its
    # service name, not on the loopback address.
    WEB_HOST=0.0.0.0 \
    WEB_PORT=3000

COPY --from=deps /app/node_modules ./node_modules
COPY --from=dashboard /app/dashboard/dist ./dashboard/dist
COPY package.json ./
COPY src ./src

# Database and OAuth tokens live here; mount a volume on it.
RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.WEB_PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--no-deprecation", "src/index.js"]
