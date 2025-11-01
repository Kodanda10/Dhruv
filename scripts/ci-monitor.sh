#!/usr/bin/env bash
set -euo pipefail

# CI Monitor Script for Ironclad CI
# Continuously monitors GitHub Actions CI status with notifications

# Configuration
INTERVAL=30  # Check every 30 seconds
NOTIFICATION_ENABLED=true
VERBOSE=true

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# State tracking
LAST_STATUS=""
LAST_RUN_ID=""

# Check if GitHub CLI is installed
if ! command -v gh >/dev/null 2>&1; then
  echo -e "${RED}Error: GitHub CLI (gh) not installed.${NC}"
  echo "Install from https://cli.github.com and re-run."
  exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo -e "${RED}Error: Not in a git repository.${NC}"
  exit 1
fi

# Function to get current CI status
get_ci_status() {
  # Get the latest workflow run
  local run_info
  run_info=$(gh run list --workflow "ironclad.yml" --limit 1 --json status,databaseId,conclusion,createdAt,updatedAt 2>/dev/null || echo "")

  if [ -z "$run_info" ] || [ "$run_info" = "[]" ]; then
    echo "NO_RUNS"
    return
  fi

  # Extract status and conclusion
  local status conclusion
  status=$(echo "$run_info" | jq -r '.[0].status' 2>/dev/null || echo "unknown")
  conclusion=$(echo "$run_info" | jq -r '.[0].conclusion' 2>/dev/null || echo "unknown")
  local run_id=$(echo "$run_info" | jq -r '.[0].databaseId' 2>/dev/null || echo "unknown")

  # Determine overall status
  case "$status" in
    "in_progress"|"queued")
      echo "RUNNING:$run_id"
      ;;
    "completed")
      if [ "$conclusion" = "success" ]; then
        echo "SUCCESS:$run_id"
      else
        echo "FAILED:$run_id"
      fi
      ;;
    *)
      echo "UNKNOWN:$run_id"
      ;;
  esac
}

# Function to get detailed job status
get_job_status() {
  local run_id="$1"
  if [ "$run_id" = "unknown" ] || [ -z "$run_id" ]; then
    echo "Unable to get job details"
    return
  fi

  local jobs
  jobs=$(gh run view "$run_id" --json jobs 2>/dev/null || echo "")

  if [ -z "$jobs" ]; then
    echo "No job details available"
    return
  fi

  echo "$jobs" | jq -r '.jobs[] | "\(.name): \(.status) (\(.conclusion // "pending"))"'
}

# Function to send notification
send_notification() {
  local message="$1"
  local title="$2"

  if [ "$NOTIFICATION_ENABLED" = true ]; then
    # Try to send system notification if terminal-notifier is available (macOS)
    if command -v terminal-notifier >/dev/null 2>&1; then
      terminal-notifier -title "$title" -message "$message" -sound default 2>/dev/null || true
    fi

    # Also print to console with timestamp
    echo -e "$(date '+%H:%M:%S') ${BLUE}NOTIFICATION:${NC} $title - $message"
  fi
}

# Function to display status
display_status() {
  local status="$1"
  local timestamp=$(date '+%H:%M:%S')

  case "$status" in
    "NO_RUNS")
      echo -e "$timestamp ${YELLOW}CI Status: No runs found${NC}"
      ;;
    RUNNING:*)
      local run_id="${status#RUNNING:}"
      echo -e "$timestamp ${BLUE}CI Status: ⏳ Running${NC} (Run ID: $run_id)"
      if [ "$VERBOSE" = true ]; then
        echo "Job Details:"
        get_job_status "$run_id" | sed 's/^/  /'
      fi
      ;;
    SUCCESS:*)
      local run_id="${status#SUCCESS:}"
      echo -e "$timestamp ${GREEN}CI Status: ✅ All Green${NC} (Run ID: $run_id)"
      ;;
    FAILED:*)
      local run_id="${status#FAILED:}"
      echo -e "$timestamp ${RED}CI Status: ❌ Failed${NC} (Run ID: $run_id)"
      if [ "$VERBOSE" = true ]; then
        echo "Failed Jobs:"
        get_job_status "$run_id" | grep -v "success" | sed 's/^/  /'
      fi
      ;;
    *)
      echo -e "$timestamp ${YELLOW}CI Status: ❓ Unknown${NC} ($status)"
      ;;
  esac
}

# Function to check status change and notify
check_and_notify() {
  local current_status="$1"

  # Skip notification for first run
  if [ -z "$LAST_STATUS" ]; then
    LAST_STATUS="$current_status"
    return
  fi

  # Check for status changes
  if [ "$current_status" != "$LAST_STATUS" ]; then
    case "$current_status" in
      SUCCESS:*)
        if [[ "$LAST_STATUS" == FAILED:* ]] || [[ "$LAST_STATUS" == RUNNING:* ]]; then
          send_notification "CI is now all green! ✅" "CI Status: Success"
        fi
        ;;
      FAILED:*)
        if [[ "$LAST_STATUS" == RUNNING:* ]] || [[ "$LAST_STATUS" == SUCCESS:* ]]; then
          send_notification "CI has failed! ❌ Check the details above." "CI Status: Failed"
        fi
        ;;
      RUNNING:*)
        if [[ "$LAST_STATUS" == SUCCESS:* ]] || [[ "$LAST_STATUS" == FAILED:* ]]; then
          send_notification "CI run has started" "CI Status: Running"
        fi
        ;;
    esac
    LAST_STATUS="$current_status"
  fi
}

# Main monitoring loop
echo -e "${BLUE}🚀 Starting CI Monitor for Ironclad CI${NC}"
echo -e "${BLUE}Checking status every ${INTERVAL} seconds...${NC}"
echo -e "${BLUE}Press Ctrl+C to stop monitoring${NC}"
echo

# Trap SIGINT for clean exit
trap 'echo -e "\n${BLUE}👋 CI Monitor stopped${NC}"; exit 0' INT

while true; do
  current_status=$(get_ci_status)
  display_status "$current_status"
  check_and_notify "$current_status"
  echo
  sleep "$INTERVAL"
done
