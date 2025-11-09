#!/usr/bin/env python3
"""
Export OP Choudhary tweets from database to readable RTF file
"""
import os
import psycopg2
from datetime import datetime

def export_tweets_to_rtf():
    db_url = os.getenv('DATABASE_URL', 'postgresql://dhruv_user:dhruv_pass@localhost:5432/dhruv_db')
    
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # Fetch all OP Choudhary tweets with parsed event info
        cur.execute("""
            SELECT 
                rt.tweet_id,
                rt.text,
                rt.created_at,
                rt.author_handle,
                pe.event_type,
                pe.event_type_hi,
                pe.overall_confidence,
                pe.needs_review,
                pe.review_status
            FROM raw_tweets rt
            LEFT JOIN parsed_events pe ON rt.tweet_id = pe.tweet_id
            WHERE rt.author_handle = 'OPChoudhary_Ind'
            ORDER BY rt.created_at DESC
        """)
        
        tweets = cur.fetchall()
        
        # Create RTF content
        rtf_content = """{\\rtf1\\ansi\\ansicpg1252\\cocoartf2865
\\cocoatextscaling0\\cocoaplatform0{\\fonttbl\\f0\\fswiss\\fcharset0 Helvetica;}
{\\colortbl;\\red255\\green255\\blue255;}
{\\*\\expandedcolortbl;;}
\\paperw11900\\paperh16840\\margl1440\\margr1440\\vieww11520\\viewh8400\\viewkind0
\\pard\\tx566\\tx1133\\tx1700\\tx2267\\tx2834\\tx3401\\tx3968\\tx4535\\tx5102\\tx5669\\tx6236\\tx6803\\pardirnatural\\partightenfactor0

\\f0\\fs24 \\cf0 ================================================================================
OP CHOUDHARY TWEETS - DATABASE EXPORT
================================================================================

Generated: """ + datetime.now().strftime('%Y-%m-%d %H:%M:%S') + """
Total Tweets: """ + str(len(tweets)) + """

================================================================================

"""
        
        for i, tweet in enumerate(tweets, 1):
            tweet_id, text, created_at, author_handle, event_type, event_type_hi, confidence, needs_review, review_status = tweet
            
            rtf_content += f"""
Tweet #{i}
--------------------------------------------------------------------------------
ID: {tweet_id}
Date: {created_at.strftime('%Y-%m-%d %H:%M:%S') if created_at else 'N/A'}
Author: @{author_handle}
Event Type: {event_type_hi or event_type or 'N/A'}
Confidence: {confidence or 'N/A'}
Needs Review: {needs_review or False}
Review Status: {review_status or 'N/A'}

Text:
{text or 'N/A'}

"""
        
        rtf_content += """
================================================================================
END OF EXPORT
================================================================================
}"""
        
        # Write to file
        output_file = 'database_tweets_export.rtf'
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(rtf_content)
        
        print(f"✅ Exported {len(tweets)} tweets to {output_file}")
        
        # Also show first 5 tweets in console
        print("\n" + "="*80)
        print("SAMPLE TWEETS (First 5):")
        print("="*80)
        for i, tweet in enumerate(tweets[:5], 1):
            tweet_id, text, created_at, author_handle, event_type, event_type_hi, confidence, needs_review, review_status = tweet
            print(f"\nTweet #{i}")
            print(f"ID: {tweet_id}")
            print(f"Date: {created_at}")
            print(f"Event: {event_type_hi or event_type or 'N/A'}")
            print(f"Text: {text[:200]}..." if text and len(text) > 200 else f"Text: {text}")
            print("-"*80)
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f'❌ Error: {e}')
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    export_tweets_to_rtf()


