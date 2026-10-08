#!/usr/bin/env bash
set -Eeuo pipefail

cleanup_required=0
compose_down_subcommand=down
compose_ps_subcommand=ps

cleanup() {
  local exit_code=$?

  set +e
  if [[ "${cleanup_required}" -eq 1 ]]; then
    docker compose "${compose_down_subcommand}"
    docker compose "${compose_ps_subcommand}"
  fi

  exit "${exit_code}"
}

run() {
  printf '\n==>'
  printf ' %q' "$@"
  printf '\n'
  "$@"
}

trap cleanup EXIT

run docker compose config --quiet
cleanup_required=1
run docker compose up -d --build
run docker compose ps
run docker compose exec app npm run db:validate
run docker compose exec app npm run db:generate
run docker compose exec app npm run test
run docker compose exec app npm run lint
run docker compose exec app npm run typecheck
run docker compose exec app npm run build
run curl --fail http://127.0.0.1:3000/
run docker compose down
cleanup_required=0
run docker compose ps
