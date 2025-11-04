# Manual Cron Job Setup Instructions

## Why Manual Setup?

If the automated setup script fails due to permissions, follow these manual steps:

## Step 1: Open Crontab Editor

```bash
crontab -e
```

## Step 2: Add This Line

Add the following line to your crontab (choose your preferred interval):

### Every 2 Hours (Recommended)
```bash
0 */2 * * * cd /Users/abhijita/Projects/Project_Dhruv && python3 scripts/fetch_new_tweets_incremental.py --max-tweets 100 --parse --parse-delay 6.0 >> logs/cron_fetch.log 2>&1
```

### Every 1 Hour
```bash
0 * * * * cd /Users/abhijita/Projects/Project_Dhruv && python3 scripts/fetch_new_tweets_incremental.py --max-tweets 100 --parse --parse-delay 6.0 >> logs/cron_fetch.log 2>&1
```

## Step 3: Save and Exit

- **nano/vim:** Press `Ctrl+X`, then `Y`, then `Enter`
- **emacs:** Press `Ctrl+X Ctrl+S`, then `Ctrl+X Ctrl+C`

## Step 4: Verify

```bash
crontab -l | grep fetch_new_tweets
```

Should show your cron job entry.

## Step 5: Monitor Logs

```bash
tail -f logs/cron_fetch.log
```

## Troubleshooting

### Permission Denied
If you get "Operation not permitted", you may need to:
1. Grant Terminal Full Disk Access in System Preferences
2. Or use `sudo crontab -e` (not recommended for user cron)

### Python Not Found
Replace `python3` with full path:
```bash
which python3
# Then use the full path in cron job
```

### Logs Not Created
Ensure the `logs/` directory exists:
```bash
mkdir -p logs
```

## Test Before Deploying

Test the command manually first:
```bash
cd /Users/abhijita/Projects/Project_Dhruv
python3 scripts/fetch_new_tweets_incremental.py --max-tweets 5 --parse --parse-delay 6.0
```

If this works, the cron job should work too.

