#!/usr/bin/env python3
"""
Automated Tweet Pipeline - Complete workflow
Fetches, parses, and updates dashboard tweets.

This script:
1. Checks rate limit status before fetching
2. Fetches latest tweets (only if quota available)
3. Parses fetched tweets
4. Updates parsed_tweets.json for dashboard

Usage:
    python scripts/automated_tweet_pipeline.py
"""

import os
import sys
import subprocess
from pathlib import Path
from dotenv import load_dotenv
import logging

# Ensure logs directory exists before setting up logging
Path('logs').mkdir(exist_ok=True)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/tweet_pipeline.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv(Path(__file__).parent.parent / '.env.local')


def check_rate_limit():
    """Check if we can safely fetch tweets."""
    logger.info("=" * 80)
    logger.info("STEP 1: Checking rate limit status...")
    logger.info("=" * 80)
    
    try:
        result = subprocess.run(
            [sys.executable, str(Path(__file__).parent / 'check_rate_limit_before_fetch.py')],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            logger.info("✅ Rate limit check passed - safe to fetch")
            return True
        else:
            logger.warning("⚠️  Rate limit check failed or rate limited")
            logger.info(result.stdout)
            logger.error(result.stderr)
            return False
            
    except subprocess.TimeoutExpired:
        logger.error("❌ Rate limit check timed out")
        return False
    except Exception as e:
        logger.error(f"❌ Error checking rate limit: {e}")
        return False


def fetch_tweets():
    """Fetch latest tweets from Twitter API."""
    logger.info("")
    logger.info("=" * 80)
    logger.info("STEP 2: Fetching latest tweets...")
    logger.info("=" * 80)
    
    fetch_script = Path(__file__).parent.parent / 'fetch_5_latest_tweets_final.py'
    
    if not fetch_script.exists():
        logger.error(f"❌ Fetch script not found: {fetch_script}")
        return False
    
    try:
        result = subprocess.run(
            [sys.executable, str(fetch_script)],
            capture_output=True,
            text=True,
            timeout=600  # 10 minutes max (for rate limit waits)
        )
        
        if result.returncode == 0:
            logger.info("✅ Tweets fetched successfully")
            logger.info(result.stdout[-500:])  # Last 500 chars of output
            return True
        else:
            logger.warning("⚠️  Tweet fetching completed with warnings or rate limit")
            logger.info(result.stdout)
            if result.stderr:
                logger.error(result.stderr)
            # Don't fail completely - may have hit rate limit but script handled it
            return True  # Continue pipeline
            
    except subprocess.TimeoutExpired:
        logger.error("❌ Tweet fetching timed out (likely waiting for rate limit)")
        logger.warning("⚠️  Pipeline will continue - may have fetched some tweets")
        return True  # Continue anyway
    except Exception as e:
        logger.error(f"❌ Error fetching tweets: {e}")
        return False


def parse_tweets():
    """Parse fetched tweets."""
    logger.info("")
    logger.info("=" * 80)
    logger.info("STEP 3: Parsing tweets...")
    logger.info("=" * 80)
    
    parse_script = Path(__file__).parent / 'parse_tweets.py'
    
    if not parse_script.exists():
        logger.error(f"❌ Parse script not found: {parse_script}")
        return False
    
    try:
        result = subprocess.run(
            [sys.executable, str(parse_script), '--limit', '10'],
            capture_output=True,
            text=True,
            timeout=300  # 5 minutes max
        )
        
        if result.returncode == 0:
            logger.info("✅ Tweets parsed successfully")
            logger.info(result.stdout[-500:])
            return True
        else:
            logger.warning("⚠️  Parsing completed with warnings")
            logger.info(result.stdout)
            if result.stderr:
                logger.error(result.stderr)
            return True  # Continue anyway
            
    except subprocess.TimeoutExpired:
        logger.error("❌ Parsing timed out")
        return False
    except Exception as e:
        logger.error(f"❌ Error parsing tweets: {e}")
        return False


def update_dashboard_json():
    """Update parsed_tweets.json for dashboard."""
    logger.info("")
    logger.info("=" * 80)
    logger.info("STEP 4: Updating dashboard JSON...")
    logger.info("=" * 80)
    
    update_script = Path(__file__).parent.parent / 'update_parsed_tweets.py'
    
    if not update_script.exists():
        logger.error(f"❌ Update script not found: {update_script}")
        return False
    
    try:
        result = subprocess.run(
            [sys.executable, str(update_script)],
            capture_output=True,
            text=True,
            timeout=60  # 1 minute max
        )
        
        if result.returncode == 0:
            logger.info("✅ Dashboard JSON updated successfully")
            logger.info(result.stdout[-500:])
            return True
        else:
            logger.warning("⚠️  Dashboard update completed with warnings")
            logger.info(result.stdout)
            if result.stderr:
                logger.error(result.stderr)
            return True  # Continue anyway
            
    except subprocess.TimeoutExpired:
        logger.error("❌ Dashboard update timed out")
        return False
    except Exception as e:
        logger.error(f"❌ Error updating dashboard: {e}")
        return False


def main():
    """Run complete pipeline."""
    # Ensure logs directory exists
    Path('logs').mkdir(exist_ok=True)
    
    logger.info("=" * 80)
    logger.info("AUTOMATED TWEET PIPELINE - STARTING")
    logger.info("=" * 80)
    logger.info("")
    
    pipeline_steps = [
        ("Rate Limit Check", check_rate_limit, True),  # Must pass
        ("Fetch Tweets", fetch_tweets, False),  # Can continue if fails
        ("Parse Tweets", parse_tweets, False),  # Can continue if fails
        ("Update Dashboard", update_dashboard_json, False),  # Can continue if fails
    ]
    
    results = {}
    
    for step_name, step_func, required in pipeline_steps:
        try:
            success = step_func()
            results[step_name] = success
            
            if required and not success:
                logger.error(f"❌ Required step '{step_name}' failed - aborting pipeline")
                sys.exit(1)
                
        except Exception as e:
            logger.error(f"❌ Unexpected error in '{step_name}': {e}")
            if required:
                sys.exit(1)
            results[step_name] = False
    
    # Summary
    logger.info("")
    logger.info("=" * 80)
    logger.info("PIPELINE SUMMARY")
    logger.info("=" * 80)
    
    for step_name, success in results.items():
        status = "✅ PASSED" if success else "⚠️  FAILED/SKIPPED"
        logger.info(f"  {step_name}: {status}")
    
    all_required_passed = all(results.get(name, False) for name, _, required in pipeline_steps if required)
    optional_passed = sum(1 for name, _ in results.items() if results[name])
    
    logger.info("")
    if all_required_passed and optional_passed >= 2:
        logger.info("✅ PIPELINE COMPLETED SUCCESSFULLY")
        sys.exit(0)
    elif all_required_passed:
        logger.info("⚠️  PIPELINE COMPLETED WITH WARNINGS")
        logger.info("   Some optional steps failed, but core functionality may work")
        sys.exit(0)
    else:
        logger.error("❌ PIPELINE FAILED")
        logger.error("   Required steps failed")
        sys.exit(1)


if __name__ == '__main__':
    main()

