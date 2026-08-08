# syntax=docker/dockerfile:1

FROM oven/bun:1 AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN bun run build

FROM rust:1-trixie AS rust-builder
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends cmake \
  && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY rust ./rust

RUN cargo build --release -p kreuzakt-kreuzberg

FROM oven/bun:1 AS runner
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV KREUZAKT_KREUZBERG_CLI=/app/bin/kreuzakt-kreuzberg
# Single mount point: ingest, originals, thumbnails, and DB default under /data/
ENV DATA_DIR=/data

COPY --from=builder --chown=bun:bun /app/public ./public
COPY --from=rust-builder --chown=bun:bun /app/target/release/kreuzakt-kreuzberg ./bin/kreuzakt-kreuzberg

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=bun:bun /app/.next/standalone ./
COPY --from=builder --chown=bun:bun /app/.next/static ./.next/static

COPY --from=deps --chown=bun:bun /app/node_modules/sharp ./node_modules/sharp
COPY --from=deps --chown=bun:bun /app/node_modules/@img ./node_modules/@img

# Seed /data for named volumes (Docker copies image ownership on first use).
# Bind mounts still need the entrypoint chown — VOLUME alone cannot fix those.
RUN mkdir -p /data && chown bun:bun /data
VOLUME /data

COPY docker-entrypoint.sh /usr/local/bin/kreuzakt-entrypoint.sh
RUN chmod +x /usr/local/bin/kreuzakt-entrypoint.sh

# Start as root so the entrypoint can fix bind-mount ownership, then drop to bun.
ENTRYPOINT ["/usr/local/bin/kreuzakt-entrypoint.sh"]

# Bun as PID 1 receives SIGTERM from `docker stop`; allow time via `docker stop --time` / compose stop_grace_period.
STOPSIGNAL SIGTERM

EXPOSE 3000

CMD ["bun", "server.js"]
