CREATE TABLE IF NOT EXISTS raw_tweets (
    tweet_id VARCHAR PRIMARY KEY,
    author_handle VARCHAR NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    media_urls TEXT[],
    hashtags TEXT[],
    mentions TEXT[],
    urls TEXT[],
    retweet_count INT DEFAULT 0,
    like_count INT DEFAULT 0,
    reply_count INT DEFAULT 0,
    quote_count INT DEFAULT 0,
    fetched_at TIMESTAMP DEFAULT NOW(),
    processing_status VARCHAR DEFAULT 'pending'
);