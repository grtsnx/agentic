# syntax=docker/dockerfile:1.7

# LiveKit RTC ships glibc bindings; Alpine/musl cannot load them.
FROM oven/bun:1.4.3@sha256:ec06c3b6cea04192ae6770c434f668ca41d343ad19fa6472216c7b48be39c598 AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN --mount=type=cache,id=agentic-bun,target=/root/.bun/install/cache,sharing=locked bun install --frozen-lockfile

FROM dependencies AS build
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN bun run build

FROM oven/bun:1.4.3@sha256:ec06c3b6cea04192ae6770c434f668ca41d343ad19fa6472216c7b48be39c598 AS production-dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN --mount=type=cache,id=agentic-bun,target=/root/.bun/install/cache,sharing=locked bun install --frozen-lockfile --production

FROM node:26.12.1-bookworm-slim@sha256:28147155d47dc31abe0a46e0d12b59b2fb3d0a2dcc5dc65fce76a074180b16fe AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

# Apply available OS fixes and remove npm from the runtime attack surface.
# The application starts with node and never installs packages at runtime.
RUN apt-get update \
  && apt-get upgrade -y \
  && apt-get install -y --no-install-recommends ca-certificates libstdc++6 \
  && rm -rf /var/lib/apt/lists/* \
  && rm -rf /usr/local/lib/node_modules/npm \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./package.json

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/v1/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "--enable-source-maps", "dist/main.js"]
