#!/usr/bin/env bash

set -euo pipefail

wallet_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$wallet_dir/../.." && pwd)"

usage() {
  echo "Usage: $0 prepare-run <NNNN> | prepare-handoff <NNNN> | verify <NNNN>" >&2
  exit 2
}

[[ $# -eq 2 ]] || usage
action="$1"
run_id="$2"

if [[ ! "$run_id" =~ ^[0-9]{4}$ ]]; then
  echo "Run ID must be exactly four digits, for example 0002." >&2
  exit 2
fi

run_dir="$wallet_dir/runs/$run_id"

case "$action" in
  prepare-run)
    if [[ -e "$run_dir" ]]; then
      echo "Run already exists: $run_dir" >&2
      exit 1
    fi
    mkdir -p \
      "$run_dir/builder/implementation" \
      "$run_dir/builder/tests" \
      "$run_dir/handoff" \
      "$run_dir/adversary/tests" \
      "$run_dir/adversary/evidence"
    cp "$repo_dir/agents/run-record.md" "$run_dir/run-record.md"
    cp "$repo_dir/agents/coordinator-report.md" "$run_dir/coordinator-report.md"
    echo "Prepared run $run_id at $run_dir"
    ;;

  prepare-handoff)
    builder_dir="$run_dir/builder/implementation"
    handoff_dir="$run_dir/handoff/implementation"
    if [[ ! -d "$builder_dir" ]] || [[ -z "$(find "$builder_dir" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
      echo "Builder implementation is missing or empty: $builder_dir" >&2
      exit 1
    fi
    if [[ -e "$handoff_dir" ]]; then
      echo "Handoff already exists; refusing to overwrite: $handoff_dir" >&2
      exit 1
    fi
    mkdir -p "$handoff_dir"
    cp -R "$builder_dir"/. "$handoff_dir"/
    echo "Prepared sanitized handoff at $handoff_dir"
    ;;

  verify)
    required=(
      "$run_dir/run-record.md"
      "$run_dir/coordinator-report.md"
      "$run_dir/builder/implementation"
      "$run_dir/adversary"
    )
    for path in "${required[@]}"; do
      if [[ ! -e "$path" ]]; then
        echo "Missing required path: $path" >&2
        exit 1
      fi
    done
    echo "Run $run_id has the required base structure."
    ;;

  *)
    usage
    ;;
esac
