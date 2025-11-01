#!/usr/bin/env python3
"""
Fetch 5 latest tweets from OP Choudhary's account - Simple version
No database required, just shows the tweets.
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import tweepy

# Setup logging
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv(Path(__file__).parent / '.env.local')

def main():
    """Fetch 5 latest tweets and display them."""
    
    logger.info('=' * 80)
    logger.info('FETCHING 5 LATEST TWEETS FROM @OPChoudhary_Ind')
    logger.info('=' * 80)
    
    try:
        # Initialize Twitter client
        logger.info('Initializing Twitter client...')
        bearer_token = os.getenv('X_BEARER_TOKEN')
        if not bearer_token or bearer_token.startswith('your_'):
            logger.error('❌ X_BEARER_TOKEN not found or not set')
            logger.error('Please update .env.local with your actual Twitter API credentials')
            return
        
        client = tweepy.Client(
            bearer_token=bearer_token,
            wait_on_rate_limit=False,
        )
        logger.info('✓ Twitter client initialized')
        
        # Get user ID
        logger.info('Getting user ID for @OPChoudhary_Ind...')
        user = client.get_user(username='OPChoudhary_Ind')
        if not user.data:
            logger.error('❌ User @OPChoudhary_Ind not found')
            return
        
        user_id = user.data.id
        logger.info(f'✓ User ID: {user_id}')
        
        # Fetch 5 latest tweets
        logger.info('Fetching 5 latest tweets...')
        response = client.get_users_tweets(
            id=user_id,
            max_results=5,
            exclude=['retweets'],
            tweet_fields=['created_at', 'public_metrics', 'entities', 'author_id'],
        )
        
        if not response.data:
            logger.error('❌ No tweets found')
            return
        
        logger.info(f'✓ Fetched {len(response.data)} tweets')
        logger.info('')
        
        # Display tweets
        logger.info('=' * 80)
        logger.info('5 LATEST TWEETS FROM @OPChoudhary_Ind')
        logger.info('=' * 80)
        
        for i, tweet in enumerate(response.data, 1):
            logger.info(f'\\n--- Tweet {i} ---')
            logger.info(f'ID: {tweet.id}')
            logger.info(f'Date: {tweet.created_at}')
            logger.info(f'Text: {tweet.text}')
            logger.info(f'Likes: {tweet.public_metrics.like_count}')
            logger.info(f'Retweets: {tweet.public_metrics.retweet_count}')
            logger.info(f'Replies: {tweet.public_metrics.reply_count}')
            
            # Show hashtags and mentions
            if tweet.entities:
                hashtags = [tag['tag'] for tag in tweet.entities.get('hashtags', [])]
                mentions = [mention['username'] for mention in tweet.entities.get('mentions', [])]
                
                if hashtags:
                    logger.info(f'Hashtags: {', '.join(hashtags)}')
                if mentions:
                    logger.info(f'Mentions: {', '.join(mentions)}')
            
            logger.info('-' * 60)
        
        logger.info('\\n' + '=' * 80)
        logger.info('✅ SUCCESS: Latest tweets fetched!')
        logger.info('=' * 80)
        
    except tweepy.TooManyRequests as e:
        logger.error('❌ Rate limit exceeded. Wait 15 minutes and try again.')
        
    except tweepy.Unauthorized as e:
        logger.error('❌ Unauthorized. Check your Twitter API credentials.')
        
    except Exception as e:
        logger.error(f'❌ Error: {str(e)}')
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()

