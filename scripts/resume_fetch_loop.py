#!/usr/bin/env python3
"""
Checkpointed resume loop for safe tweet fetching.

Uses the existing `scripts/fetch_tweets_safe.py` script. After each cycle it
records progress to `.fetch_loop_state.json` so we can resume if the shell
dies. It queries `psql` on the `DATABASE_URL` found in `.env.local` to
determine the oldest tweet date and total count.

Usage: (run from repo root)
  source .venv/bin/activate
  python3 scripts/resume_fetch_loop.py --handle OPChoudhary_Ind --max-runs 12

This file intentionally does not add new external dependencies; it shells
out to `python3 scripts/fetch_tweets_safe.py` and `psql` which already exist
in the repo environment.
"""

import argparse
import json
import os
import shlex
import subprocess
from pathlib import Path

STATE_PATH = Path('.fetch_loop_state.json')
ENV_PATH = Path('.env.local')


def load_env_value(key):
    if not ENV_PATH.exists():
        return None
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if '=' not in line:
            continue
        k, v = line.split('=', 1)
        if k.strip() == key:
            return v.strip()
    return None


def psql_query(db_url, sql):
    # Run psql with the connection string as the first arg
    cmd = ['psql', db_url, '-t', '-c', sql]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f'psql failed: {res.stderr.strip()}')
    return res.stdout.strip()


def read_state():
    if STATE_PATH.exists():
        try:
            return json.loads(STATE_PATH.read_text())
        except Exception:
            return {}
    return {}


def write_state(state):
    STATE_PATH.write_text(json.dumps(state, indent=2))


def run_cycle(handle, batches, until_id=None):
    # Run the existing safe fetcher. If `until_id` is provided, pass it so the
    # API is asked to return only tweets older than that id (reduces overlap).
    cmd = ['python3', 'scripts/fetch_tweets_safe.py', '--handle', handle, '--max-batches', str(batches)]
    if until_id:
        cmd += ['--until-id', until_id]

    # capture output so we can surface useful info and avoid orphaned processes
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.stdout:
        print(proc.stdout)
    if proc.stderr:
        print(proc.stderr)
    return proc.returncode


def run_backward_window(handle, start_iso, end_iso, limit=500):
    """Run existing incremental fetcher for a backward time window.

    Uses `scripts/fetch_tweets.py --since <start> --until <end> --limit <n>`.
    start_iso and end_iso should be ISO 8601 timestamps.
    """
    cmd = [
        'python3',
        'scripts/fetch_tweets.py',
        '--handle', handle,
        '--since', start_iso,
        '--until', end_iso,
        '--limit', str(limit),
    ]
    print('Running:', ' '.join(shlex.quote(c) for c in cmd))
    proc = subprocess.Popen(cmd)
    proc.wait()
    return proc.returncode


def get_db_summary(db_url, handle):
    total = psql_query(db_url, f"SELECT COUNT(*) FROM raw_tweets WHERE author_handle='{handle}';")
    oldest = psql_query(db_url, f"SELECT to_char(MIN(created_at),'YYYY-MM-DD') FROM raw_tweets WHERE author_handle='{handle}';")
    newest = psql_query(db_url, f"SELECT to_char(MAX(created_at),'YYYY-MM-DD') FROM raw_tweets WHERE author_handle='{handle}';")
    return total.strip(), (oldest.strip() or None), (newest.strip() or None)


def get_db_oldest_id(db_url, handle):
    """Return the tweet_id of the oldest stored tweet for the handle, or None."""
    try:
        res = psql_query(db_url, f"SELECT tweet_id FROM raw_tweets WHERE author_handle='{handle}' ORDER BY created_at ASC LIMIT 1;")
        return res.strip() or None
    except Exception:
        return None


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--handle', required=True)
    p.add_argument('--max-runs', type=int, default=12)
    p.add_argument('--batches-per-run', type=int, default=5)
    p.add_argument('--target-date', default='2023-12-31')
    args = p.parse_args()

    db_url = load_env_value('DATABASE_URL')
    if not db_url:
        print('DATABASE_URL not found in .env.local')
        raise SystemExit(1)

    state = read_state()
    runs_done = state.get('runs_done', 0)

    print(f'Starting resume loop: handle={args.handle} runs_done={runs_done} max_runs={args.max_runs}')

    for i in range(runs_done + 1, args.max_runs + 1):
        print('\n' + '=' * 60)
        print(f'RUN {i} / {args.max_runs} — running {args.batches_per_run} batches')

        # snapshot DB before the run
        try:
            total_before, oldest_before, newest_before = get_db_summary(db_url, args.handle)
            oldest_id = get_db_oldest_id(db_url, args.handle)
            print(f'Before run {i}: total={total_before}, oldest={oldest_before}, newest={newest_before}, oldest_id={oldest_id}')
        except Exception as e:
            print(f'Error querying DB before run {i}: {e}')
            # still attempt to run a cycle without until-id
            oldest_id = None

        rc = run_cycle(args.handle, args.batches_per_run, until_id=oldest_id)
        print(f'fetch_tweets_safe.py exited with code {rc}')

        # Query DB after run
        try:
            total_after, oldest_after, newest_after = get_db_summary(db_url, args.handle)
            print(f'After run {i}: total={total_after}, oldest={oldest_after}, newest={newest_after}')
        except Exception as e:
            print(f'Error querying DB after run {i}: {e}')
            state.update({'runs_done': i})
            write_state(state)
            continue

        # compute inserted count
        try:
            inserted = int(total_after) - int(total_before)
        except Exception:
            inserted = None

        state.update({'runs_done': i, 'last_total': total_after, 'last_oldest': oldest_after, 'last_newest': newest_after})
        write_state(state)

        # if this run inserted zero new tweets, try a small retry using (oldest_id - 1)
        if inserted == 0:
            # only attempt retry if we had an oldest_id to base on
            if oldest_id:
                try:
                    alt_id = str(int(oldest_id) - 1)
                    print(f'Inserted 0 tweets — retrying a single batch with until_id={alt_id} to avoid boundary issues')
                    rc2 = run_cycle(args.handle, 1, until_id=alt_id)

                    # Query DB after retry
                    total_retry, oldest_retry, newest_retry = get_db_summary(db_url, args.handle)
                    try:
                        inserted_retry = int(total_retry) - int(total_before)
                    except Exception:
                        inserted_retry = None

                    state.update({'runs_done': i, 'last_total': total_retry, 'last_oldest': oldest_retry, 'last_newest': newest_retry})
                    write_state(state)

                    if inserted_retry and inserted_retry > 0:
                        print(f'Retry succeeded: inserted {inserted_retry} tweets — continuing')
                        # continue to next run
                        continue
                    else:
                        state.update({'paused': True, 'pause_reason': 'zero_inserts_after_retry'})
                        write_state(state)
                        print('Retry did not find any older tweets — pausing to avoid further API consumption.')
                        break
                except Exception as e:
                    print(f'Error during retry attempt: {e}')
                    state.update({'paused': True, 'pause_reason': 'retry_error'})
                    write_state(state)
                    break
            else:
                state.update({'paused': True, 'pause_reason': 'zero_inserts_in_run'})
                write_state(state)
                print('No new tweets inserted in this run — pausing further auto-fetch to avoid consuming API on duplicates.')
                break

        if oldest_after and oldest_after <= args.target_date:
            print(f'Target reached: oldest={oldest_after} <= {args.target_date}; stopping')
            break

    print('\nDone. Final state:')
    print(json.dumps(state, indent=2))


if __name__ == '__main__':
    main()
