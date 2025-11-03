/**
 * Twitter/X API Client for fetching tweets
 * 
 * This module provides a TypeScript wrapper around the Twitter API v2
 * for fetching tweets from a specific user handle.
 * 
 * Rate Limits (Free Tier):
 * - 500 tweets per month
 * - 15 requests per 15 minutes
 * - 100 tweets per request (max)
 */

export interface TweetData {
  id: string;
  text: string;
  created_at: string | null;
  author_id: string;
  public_metrics: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
    quote_count: number;
  };
  entities?: {
    hashtags?: Array<{ tag: string }>;
    mentions?: Array<{ username: string }>;
    urls?: Array<{ url: string; expanded_url?: string }>;
  };
}

export interface TwitterUser {
  id: string;
  name: string;
  username: string;
}

export class TwitterClient {
  private bearerToken: string;
  private baseUrl = 'https://api.twitter.com/2';

  constructor(bearerToken?: string) {
    this.bearerToken = bearerToken || process.env.X_BEARER_TOKEN || '';
    
    if (!this.bearerToken) {
      throw new Error(
        'X_BEARER_TOKEN not found in environment variables. ' +
        'Please set it in .env.local'
      );
    }
  }

  /**
   * Get user information by username
   */
  async getUserByUsername(username: string): Promise<TwitterUser> {
    const response = await fetch(
      `${this.baseUrl}/users/by/username/${username}`,
      {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`User @${username} not found`);
      }
      if (response.status === 401) {
        throw new Error('Invalid Twitter API credentials');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait before retrying.');
      }
      throw new Error(`Failed to fetch user: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.data) {
      throw new Error(`User @${username} not found`);
    }

    return {
      id: data.data.id,
      name: data.data.name,
      username: data.data.username,
    };
  }

  /**
   * Fetch tweets from a user
   * 
   * @param username Twitter username (without @)
   * @param maxResults Maximum number of tweets to fetch (1-100)
   * @param excludeRetweets Whether to exclude retweets
   * @param excludeReplies Whether to exclude replies
   */
  async fetchUserTweets(
    username: string,
    maxResults: number = 100,
    excludeRetweets: boolean = true,
    excludeReplies: boolean = false
  ): Promise<TweetData[]> {
    try {
      // Get user ID first
      const user = await this.getUserByUsername(username);
      
      // Build query parameters
      const params = new URLSearchParams({
        max_results: Math.min(maxResults, 100).toString(), // API limit is 100
        'tweet.fields': 'created_at,public_metrics,entities,author_id',
      });

      // Add exclusions
      const excludes: string[] = [];
      if (excludeRetweets) {
        excludes.push('retweets');
      }
      if (excludeReplies) {
        excludes.push('replies');
      }
      if (excludes.length > 0) {
        params.append('exclude', excludes.join(','));
      }

      const url = `${this.baseUrl}/users/${user.id}/tweets?${params.toString()}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait before retrying.');
        }
        if (response.status === 401) {
          throw new Error('Invalid Twitter API credentials');
        }
        throw new Error(`Failed to fetch tweets: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.data || data.data.length === 0) {
        return [];
      }

      // Transform to our TweetData format
      return data.data.map((tweet: any) => ({
        id: tweet.id,
        text: tweet.text,
        created_at: tweet.created_at || null,
        author_id: tweet.author_id || user.id,
        public_metrics: {
          like_count: tweet.public_metrics?.like_count || 0,
          retweet_count: tweet.public_metrics?.retweet_count || 0,
          reply_count: tweet.public_metrics?.reply_count || 0,
          quote_count: tweet.public_metrics?.quote_count || 0,
        },
        entities: {
          hashtags: tweet.entities?.hashtags?.map((h: any) => ({ tag: h.tag })) || [],
          mentions: tweet.entities?.user_mentions?.map((m: any) => ({ username: m.username })) || [],
          urls: tweet.entities?.urls?.map((u: any) => ({
            url: u.url,
            expanded_url: u.expanded_url,
          })) || [],
        },
      }));
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Unknown error fetching tweets: ${String(error)}`);
    }
  }

  /**
   * Fetch latest N tweets from a user
   * Convenience method that excludes retweets and replies by default
   */
  async fetchLatestTweets(
    username: string,
    count: number = 5
  ): Promise<TweetData[]> {
    return this.fetchUserTweets(username, count, true, false);
  }
}

