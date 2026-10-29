#!/usr/bin/env bash
# Builds every example-apps/<app> with a "build" script, copies each dist/
# into <out>/<app>/, and writes <out>/index.html from build-landing-page.mjs.
# Mirrors .github/workflows/deploy-example-apps.yml but for local + IPFS use:
# uses VITE_BASE_PATH=./ so generated asset URLs are relative and resolve
# correctly under any CID prefix (e.g. gateway.mesh3.network/ipfs/<cid>/).
#
# Usage: ./scripts/build-tutorials-site.sh [out-dir]
# Default out-dir: ../dash-platform-website/sites/site-test-tutorials/test
set -euo pipefail

cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"
OUT_DIR="${1:-$REPO_ROOT/../dash-platform-website/sites/site-test-tutorials/test}"
mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"

metas=()
apps=()
for pkg in example-apps/*/package.json; do
  [ -f "$pkg" ] || continue
  name="$(basename "$(dirname "$pkg")")"
  jq -e '.scripts.build' "$pkg" >/dev/null || continue
  apps+=("$name")
  metas+=("$(jq --arg name "$name" -c \
    '{name: $name, displayName: (.displayName // null), description: (.description // null)}' \
    "$pkg")")
done

if [ "${#apps[@]}" -eq 0 ]; then
  echo "No deployable apps found under example-apps/." >&2
  exit 1
fi

# Note: this script does NOT wipe $OUT_DIR. Files are overwritten in place.
# If you renamed/removed an app, delete the stale subdir under $OUT_DIR yourself
# before running, or DWT will keep treating it as a page.

for app in "${apps[@]}"; do
  echo "Building $app"
  (cd "example-apps/$app" && VITE_BASE_PATH=./ npm run build)
  mkdir -p "$OUT_DIR/$app"
  cp -r "example-apps/$app/dist/." "$OUT_DIR/$app/"
done

meta_json="$(printf '%s\n' "${metas[@]}" | jq -sc .)"
node .github/scripts/build-landing-page.mjs "$meta_json" "$OUT_DIR/index.html"

echo
echo "Built ${#apps[@]} app(s) into $OUT_DIR"
