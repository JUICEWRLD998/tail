#!/bin/sh
# A mounted volume is usually root-owned. Make the database directory writable, then drop to the unprivileged user.
set -e
DB_DIR="$(dirname "${TAIL_DB:-/data/tail.db}")"
mkdir -p "$DB_DIR"
chown -R node:node "$DB_DIR" 2>/dev/null || true
exec setpriv --reuid=node --regid=node --init-groups "$@"
