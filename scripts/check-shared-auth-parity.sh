#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dashnote="$repo_root/example-apps/dashnote/src"
token_ops="$repo_root/example-apps/token-ops/src"
dashnote_tests="$repo_root/example-apps/dashnote/test"
token_ops_tests="$repo_root/example-apps/token-ops/test"

cmp "$dashnote/dash/loginWithPrivateKey.ts" "$token_ops/dash/loginWithPrivateKey.ts"
cmp "$dashnote/lib/detectSecretShape.ts" "$token_ops/lib/detectSecretShape.ts"
cmp "$dashnote/session/keyManagerFromKey.ts" "$token_ops/session/keyManagerFromKey.ts"
cmp "$dashnote_tests/loginWithPrivateKey.test.ts" "$token_ops_tests/loginWithPrivateKey.test.ts"

echo "Shared Dashnote/TokenOps authentication files and resolver tests are byte-identical."
