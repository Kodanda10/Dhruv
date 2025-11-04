#!/bin/bash
#
# Setup Cron Job for Incremental Tweet Fetching
#
# This script sets up a cron job to fetch new tweets every 1-2 hours
# Run this script once to set up the cron job

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FETCH_SCRIPT="$SCRIPT_DIR/fetch_new_tweets_incremental.py"
CRON_LOG="$PROJECT_ROOT/logs/cron_fetch.log"

# Create logs directory if it doesn't exist
mkdir -p "$PROJECT_ROOT/logs"

# Get Python path (use python3)
PYTHON_CMD=$(which python3)

if [ -z "$PYTHON_CMD" ]; then
    echo "❌ Error: python3 not found in PATH"
    exit 1
fi

# Check if fetch script exists
if [ ! -f "$FETCH_SCRIPT" ]; then
    echo "❌ Error: Fetch script not found at $FETCH_SCRIPT"
    exit 1
fi

echo "Setting up cron job for incremental tweet fetching..."
echo ""
echo "Options:"
echo "1. Every 1 hour"
echo "2. Every 2 hours"
echo ""
read -p "Select option (1 or 2): " option

case $option in
    1)
        CRON_SCHEDULE="0 * * * *"  # Every hour at minute 0
        INTERVAL="1 hour"
        ;;
    2)
        CRON_SCHEDULE="0 */2 * * *"  # Every 2 hours
        INTERVAL="2 hours"
        ;;
    *)
        echo "❌ Invalid option. Using default: every 2 hours"
        CRON_SCHEDULE="0 */2 * * *"
        INTERVAL="2 hours"
        ;;
esac

# Build cron command
# Note: --parse flag enables parsing with Gemini rate limit protection (6s delay = 10 RPM)
# Adjust --parse-delay if using Gemini Pro (12s = 5 RPM) or paid tier (can reduce delay)
CRON_CMD="$CRON_SCHEDULE cd $PROJECT_ROOT && $PYTHON_CMD $FETCH_SCRIPT --max-tweets 100 --parse --parse-delay 6.0 >> $CRON_LOG 2>&1"

# Check if cron job already exists
CRON_EXISTS=$(crontab -l 2>/dev/null | grep -F "$FETCH_SCRIPT" || true)

if [ -n "$CRON_EXISTS" ]; then
    echo ""
    echo "⚠️  Cron job already exists:"
    echo "$CRON_EXISTS"
    echo ""
    read -p "Replace existing cron job? (y/n): " replace
    
    if [ "$replace" = "y" ]; then
        # Remove existing cron job
        crontab -l 2>/dev/null | grep -v "$FETCH_SCRIPT" | crontab -
        echo "✓ Removed existing cron job"
    else
        echo "Keeping existing cron job. Exiting."
        exit 0
    fi
fi

# Add new cron job
(crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -

echo ""
echo "✅ Cron job set up successfully!"
echo ""
echo "Schedule: Every $INTERVAL"
echo "Command: $PYTHON_CMD $FETCH_SCRIPT --max-tweets 100"
echo "Log file: $CRON_LOG"
echo ""
echo "To view current cron jobs: crontab -l"
echo "To remove this cron job: crontab -e (then delete the line)"
echo ""

