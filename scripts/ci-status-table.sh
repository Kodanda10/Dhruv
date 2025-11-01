#!/usr/bin/env bash
set -euo pipefail

# CI Status Table Display
# Displays CI job statuses, PR checks, and Vercel deployments in a formatted table

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
ORANGE='\033[0;33m'
NC='\033[0m' # No Color

# Function to get status color
get_status_color() {
  local status="$1"
  local conclusion="$2"
  local state="$3"

  # Handle GitHub Actions status
  if [ "$status" = "COMPLETED" ] || [ "$status" = "completed" ]; then
    if [ "$conclusion" = "SUCCESS" ] || [ "$conclusion" = "success" ]; then
      echo -n "$GREEN"
    elif [ "$conclusion" = "FAILURE" ] || [ "$conclusion" = "failure" ]; then
      echo -n "$RED"
    elif [ "$conclusion" = "CANCELLED" ] || [ "$conclusion" = "cancelled" ]; then
      echo -n "$YELLOW"
    else
      echo -n "$BLUE"
    fi
  elif [ "$status" = "IN_PROGRESS" ] || [ "$status" = "in_progress" ]; then
    echo -n "$CYAN"
  elif [ "$status" = "QUEUED" ] || [ "$status" = "queued" ]; then
    echo -n "$YELLOW"
  # Handle Vercel deployment states
  elif [ "$state" = "READY" ]; then
    echo -n "$GREEN"
  elif [ "$state" = "BUILDING" ] || [ "$state" = "PENDING" ]; then
    echo -n "$CYAN"
  elif [ "$state" = "ERROR" ]; then
    echo -n "$RED"
  elif [ "$state" = "CANCELED" ]; then
    echo -n "$YELLOW"
  else
    echo -n "$PURPLE"
  fi
}

# Function to format status text
format_status() {
  local status="$1"
  local conclusion="$2"
  local state="$3"

  # Handle GitHub Actions status
  if [ "$status" = "COMPLETED" ] || [ "$status" = "completed" ]; then
    case "$conclusion" in
      "SUCCESS"|"success") echo "✅ SUCCESS" ;;
      "FAILURE"|"failure") echo "❌ FAILED" ;;
      "CANCELLED"|"cancelled") echo "⏹️  CANCELLED" ;;
      "SKIPPED"|"skipped") echo "⏭️  SKIPPED" ;;
      *) echo "❓ $conclusion" ;;
    esac
  elif [ "$status" = "IN_PROGRESS" ] || [ "$status" = "in_progress" ]; then
    echo "⏳ RUNNING"
  elif [ "$status" = "QUEUED" ] || [ "$status" = "queued" ]; then
    echo "⏰ QUEUED"
  # Handle Vercel deployment states
  elif [ "$state" = "READY" ]; then
    echo "✅ DEPLOYED"
  elif [ "$state" = "BUILDING" ]; then
    echo "🔨 BUILDING"
  elif [ "$state" = "PENDING" ]; then
    echo "⏳ PENDING"
  elif [ "$state" = "ERROR" ]; then
    echo "❌ ERROR"
  elif [ "$state" = "CANCELED" ]; then
    echo "⏹️  CANCELLED"
  else
    echo "❓ $state"
  fi
}

# Get CI run ID
RUN_ID=$(gh run list --workflow "ironclad.yml" --limit 1 --json databaseId -q '.[0].databaseId' 2>/dev/null || echo "")

if [ -z "$RUN_ID" ]; then
  echo -e "${RED}❌ No CI runs found${NC}"
  exit 1
fi

# Get job data
JOBS_DATA=$(gh run view "$RUN_ID" --json jobs 2>/dev/null || echo "")

if [ -z "$JOBS_DATA" ]; then
  echo -e "${RED}❌ Unable to fetch job details${NC}"
  exit 1
fi

# Get PR data
PR_DATA=$(gh pr list --json number,title,headRefName,statusCheckRollup 2>/dev/null || echo "[]")
PR_COUNT=$(echo "$PR_DATA" | jq length)

# Get Vercel deployment data
VERCEL_DATA=""
if command -v vercel >/dev/null 2>&1; then
  # Try JSON first, fallback to human-readable format
  VERCEL_DATA=$(vercel ls --json 2>/dev/null || vercel ls 2>&1 | sed -n '/^  Age/,/^>/p' | grep -v '^  Age' | grep -v '^>' | head -5 || echo "")
fi

# Display header
echo -e "${BLUE}🚀 Complete CI/CD Status Dashboard${NC}"
echo -e "${BLUE}$(date)${NC}"
echo

# Table header
printf "%-25s %-15s %-15s %-20s\n" "SERVICE/CHECK" "STATUS" "DETAILS" "SOURCE"
printf "%-25s %-15s %-15s %-20s\n" "-------------" "------" "-------" "------"

# Parse and display CI jobs
echo "=== CI/CD PIPELINE ==="
echo "$JOBS_DATA" | jq -r '.jobs[] | "\(.name)|\(.status)|\(.conclusion // "pending")|CI/CD"' | while IFS='|' read -r name status conclusion source; do
  color=$(get_status_color "$status" "$conclusion" "")
  status_text=$(format_status "$status" "$conclusion" "")

  printf "%-25s ${color}%-15s${NC} %-15s %-20s\n" "$name" "$status_text" "$conclusion" "$source"
