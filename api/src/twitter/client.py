"""
Twitter API Client for fetching tweets.

This module provides a wrapper around the Twitter API v2 for fetching tweets
from a specific user handle with rate limiting and pagination support.

Rate Limits (Free Tier):
- 500 tweets per month
- 15 requests per 15 minutes
- 100 tweets per request (max)
"""

import os
import time
import logging
from typing import List, Dict, Optional
from datetime import datetime
import tweepy

logger = logging.getLogger(__name__)


class TwitterClient:
    """Twitter API client with rate limiting and pagination."""
    
    def __init__(self):
        """Initialize Twitter client with credentials from environment variables."""
        self.api_key = os.getenv('X_API_KEY')
        self.api_secret = os.getenv('X_API_SECRET')
        self.bearer_token = os.getenv('X_BEARER_TOKEN')
        self.access_token = os.getenv('X_ACCESS_TOKEN')
        self.access_token_secret = os.getenv('X_ACCESS_TOKEN_SECRET')
        
        if not self.bearer_token:
            raise ValueError(
                'X_BEARER_TOKEN not found in environment variables. '
                'Please set it in .env.local'
            )
        
        # Initialize Tweepy client (v2 API)
        self.client = tweepy.Client(
            bearer_token=self.bearer_token,
            consumer_key=self.api_key,
            consumer_secret=self.api_secret,
            access_token=self.access_token,
            access_token_secret=self.access_token_secret,
            wait_on_rate_limit=True,  # Automatically wait when rate limited
        )
        
        logger.info('Twitter client initialized successfully')
    
    def fetch_user_tweets(
        self,
        username: str,
        max_results: int = 100,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        since_id: Optional[str] = None,
        pagination_token: Optional[str] = None,
    ) -> tuple[List[Dict], Optional[str]]:
        """
        Fetch tweets from a user with pagination support.
        
        Args:
            username: Twitter username (without @)
            max_results: Maximum number of tweets to fetch (1-100)
            start_time: Fetch tweets created after this time
            end_time: Fetch tweets created before this time
            since_id: Fetch tweets newer than this tweet ID (for pagination)
            pagination_token: Token for pagination (from previous response)
        
        Returns:
            Tuple of (list of tweet dictionaries, next_pagination_token):
            - tweets: List of tweet dictionaries with fields:
              - id: Tweet ID
              - text: Tweet content
              - created_at: Timestamp
              - author_id: User ID
              - public_metrics: Likes, retweets, replies
              - entities: Hashtags, mentions, URLs
            - next_token: Pagination token for next page (None if no more pages)
        """
        try:
            # Get user ID from username (cache it to avoid repeated calls)
            if not hasattr(self, '_user_cache'):
                self._user_cache = {}
            
            if username not in self._user_cache:
                user = self.client.get_user(username=username)
                if not user.data:
                    raise ValueError(f'User @{username} not found')
                self._user_cache[username] = user.data.id
            
            user_id = self._user_cache[username]
            
            # Fetch tweets (exclude retweets and replies - only original tweets)
            # Note: 'exclude' parameter should be a list for Tweepy v4
            tweets_response = self.client.get_users_tweets(
                id=user_id,
                max_results=min(max_results, 100),  # API limit is 100
                start_time=start_time,
                end_time=end_time,
                since_id=since_id,
                pagination_token=pagination_token,
                exclude=['retweets', 'replies'],  # Exclude retweets and replies (only original tweets)
                tweet_fields=[
                    'created_at',
                    'public_metrics',
                    'entities',
                    'author_id',
                    'in_reply_to_user_id',  # Include to filter replies if API doesn't exclude them
                ],
            )
            
            if not tweets_response.data:
                logger.info(f'No tweets found for @{username}')
                return [], None
            
            # Get pagination token for next page
            next_token = None
            if hasattr(tweets_response, 'meta') and tweets_response.meta:
                next_token = tweets_response.meta.get('next_token')
            
            # Convert to list of dicts
            result = []
            for tweet in tweets_response.data:
                # Skip replies (double-check even though API excludes them)
                if hasattr(tweet, 'in_reply_to_user_id') and tweet.in_reply_to_user_id:
                    continue
                
                result.append({
                    'id': tweet.id,
                    'text': tweet.text,
                    'created_at': tweet.created_at.isoformat() if tweet.created_at else None,
                    'author_id': tweet.author_id,
                    'in_reply_to_user_id': getattr(tweet, 'in_reply_to_user_id', None),
                    'public_metrics': {
                        'like_count': tweet.public_metrics.get('like_count', 0),
                        'retweet_count': tweet.public_metrics.get('retweet_count', 0),
                        'reply_count': tweet.public_metrics.get('reply_count', 0),
                        'quote_count': tweet.public_metrics.get('quote_count', 0),
                    } if tweet.public_metrics else {},
                    'entities': {
                        'hashtags': [
                            {'tag': tag['tag']}
                            for tag in (tweet.entities.get('hashtags', []) if tweet.entities else [])
                        ],
                        'mentions': [
                            {'username': mention['username']}
                            for mention in (tweet.entities.get('mentions', []) if tweet.entities else [])
                        ],
                        'urls': [
                            {'url': url['url'], 'expanded_url': url.get('expanded_url')}
                            for url in (tweet.entities.get('urls', []) if tweet.entities else [])
                        ],
                    } if tweet.entities else {},
                })
            
            logger.info(f'Fetched {len(result)} tweets for @{username} (next_token: {next_token is not None})')
            return result, next_token
            
        except tweepy.TooManyRequests:
            logger.error('Rate limit exceeded. Please wait before retrying.')
            raise
        except tweepy.Unauthorized:
            logger.error('Invalid Twitter API credentials')
            raise
        except Exception as e:
            logger.error(f'Error fetching tweets: {str(e)}')
            raise
    
    def get_rate_limit_status(self) -> Dict:
        """Get current rate limit status."""
        try:
            limits = self.client.get_rate_limit_status()
            return limits
        except Exception as e:
            logger.error(f'Error getting rate limit status: {str(e)}')
            return {}


def test_fetch_sample_tweets():
    """Test function to fetch 10 sample tweets."""
    client = TwitterClient()
    
    # Fetch 10 tweets from @opchoudhary
    tweets, next_token = client.fetch_user_tweets(
        username='opchoudhary',
        max_results=10,
    )
    
    print(f'Fetched {len(tweets)} tweets')
    print(f'Has next page: {next_token is not None}')
    for tweet in tweets[:3]:  # Print first 3
        print(f'\n--- Tweet {tweet["id"]} ---')
        print(f'Date: {tweet["created_at"]}')
        print(f'Text: {tweet["text"][:100]}...')
        print(f'Likes: {tweet["public_metrics"]["like_count"]}')
        print(f'Retweets: {tweet["public_metrics"]["retweet_count"]}')
    
    return tweets


if __name__ == '__main__':
    # Run test
    test_fetch_sample_tweets()

