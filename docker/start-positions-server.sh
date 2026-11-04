#!/bin/sh
# Runs before nginx starts (the image runs /docker-entrypoint.d/*.sh): starts the position store
# next to it, and starts it again should it ever stop.
(
  while true; do
    node /app/server/main.mjs
    echo "invi positions: stopped, starting again in 5 s" >&2
    sleep 5
  done
) &
