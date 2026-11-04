#!/bin/sh
# Runs before nginx starts (the image runs /docker-entrypoint.d/*.sh); stops the container without its settings.
for setting in INVIDIOUS_URL INVIDIOUS_PUBLIC_URL; do
  if [ -z "$(printenv "$setting")" ]; then
    echo "invi: $setting is not set; see the README." >&2
    exit 1
  fi
done
