#!/bin/bash
# START_FETCH.sh - Helper script to start tweet fetching safely

echo "============================================================"
echo "STARTING TWEET FETCH"
echo "============================================================"
echo ""
echo "This will:"
echo "  - Fetch ALL tweets from @OPChoudhary_Ind"
echo "  - Handle rate limits automatically (waits when needed)"
echo "  - Take 2-5 hours (Twitter free tier limits)"
echo "  - Save progress to database continuously"
echo "  - Can be interrupted (Ctrl+C) and resumed"
echo ""
echo "Choose option:"
echo "  1) Run in FOREGROUND (see live logs, can't close terminal)"
echo "  2) Run in BACKGROUND (logs to file, can close terminal)"
echo "  3) TEST MODE (fetch only 5 batches/500 tweets)"
echo ""
read -p "Enter choice (1/2/3): " choice

cd /Users/abhijita/Projects/Project_Dhruv
source .venv/bin/activate

case $choice in
    1)
        echo ""
        echo "Starting in foreground..."
        echo "Press Ctrl+C to stop (progress will be saved)"
        echo ""
        python scripts/fetch_tweets_safe.py --handle OPChoudhary_Ind
        ;;
    2)
        echo ""
        echo "Starting in background..."
        nohup python scripts/fetch_tweets_safe.py --handle OPChoudhary_Ind > fetch_tweets.log 2>&1 &
        PID=$!
        echo "✓ Started with PID: $PID"
        echo ""
        echo "Monitor progress:"
        echo "  tail -f fetch_tweets.log"
        echo ""
        echo "Check database:"
        echo "  python check_tweets.py"
        echo ""
        echo "Stop fetch:"
        echo "  kill $PID"
        echo ""
        ;;
    3)
        echo ""
        echo "TEST MODE: Fetching first 5 batches (500 tweets max)..."
        echo ""
        python scripts/fetch_tweets_safe.py --handle OPChoudhary_Ind --max-batches 5
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

