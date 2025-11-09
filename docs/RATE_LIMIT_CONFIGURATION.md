# Rate Limit Configuration

## Current Settings (Very Conservative)

### Gemini API
- **Rate Limit**: 2 requests per minute (RPM)
- **Delay Between Requests**: 35 seconds (conservative buffer)
- **Rationale**: Free tier typically allows 2-3 RPM, we use 2 RPM for safety

### Ollama (Local)
- **Rate Limit**: 30 requests per minute (RPM)
- **Delay Between Requests**: 2 seconds
- **Rationale**: Local instance can handle more, but we're conservative

### Regex (Fallback)
- **Rate Limit**: 1000 RPM (effectively unlimited)
- **No Delays**: Instant processing
- **Rationale**: No API calls, pure regex matching

## Parsing Flow

### Sequential Processing (Rate Limit Safe)
1. **Gemini Layer** (Primary)
   - Waits for rate limit permit
   - Makes API call
   - Falls back to regex if rate limited

2. **2 Second Delay** (between Gemini and Ollama)

3. **Ollama Layer** (Secondary)
   - Waits for rate limit permit
   - Makes API call
   - Falls back to regex if rate limited

4. **Regex Layer** (Fallback)
   - Always runs (no rate limits)
   - Provides baseline parsing

5. **35 Second Delay** (before next tweet)
   - Ensures we don't exceed Gemini rate limits
   - Conservative buffer for safety

## Expected Processing Time

### Per Tweet
- Gemini call: ~2-5 seconds
- Delay: 2 seconds
- Ollama call: ~1-3 seconds
- Regex: <1 second
- Inter-tweet delay: 35 seconds
- **Total per tweet**: ~40-45 seconds

### For 100 Tweets
- **Minimum**: 100 × 40s = 4,000 seconds = **66 minutes**
- **Realistic**: 100 × 45s = 4,500 seconds = **75 minutes**

### For 2,500 Tweets
- **Minimum**: 2,500 × 40s = 100,000 seconds = **27.8 hours**
- **Realistic**: 2,500 × 45s = 112,500 seconds = **31.25 hours**

## Rate Limit Protection

### Automatic Fallback
- If Gemini rate limited → Uses regex fallback
- If Ollama rate limited → Uses regex fallback
- Always produces a result (regex is guaranteed)

### Exponential Backoff
- Initial backoff: 5 seconds
- Multiplier: 2x per retry
- Max retries: 10 attempts
- Max wait: ~5,120 seconds (85 minutes)

### Monitoring
- Rate limit status logged for each request
- Failed API calls logged with reason
- Fallback to regex logged

## Configuration

### Environment Variables
```bash
# Override defaults (optional)
GEMINI_RPM=2          # Gemini requests per minute
OLLAMA_RPM=30         # Ollama requests per minute
PARSE_DELAY_MS=35000  # Delay between tweets (ms)
```

### Script Configuration
```javascript
// In parse-all-pending-tweets.js
const rateLimiter = new RateLimiter({
  geminiRequestsPerMinute: 2,  // Very conservative
  ollamaRequestsPerMinute: 30, // Conservative
  regexRequestsPerMinute: 1000 // Unlimited
});

// Delay between tweets
const delayMs = 35000; // 35 seconds
```

## Best Practices

1. **Run during off-peak hours** - Less API contention
2. **Monitor logs** - Watch for rate limit warnings
3. **Use smaller batches** - Process 25-50 tweets at a time
4. **Allow time** - Don't rush, let rate limits reset naturally
5. **Check status** - Use `npm run ops:pipeline-health` to monitor

## Troubleshooting

### "Rate limit exceeded" Warnings
- **Normal**: Script will wait and retry automatically
- **Action**: Let it run, don't interrupt
- **Fallback**: Regex will still produce results

### Slow Processing
- **Expected**: 35 seconds per tweet is intentional
- **Reason**: Respecting Gemini free tier limits
- **Benefit**: No API revocations, reliable parsing

### High Regex Usage
- **Normal**: If Gemini/Ollama rate limited, regex takes over
- **Impact**: Lower confidence scores, but still functional
- **Solution**: Wait for rate limits to reset, then re-run watchdog

---

**Status**: ✅ **Rate limits configured for safe, reliable parsing**


