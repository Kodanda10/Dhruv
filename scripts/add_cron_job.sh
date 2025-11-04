#!/bin/bash
#
# Add Cron Job Manually (if setup script doesn't work)
# This creates the cron entry directly

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FETCH_SCRIPT="$SCRIPT_DIR/fetch_new_tweets_incremental.py"
CRON_LOG="$PROJECT_ROOT/logs/cron_fetch.log"

# Create logs directory
mkdir -p "$PROJECT_ROOT/logs"

# Get Python path
PYTHON_CMD=$(which python3)

if [ -z "$PYTHON_CMD" ]; then
    echo "❌ Error: python3 not found"
    exit 1
fi

# Cron command - runs every 2 hours
CRON_CMD="0 */2 * * * cd $PROJECT_ROOT && $PYTHON_CMD $FETCH_SCRIPT --max-tweets 100 --parse --parse-delay 6.0 >> $CRON_LOG 2>&1"

echo "Cron job command to add:"
echo "----------------------------------------"
echo "$CRON_CMD"
echo "----------------------------------------"
echo ""
echo "To add this manually, run:"
echo "  crontab -e"
echo ""
echo "Then paste this line:"
echo "  $CRON_CMD"
echo ""
echo "Or run this command:"
echo "  (crontab -l 2>/dev/null; echo \"$CRON_CMD\") | crontab -"
echo ""

read -p "Add cron job automatically? (y/n): " confirm
if [ "$confirm" = "y" ]; then
    (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
    echo "✅ Cron job added successfully!"
    echo ""
    echo "Current cron jobs:"
    crontab -l | grep -E "fetch_new_tweets|parse" || echo "  (none found)"
else
    echo "⚠️  Skipped. Add manually using the command above."
fi

