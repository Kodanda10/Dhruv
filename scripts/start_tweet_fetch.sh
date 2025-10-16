#!/bin/bash
# Start tweet fetching in background with logging

LOG_FILE="logs/tweet_fetch_$(date +%Y%m%d_%H%M%S).log"

# Create logs directory if it doesn't exist
mkdir -p logs

echo "=========================================="
echo "Starting Tweet Fetch for @OPChoudhary_Ind"
echo "=========================================="
echo ""
echo "This will take approximately 5 hours"
echo "Progress will be logged to: $LOG_FILE"
echo ""
echo "To monitor progress:"
echo "  tail -f $LOG_FILE"
echo ""
echo "To stop: Press Ctrl+C"
echo ""
echo "Starting in 5 seconds..."
sleep 5

# Activate venv and run fetch
source .venv/bin/activate
python scripts/fetch_tweets.py \
    --handle OPChoudhary_Ind \
    --since 2023-12-01 \
    --until 2025-10-31 \
    2>&1 | tee "$LOG_FILE"

echo ""
echo "=========================================="
echo "Tweet fetch completed!"
echo "Check database for results"
echo "=========================================="

