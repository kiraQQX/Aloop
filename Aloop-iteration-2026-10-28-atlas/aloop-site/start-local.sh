#!/usr/bin/env sh
cd "$(dirname "$0")" || exit 1
python3 -m http.server 8080 --bind 127.0.0.1
