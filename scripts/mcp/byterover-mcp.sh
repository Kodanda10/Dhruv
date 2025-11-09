#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if [[ -f "${REPO_ROOT}/.env.local" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "${REPO_ROOT}/.env.local"
  set +a
fi

if [[ -z "${BYTEROVER_MCP_TOKEN:-}" ]]; then
  echo "BYTEROVER_MCP_TOKEN is not set. Add it to .env.local or export it before starting Codex CLI." >&2
  exit 1
fi

exec npx -y mcp-remote \
  "https://mcp.byterover.dev/v2/mcp" \
  --header "Authorization: Bearer ${BYTEROVER_MCP_TOKEN}"
