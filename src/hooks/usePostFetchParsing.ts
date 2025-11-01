import { useState, useCallback } from 'react';

interface Tweet {
  id: number;
  tweet_id: string;
  text: string;
  created_at: string;
  author_handle: string;
  parsed?: boolean;
}

interface ParsedTweet {
  id: number;
  tweet_id: string;
  event_type: string;
  locations: string[];
  people_mentioned: string[];
  organizations: string[];
  schemes_mentioned: string[];
  overall_confidence: string;
  needs_review: boolean;
  review_status: string;
}

interface UsePostFetchParsingReturn {
  tweets: Tweet[];
  parsedTweets: ParsedTweet[];
  isParsing: boolean;
  errors: string[];
  fetchTweets: () => Promise<void>;
  clearErrors: () => void;
}

export function usePostFetchParsing(): UsePostFetchParsingReturn {
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [parsedTweets, setParsedTweets] = useState<ParsedTweet[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const parseUnparsedTweets = useCallback(async (tweetsToParse: Tweet[]) => {
    const unparsedTweets = tweetsToParse.filter(tweet => !tweet.parsed);
    
    if (unparsedTweets.length === 0) {
      return;
    }

    setIsParsing(true);
    const newParsedTweets: ParsedTweet[] = [];
    const newErrors: string[] = [];

    // Process tweets sequentially to maintain loading state
    for (const tweet of unparsedTweets) {
      try {
        const parseResponse = await fetch('/api/parse', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tweet_id: tweet.tweet_id,
            text: tweet.text
          })
        });

        const parseResult = await parseResponse.json();
        
        if (parseResult.success && parseResult.parsed_tweet) {
          newParsedTweets.push(parseResult.parsed_tweet);
        } else {
          newErrors.push(`Failed to parse tweet ${tweet.tweet_id}: ${parseResult.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error(`Error parsing tweet ${tweet.tweet_id}:`, error);
        newErrors.push(`Error parsing tweet ${tweet.tweet_id}`);
      }
    }

    setParsedTweets(prev => [...prev, ...newParsedTweets]);
    setErrors(prev => [...prev, ...newErrors]);
    setIsParsing(false);
  }, []);

  const fetchTweets = useCallback(async () => {
    try {
      // Fetch tweets from API
      const response = await fetch('/api/tweets');
      const result = await response.json();
      
      if (result.success && result.data) {
        setTweets(result.data);
        
        // Automatically parse unparsed tweets (don't await to allow loading state)
        parseUnparsedTweets(result.data);
      } else {
        setErrors(prev => [...prev, 'Failed to fetch tweets']);
      }
    } catch (error) {
      console.error('Error fetching tweets:', error);
      setErrors(prev => [...prev, 'Error fetching tweets']);
    }
  }, [parseUnparsedTweets]);

  return {
    tweets,
    parsedTweets,
    isParsing,
    errors,
    fetchTweets,
    clearErrors
  };
}
