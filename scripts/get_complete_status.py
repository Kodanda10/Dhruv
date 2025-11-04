#!/usr/bin/env python3
"""
Complete Tweet Fetch Status Report
Checks database for comprehensive status information
"""

import os
import sys
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# Try to import psycopg2
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("❌ psycopg2 not installed. Install with: pip install psycopg2-binary")
    sys.exit(1)

load_dotenv(Path(__file__).parent.parent / '.env.local')

def get_db_connection():
    """Get PostgreSQL database connection."""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError('DATABASE_URL not found in environment variables')
    return psycopg2.connect(database_url)

def format_date(date_obj):
    """Format date for display."""
    if date_obj:
        if isinstance(date_obj, str):
            return date_obj
        return date_obj.strftime('%Y-%m-%d %H:%M:%S')
    return 'N/A'

def get_status():
    """Get complete status from database."""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    status = {}
    
    try:
        # 1. Raw Tweets Statistics
        cur.execute("""
            SELECT 
                COUNT(*) as total_tweets,
                MIN(created_at) as oldest_tweet_date,
                MAX(created_at) as newest_tweet_date,
                COUNT(*) FILTER (WHERE processing_status = 'pending') as pending_count,
                COUNT(*) FILTER (WHERE processing_status = 'parsed') as parsed_count,
                COUNT(*) FILTER (WHERE processing_status = 'error') as error_count,
                MIN(fetched_at) as first_fetched,
                MAX(fetched_at) as last_fetched
            FROM raw_tweets
            WHERE author_handle = 'OPChoudhary_Ind'
        """)
        raw_stats = cur.fetchone()
        status['raw_tweets'] = dict(raw_stats)
        
        # 2. Get oldest tweet details
        cur.execute("""
            SELECT tweet_id, created_at, text, processing_status
            FROM raw_tweets
            WHERE author_handle = 'OPChoudhary_Ind'
            ORDER BY created_at ASC
            LIMIT 1
        """)
        oldest_tweet = cur.fetchone()
        status['oldest_tweet'] = dict(oldest_tweet) if oldest_tweet else None
        
        # 3. Get newest tweet details
        cur.execute("""
            SELECT tweet_id, created_at, text, processing_status
            FROM raw_tweets
            WHERE author_handle = 'OPChoudhary_Ind'
            ORDER BY created_at DESC
            LIMIT 1
        """)
        newest_tweet = cur.fetchone()
        status['newest_tweet'] = dict(newest_tweet) if newest_tweet else None
        
        # 4. Parsed Events Statistics
        cur.execute("""
            SELECT 
                COUNT(*) as total_parsed_events,
                COUNT(*) FILTER (WHERE review_status = 'pending') as pending_review,
                COUNT(*) FILTER (WHERE review_status = 'approved') as approved,
                COUNT(*) FILTER (WHERE review_status = 'rejected') as rejected,
                COUNT(*) FILTER (WHERE needs_review = true) as needs_review_count,
                MIN(parsed_at) as first_parsed,
                MAX(parsed_at) as last_parsed
            FROM parsed_events
        """)
        parsed_stats = cur.fetchone()
        status['parsed_events'] = dict(parsed_stats)
        
        # 5. Date range analysis
        cur.execute("""
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as tweet_count
            FROM raw_tweets
            WHERE author_handle = 'OPChoudhary_Ind'
            GROUP BY DATE(created_at)
            ORDER BY date DESC
            LIMIT 10
        """)
        recent_dates = cur.fetchall()
        status['recent_dates'] = [dict(row) for row in recent_dates]
        
        # 6. Processing status breakdown
        cur.execute("""
            SELECT 
                processing_status,
                COUNT(*) as count
            FROM raw_tweets
            WHERE author_handle = 'OPChoudhary_Ind'
            GROUP BY processing_status
            ORDER BY count DESC
        """)
        processing_breakdown = cur.fetchall()
        status['processing_breakdown'] = [dict(row) for row in processing_breakdown]
        
    finally:
        cur.close()
        conn.close()
    
    return status

