#!/usr/bin/env bash
#
# Run the repo's test suites: the root suites, then every example app that
# defines the scripts being run. Keeps going after a failure and reports which
# suites failed; exits 1 if any did.
#
# By default runs all non-write tests: the root read-only/version/lite suites,
# the root setupDashClient suite, and each app's unit tests.
#
#   --e2e   also run each app's Playwright e2e suite (does not install browsers)
#   --all   everything, including the root read-write tests and e2e
#
# Note: --all and --e2e write to testnet. They spend credits and register new
# on-chain state (identities, contracts, documents, tokens, names) that cannot
# be reclaimed; some app e2e specs perform writes too.

cd "$(dirname "$0")/.."

root_scripts=(test test:setup)
app_scripts=(test)

for arg in "$@"; do
  case "$arg" in
    --e2e)
      app_scripts=(test test:e2e)
      ;;
    --all)
      root_scripts=(test:all test:setup)
      app_scripts=(test test:e2e)
      ;;
    *)
      echo "unknown option: $arg" >&2
      exit 2
      ;;
  esac
done

command -v jq >/dev/null || { echo "jq is required" >&2; exit 2; }

failed=()

for script in "${root_scripts[@]}"; do
  echo "=== root $script"
  npm run "$script" || failed+=("root:$script")
done

for app in example-apps/*/; do
  [ -f "$app/package.json" ] || continue
  for script in "${app_scripts[@]}"; do
    # An absent script is skipped; a present but non-string/blank one is a
    # failure; a jq error means package.json itself is broken.
    status=$(jq -r --arg s "$script" '
      (.scripts // {}) as $all
      | if ($all | has($s) | not) then "absent"
        elif ($all[$s] | type) == "string" and ($all[$s] | test("\\S")) then "valid"
        else "invalid" end' "$app/package.json") || status=error
    case $status in
      valid) ;;
      absent) continue ;;
      invalid) failed+=("$app:$script (invalid script)"); continue ;;
      *) failed+=("$app:package.json"); break ;;
    esac
    echo "=== $app $script"
    (cd "$app" && npm run "$script") || failed+=("$app:$script")
  done
done

[ ${#failed[@]} -eq 0 ] || printf 'Failed:\n  %s\n' "${failed[@]}"
exit $(( ${#failed[@]} > 0 ))
