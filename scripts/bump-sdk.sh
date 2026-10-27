#!/usr/bin/env bash
# Usage: bash scripts/bump-sdk.sh VERSION [--test]
# Example: bash scripts/bump-sdk.sh 4.2.0-dev.11 --test
set -euo pipefail

usage() { echo 'Usage: bash scripts/bump-sdk.sh VERSION [--test]'; }
if [[ "${1:-}" == -h || "${1:-}" == --help ]]; then usage; exit 0; fi
if (( $# < 1 || $# > 2 )) || [[ "${2:---test}" != --test ]]; then
  usage >&2
  exit 1
fi

cd "$(dirname "$0")/.."
shopt -s nullglob
pkg='@dashevo/evo-sdk'

# Let npm resolve published versions, including dev/RC releases and tags.
version="$(npm view "$pkg@${1#v}" version --json | jq -er '
  if type == "string" then . else error("specify one published SDK version") end
')"

dirs=() prefixes=() sections=() specs=()
for file in ./package.json example-apps/*/package.json; do
  entry="$(jq -r --arg p "$pkg" '
    ["dependencies", "devDependencies", "optionalDependencies"][] as $s
    | select(.[$s][$p] != null) | [$s, .[$s][$p]] | @tsv
  ' "$file")"
  [ -n "$entry" ] || continue
  if [[ "$entry" == *$'\n'* ]]; then
    echo "error: multiple SDK declarations in $file" >&2
    exit 1
  fi
  IFS=$'\t' read -r section spec <<<"$entry"
  if [[ ! "$spec" =~ ^([~^]?)[0-9][0-9A-Za-z.+-]*$ ]]; then
    echo "error: unsupported SDK range '$spec' in $file" >&2
    exit 1
  fi
  dirs+=("${file%/package.json}")
  prefixes+=("${BASH_REMATCH[1]}")
  sections+=("$section")
  specs+=("$spec")
done

for i in "${!dirs[@]}"; do
  # Repair lite imports even when installation is skipped; dist/ is build output.
  for page in "${dirs[i]}"/public/*-lite.html; do
    sed -E "s|(https://esm\.sh/@dashevo/evo-sdk@)[^'\"]+|\1${prefixes[i]}$version|g" "$page" >"$page.tmp"
    if cmp -s "$page" "$page.tmp"; then
      unlink "$page.tmp"
    else
      mv "$page.tmp" "$page"
      echo "Updated lite import: $page"
    fi
  done
  lock="${dirs[i]}/package-lock.json"
  if [[ "${specs[i]}" == "${prefixes[i]}$version" && -f "$lock" ]] &&
    locked="$(jq -er --arg p "$pkg" '
      .packages["node_modules/" + $p].version // .dependencies[$p].version // empty
    ' "$lock")" && [[ "$locked" == "$version" ]]; then
    echo "Already matching: ${dirs[i]} (${prefixes[i]}$version)"
    continue
  fi
  case "${sections[i]}" in
    dependencies) save=--save-prod ;;
    devDependencies) save=--save-dev ;;
    optionalDependencies) save=--save-optional ;;
  esac
  echo "Updating ${dirs[i]} to ${prefixes[i]}$version"
  (cd "${dirs[i]}" && npm install "$pkg@$version" "$save" \
    --save-exact=false --save-prefix="${prefixes[i]}")
done

# Run every project's tests even if another project fails.
if [[ "${2:-}" == --test ]]; then
  status=0
  for dir in "${dirs[@]}"; do
    if jq -e '.scripts.test | type == "string"' "$dir/package.json" >/dev/null; then
      echo "Testing $dir"
      if ! (cd "$dir" && npm run test); then
        echo "Tests failed: $dir" >&2
        status=1
      fi
    else
      echo "Skipping tests: $dir (no test script)"
    fi
  done
  exit "$status"
fi
