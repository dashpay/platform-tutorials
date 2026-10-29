#!/usr/bin/env bash
# Regenerates landing-preview.html at the repo root by running the same
# discover + build steps the GitHub Pages workflow runs.
#
# Usage: ./preview-landing.sh
set -euo pipefail

cd "$(dirname "$0")"

metas=()
for pkg in example-apps/*/package.json; do
  [ -f "$pkg" ] || continue
  name="$(basename "$(dirname "$pkg")")"
  if jq -e '.scripts.build' "$pkg" >/dev/null; then
    metas+=("$(jq --arg name "$name" -c \
      '{name: $name, displayName: (.displayName // null), description: (.description // null)}' \
      "$pkg")")
  fi
done

if [ "${#metas[@]}" -eq 0 ]; then
  echo "No deployable apps found under example-apps/." >&2
  exit 1
fi

meta_json="$(printf '%s\n' "${metas[@]}" | jq -sc .)"
node .github/scripts/build-landing-page.mjs "$meta_json" landing-preview.html
