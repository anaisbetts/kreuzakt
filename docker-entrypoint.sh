#!/bin/sh
set -eu

# Ensure the data mount is writable by `bun` before dropping privileges.
# Compose bind-mounts often materialize as root:root; a VOLUME alone cannot
# fix that, so chown the mount point (not recursively) when needed.
DATA_DIR="${DATA_DIR:-/data}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"
  if ! setpriv --reuid=bun --regid=bun --init-groups -- test -w "$DATA_DIR"; then
    chown bun:bun "$DATA_DIR"
  fi
  exec setpriv --reuid=bun --regid=bun --init-groups -- "$0" "$@"
fi

# oven/bun entrypoint: prefix with bun when the command looks like a script/flag
if [ "${1#-}" != "${1}" ] || [ -z "$(command -v "${1}")" ] || {
  [ -f "${1}" ] && ! [ -x "${1}" ]
}; then
  set -- /usr/local/bin/bun "$@"
fi

exec "$@"
