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

failed=()

for script in "${root_scripts[@]}"; do
  echo "=== root $script"
  npm run "$script" || failed+=("root:$script")
done

for app in example-apps/*/; do
  [ -f "$app/package.json" ] || continue
  for script in "${app_scripts[@]}"; do
    jq -e --arg s "$script" '.scripts[$s]' "$app/package.json" >/dev/null || continue
    echo "=== $app $script"
    (cd "$app" && npm run "$script") || failed+=("$app:$script")
  done
done

[ ${#failed[@]} -eq 0 ] || printf 'Failed:\n  %s\n' "${failed[@]}"
exit $(( ${#failed[@]} > 0 ))
