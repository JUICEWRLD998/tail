#!/usr/bin/env bash
# Pre-push secret and hygiene check. Exits non-zero on a finding. Run: npm run check:push
set -u
fail=0
note() { echo "FAIL: $*"; fail=1; }

# 1. Files that must never be tracked.
for p in data keys .env; do
  if git ls-files --error-unmatch "$p" >/dev/null 2>&1 || [ -n "$(git ls-files "$p/" 2>/dev/null)" ]; then note "tracked path: $p"; fi
done
if git ls-files | grep -E '\.(db|db-shm|db-wal|sqlite)$' | grep -q .; then note "tracked database file"; fi

# 2. Secret patterns in tracked files (allowlist: public test vectors and fixtures).
files=$(git ls-files -- . ':!package-lock.json' ':!.claude/skills')
if echo "$files" | xargs grep -n -E '[0-9]{8,10}:AA[A-Za-z0-9_-]{30,}' 2>/dev/null | grep -q .; then note "Telegram bot token pattern"; fi
if echo "$files" | xargs grep -n -E 'BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY' 2>/dev/null | grep -q .; then note "PEM private key"; fi
if echo "$files" | xargs grep -n -E 'sk-or-[A-Za-z0-9_-]{20,}' 2>/dev/null | grep -q .; then note "OpenRouter key pattern"; fi
# Any value actually set in this environment must not appear in tracked files.
for v in TELEGRAM_BOT_TOKEN TAIL_KEK SPIKE_API_PRIV OPENROUTER_API_KEY; do
  val="${!v:-}"
  if [ -n "$val" ] && echo "$files" | xargs grep -F -l -- "$val" 2>/dev/null | grep -q .; then note "$v value found in a tracked file"; fi
done
# 64-hex strings: allow the RFC 8032 vector, the empty-string sha256 and the public keys named in docs.
hex=$(echo "$files" | xargs grep -n -o -E '\b[0-9a-f]{64}\b' 2>/dev/null \
  | grep -v -E 'e3b0c442|9d61b19d|d75a9801|e5564300|3ed624d5|c7d4b196' || true)
if [ -n "$hex" ]; then echo "$hex" | head -5; note "unexplained 64-hex string(s): review, then extend the allowlist only for public values"; fi

[ "$fail" = 0 ] && echo "prepush-check: clean"
exit "$fail"