def print_status(status):
    """Print formatted status report."""
    print("=" * 80)
    print("📊 COMPLETE TWEET FETCH STATUS REPORT")
    print("=" * 80)
    print()
    
    # Raw Tweets Section
    raw = status['raw_tweets']
    print("📥 RAW TWEETS IN DATABASE")
    print("-" * 80)
    print(f"  Total Tweets Fetched: {raw['total_tweets']:,}")
    print(f"  Oldest Tweet Date:    {format_date(raw['oldest_tweet_date'])}")
    print(f"  Newest Tweet Date:    {format_date(raw['newest_tweet_date'])}")
    print(f"  First Fetched:        {format_date(raw['first_fetched'])}")
    print(f"  Last Fetched:         {format_date(raw['last_fetched'])}")
    print()
    
    # Processing Status
    print("🔄 PROCESSING STATUS")
    print("-" * 80)
    print(f"  Pending:  {raw['pending_count']:,}")
    print(f"  Parsed:   {raw['parsed_count']:,}")
    print(f"  Errors:   {raw['error_count']:,}")
    print()
    
    # Processing Breakdown
    if status['processing_breakdown']:
        print("📋 PROCESSING STATUS BREAKDOWN")
        print("-" * 80)
        for item in status['processing_breakdown']:
            print(f"  {item['processing_status'] or 'NULL':<15} {item['count']:,}")
        print()
    
    # Oldest Tweet Details
    if status['oldest_tweet']:
        print("📅 OLDEST TWEET (First Date Fetched)")
        print("-" * 80)
        tweet = status['oldest_tweet']
        print(f"  Date:     {format_date(tweet['created_at'])}")
        print(f"  ID:       {tweet['tweet_id']}")
        print(f"  Status:   {tweet['processing_status']}")
        print(f"  Text:     {tweet['text'][:100]}...")
        print()
    
    # Newest Tweet Details
    if status['newest_tweet']:
        print("📅 NEWEST TWEET (Last Date Fetched)")
        print("-" * 80)
        tweet = status['newest_tweet']
        print(f"  Date:     {format_date(tweet['created_at'])}")
        print(f"  ID:       {tweet['tweet_id']}")
        print(f"  Status:   {tweet['processing_status']}")
        print(f"  Text:     {tweet['text'][:100]}...")
        print()
    
    # Parsed Events Section
    parsed = status['parsed_events']
    print("🤖 PARSED EVENTS")
    print("-" * 80)
    print(f"  Total Parsed Events:     {parsed['total_parsed_events']:,}")
    print(f"  Needs Review:             {parsed['needs_review_count']:,}")
    print(f"  Pending Review:           {parsed['pending_review']:,}")
    print(f"  Approved:                 {parsed['approved']:,}")
    print(f"  Rejected:                 {parsed['rejected']:,}")
    print(f"  First Parsed:             {format_date(parsed['first_parsed'])}")
    print(f"  Last Parsed:              {format_date(parsed['last_parsed'])}")
    print()
    
    # Recent Dates
    if status['recent_dates']:
        print("📆 RECENT TWEET DATES (Last 10 Days)")
        print("-" * 80)
        for row in status['recent_dates']:
            print(f"  {row['date']}: {row['tweet_count']:,} tweets")
        print()
    
    # Summary
    print("=" * 80)
    print("📊 SUMMARY")
    print("=" * 80)
    
    oldest_date = raw['oldest_tweet_date']
    newest_date = raw['newest_tweet_date']
    
    if oldest_date and newest_date:
        if isinstance(oldest_date, str):
            oldest_date = datetime.fromisoformat(oldest_date.replace('Z', '+00:00'))
        if isinstance(newest_date, str):
            newest_date = datetime.fromisoformat(newest_date.replace('Z', '+00:00'))
        
        days_span = (newest_date - oldest_date).days
        print(f"  Date Range Span: {days_span:,} days")
        print(f"  Tweets per Day (avg): {raw['total_tweets'] / days_span:.1f}" if days_span > 0 else "")
    
    print(f"  Parse Rate: {(raw['parsed_count'] / raw['total_tweets'] * 100):.1f}%" if raw['total_tweets'] > 0 else "")
    print()
    
    print("=" * 80)

def main():
    """Main entry point."""
    try:
        status = get_status()
        print_status(status)
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()

