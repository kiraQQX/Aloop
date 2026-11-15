#!/usr/bin/env sh
cd "$(dirname "$0")" || exit 1
# Let Vite pick the next free port instead of aborting when 8080 is busy.
exec npm run dev -- --host 127.0.0.1 --port 8080 --open
