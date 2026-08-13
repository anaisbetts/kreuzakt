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

FROM oven/bun:1 AS runner
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Single mount point: ingest, originals, thumbnails, and DB default under /data/
ENV DATA_DIR=/data

COPY --from=builder --chown=bun:bun /app/public ./public

# Automatically leverage output traces to reduce image size
# https://next.js.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=bun:bun /app/.next/standalone ./
COPY --from=builder --chown=bun:bun /app/.next/static ./.next/static

COPY --from=deps --chown=bun:bun /app/node_modules/sharp ./node_modules/sharp
COPY --from=deps --chown=bun:bun /app/node_modules/@img ./node_modules/@img
# Xberg NAPI binary + bundled libonnxruntime/libheif live under @xberg-io/*
COPY --from=deps --chown=bun:bun /app/node_modules/@xberg-io ./node_modules/@xberg-io
# pdf-to-img pulls pdfjs-dist for on-demand PDF page renders (thumbnails / page images).
# pdfjs-dist's optional @napi-rs/canvas provides DOMMatrix / Node canvas; without it the
# instrumentation import chain crashes with ReferenceError: DOMMatrix is not defined.
COPY --from=deps --chown=bun:bun /app/node_modules/pdf-to-img ./node_modules/pdf-to-img
COPY --from=deps --chown=bun:bun /app/node_modules/pdfjs-dist ./node_modules/pdfjs-dist
COPY --from=deps --chown=bun:bun /app/node_modules/@napi-rs ./node_modules/@napi-rs
COPY --from=deps --chown=bun:bun /app/node_modules/node-readable-to-web-readable-stream ./node_modules/node-readable-to-web-readable-stream

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
