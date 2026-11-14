#!/usr/bin/env sh
cd "$(dirname "$0")" || exit 1
exec npm run dev -- --host 127.0.0.1 --port 8080 --strictPort --open