done

# Parse and display PR checks
if [ "$PR_COUNT" -gt 0 ]; then
  echo
  echo "=== PULL REQUEST CHECKS ==="
  echo "$PR_DATA" | jq -c '.[]' | while read -r pr; do
    PR_NUMBER=$(echo "$pr" | jq -r '.number')
    PR_TITLE=$(echo "$pr" | jq -r '.title')
    PR_BRANCH=$(echo "$pr" | jq -r '.headRefName')

    echo "PR #$PR_NUMBER: $PR_TITLE ($PR_BRANCH)"
    echo "$pr" | jq -r '.statusCheckRollup[] | "\(.name)|\(.status)|\(.conclusion // "pending")|\(.__typename)"' | while IFS='|' read -r name status conclusion source; do
      # Handle different source types
      if [ "$source" = "StatusContext" ]; then
        state=$(echo "$pr" | jq -r ".statusCheckRollup[] | select(.name==\"$name\") | .state")
        color=$(get_status_color "" "" "$state")
        status_text=$(format_status "" "" "$state")
        printf "  %-23s ${color}%-15s${NC} %-15s %-20s\n" "$name" "$status_text" "$state" "PR #$PR_NUMBER"
      else
        color=$(get_status_color "$status" "$conclusion" "")
        status_text=$(format_status "$status" "$conclusion" "")
        printf "  %-23s ${color}%-15s${NC} %-15s %-20s\n" "$name" "$status_text" "$conclusion" "PR #$PR_NUMBER"
      fi
    done
    echo
  done
else
  echo
  echo "=== PULL REQUEST CHECKS ==="
  echo "  No open pull requests found"
  echo
fi

# Parse and display Vercel deployments
if [ -n "$VERCEL_DATA" ]; then
  echo "=== VERCEL DEPLOYMENTS ==="
  # Check if it's JSON format or human-readable
  if echo "$VERCEL_DATA" | jq empty 2>/dev/null; then
    # JSON format
    echo "$VERCEL_DATA" | jq -r '.[] | "\(.name)|\(.state)|\(.url)|\(.createdAt)"' | head -5 | while IFS='|' read -r name state url created; do
      color=$(get_status_color "" "" "$state")
      status_text=$(format_status "" "" "$state")

      # Format created date
      if [[ "$created" =~ ^[0-9]+$ ]]; then
        created_date=$(date -r "$((created/1000))" '+%Y-%m-%d %H:%M' 2>/dev/null || echo "$created")
      else
        created_date="$created"
      fi

      printf "%-25s ${color}%-15s${NC} %-15s %-20s\n" "$name" "$status_text" "$created_date" "Vercel"
    done
  else
    # Human-readable format - parse the table rows
    echo "$VERCEL_DATA" | while IFS= read -r line; do
      # Skip empty lines and headers
      [ -z "$line" ] && continue
      [[ "$line" =~ ^[[:space:]]*$ ]] && continue

      # Parse the table row: Age, URL, Status, Environment, Duration, Username
      # Use awk to properly parse the fixed-width columns
      parsed=$(echo "$line" | awk '{
        age = $1
        # Find URL start
        for(i=2; i<=NF; i++) {
          if ($i ~ /^https:\/\//) {
            url_start = i
            break
          }
        }
        # Extract URL until we hit the status symbol
        url = ""
        for(i=url_start; i<=NF; i++) {
          if ($i ~ /^[●○✕]/) {
            status_start = i
            break
          }
          if (url != "") url = url " "
          url = url $i
        }
        # Extract status symbol and environment
        status_raw = $(status_start)
        environment = $(status_start + 1)

        print age "|" url "|" status_raw "|" environment
      }')

      IFS='|' read -r age url status_raw environment <<< "$parsed"

      # Skip if we don't have all required fields
      [ -z "$age" ] || [ -z "$url" ] || [ -z "$status_raw" ] && continue

      # Extract deployment name from URL
      name=$(echo "$url" | sed 's|https://||' | sed 's|-pinak.vercel.app||')

      # Map status symbols to our format
      case "$status_raw" in
        "●"|"Ready") status="Ready" ;;
        "○"|"Building") status="Building" ;;
        "✕"|"Error") status="Error" ;;
        "Canceled") status="Canceled" ;;
        *) status="$status_raw" ;;
      esac

      if [ -n "$name" ] && [ -n "$status" ]; then
        color=$(get_status_color "" "" "$status")
        status_text=$(format_status "" "" "$status")

        printf "%-25s ${color}%-15s${NC} %-15s %-20s\n" "$name" "$status_text" "$age ago" "Vercel ($environment)"
      fi
    done
  fi
else
  echo "=== VERCEL DEPLOYMENTS ==="
  echo "  Vercel CLI not available or no deployments found"
fi

echo
echo -e "${BLUE}💡 Use 'npm run ci:monitor' for continuous monitoring${NC}"
echo -e "${BLUE}💡 Use 'npm run ci:status' for this detailed status view${NC}"
