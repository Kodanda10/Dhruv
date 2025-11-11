# Tweet Parsing Pipeline Documentation

## Overview

This document describes the production-ready tweet parsing pipeline that implements a three-layer consensus system for extracting structured event data from tweets. The system combines deterministic rules/regex parsing with two LLM layers (Gemini and Ollama) to achieve high accuracy while maintaining safety and idempotency.

## Architecture

### Three-Layer Consensus System

1. **Rules/Regex Layer** - Deterministic parsing using predefined patterns
2. **Gemini LLM Layer** - Google's Gemini API for intelligent parsing
3. **Ollama LLM Layer** - Local LLM for additional validation

Each field (event, location, people, schemes, tags) requires 2-of-3 agreement for consensus.

### Data Flow

```
Raw Tweets → Unparsed API → Batch Processing → Consensus Parsing → Finalization → Analytics
     ↓             ↓             ↓                    ↓              ↓            ↓
  raw_tweets   /api/tweets/  scripts/parse_     LLM APIs     /api/review/   Dashboard
               unparsed      tweets.js         + Rules       finalize       Updates
```

## API Endpoints

### GET /api/tweets/unparsed
Fetches unparsed tweets for batch processing.

**Parameters:**
- `start` (number): Starting offset (default: 0)
- `limit` (number): Maximum tweets to return (default: 250, max: 1000)

**Response:**
```json
{
  "tweets": [
    {
      "tweet_id": "1234567890",
      "text": "Tweet content...",
      "created_at": "2024-01-01T00:00:00Z",
      "author_id": "987654321"
    }
  ],
  "total": 2583,
  "hasMore": true
}
```

### POST /api/llm/gemini/parse
Server-side wrapper for Gemini API parsing.

**Request:**
```json
{
  "tweet": {
    "id": "1234567890",
    "text": "Chief Minister announces new scheme in Raigarh",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

**Response:**
```json
{
  "parsed": {
    "event": "scheme announcement",
    "location": "Raigarh",
    "people": ["Chief Minister"],
    "schemes": ["new scheme"],
    "tags": ["government", "announcement"]
  }
}
```

### POST /api/llm/ollama/parse
Server-side wrapper for Ollama API parsing.

**Request/Response:** Same format as Gemini endpoint.

### PUT /api/review/[tweet_id]/finalize
Finalizes consensus parsing results with atomic transactions.

**Request:**
```json
{
  "tweetId": "1234567890",
  "consensus": {
    "event": { "value": "scheme announcement", "consensus": true, "sources": ["rules", "gemini"] },
    "location": { "value": "Raigarh", "consensus": true, "sources": ["rules", "ollama"] },
    "people": { "value": ["Chief Minister"], "consensus": true, "sources": ["gemini", "ollama"] },
    "schemes": { "value": ["new scheme"], "consensus": false, "sources": ["rules"] },
    "tags": { "value": ["government"], "consensus": true, "sources": ["gemini", "ollama"] }
  },
  "parserVersion": "v3-consensus-001",
  "batchId": "batch-001",
  "reviewerId": "consensus-parser",
  "notes": "Auto-finalized via consensus"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Tweet 1234567890 finalized with approved status",
  "data": {
    "tweetId": "1234567890",
    "batchId": "batch-001",
    "parserVersion": "v3-consensus-001",
    "consensusSummary": {
      "totalFields": 5,
      "agreedFields": 4,
      "disagreedFields": 1,
      "sources": ["rules", "gemini", "ollama"]
    },
    "finalStatus": "approved",
    "finalizedAt": "2024-01-01T12:00:00Z"
  }
}
```

## Parsing Script

### scripts/parse_tweets.js

Command-line tool for running the consensus parsing pipeline.

**Usage:**
```bash
node scripts/parse_tweets.js [options]

Options:
  --start <number>    Starting tweet offset (default: 0)
  --batch <number>    Batch size (default: 250)
  --dry <boolean>     Dry run mode (default: false)
  --help              Show help
```

**Environment Variables:**
- `API_BASE`: Base URL for API endpoints
- `DATABASE_URL`: PostgreSQL connection string
- `GEMINI_API_KEY`: Google Gemini API key
- `OLLAMA_HOST`: Ollama service URL
- `PARSER_VERSION`: Parser version for idempotency

## Consensus Algorithm

### Field-Level Voting
For each field (event, location, people, schemes, tags):
1. Collect results from all three layers
2. Compare values using fuzzy matching
3. Require 2-of-3 agreement for consensus
4. Track sources for transparency

### Decision Logic
```javascript
function consensus(fields) {
  const agreed = fields.filter(f => f.consensus).length;
  return agreed >= 2; // 2-of-3 agreement
}
```

### Fallback Handling
- If consensus fails: `review_status = 'needs_review'`
- If consensus succeeds: `review_status = 'approved'`
- Manual review required for failed consensus

## Database Schema

### parsed_events Table (Updated)
```sql
ALTER TABLE parsed_events
ADD COLUMN consensus_data JSONB,
ADD COLUMN consensus_summary JSONB,
ADD COLUMN parser_version VARCHAR(20) DEFAULT 'v1.0.0',
ADD COLUMN batch_id VARCHAR(50),
ADD COLUMN review_notes TEXT;
```

### Data Structure
- `consensus_data`: Raw consensus results from all layers
- `consensus_summary`: Aggregated statistics and metadata
- `parser_version`: Version tracking for idempotency
- `batch_id`: Grouping for workflow batches

## GitHub Actions Workflow

### .github/workflows/parse_tweets.yml

**Triggers:**
- Manual dispatch with configurable parameters
- Concurrency control to prevent conflicts

**Jobs:**
1. **parse**: Runs consensus parsing with checkpointing
2. **verify**: Runs Playwright tests for validation

**Parameters:**
- `start_offset`: Tweet starting position
- `batch_size`: Processing batch size (default: 250)
- `dry_run`: Test mode without database writes

## Safety & Reliability

### Idempotency
- Parser version tracking prevents duplicate processing
- Atomic transactions ensure consistency
- JSON backups for recovery

### Error Handling
- Retry logic for transient failures
- Graceful degradation on LLM failures
- Comprehensive logging and monitoring

### Rate Limiting
- Built-in delays between API calls
- Batch processing to respect limits
- Circuit breaker patterns

## Testing & Verification

### Playwright Tests
Located in `tests/verification/parse-verification.spec.ts`

**Coverage:**
- Analytics integrity during parsing
- UI consistency maintenance
- API endpoint validation
- Database integrity checks
- Consensus failure handling

### Manual Testing
```bash
# Dry run small batch
node scripts/parse_tweets.js --start 0 --batch 5 --dry true

# Full pipeline test
npm run test:verification
```

## Monitoring & Metrics

### Key Metrics
- Consensus success rate (>80% target)
- Processing throughput (tweets/hour)
- API error rates (<5% target)
- Database performance

### Alerts
- Consensus failure rate > 20%
- API timeouts > 10%
- Database connection failures
- Workflow failures

## Troubleshooting

### Common Issues

1. **Consensus failures**
   - Check LLM prompt quality
   - Validate regex patterns
   - Review training data

2. **API timeouts**
   - Increase timeout values
   - Check network connectivity
   - Reduce batch sizes

3. **Database conflicts**
   - Verify parser versions
   - Check transaction isolation
   - Review concurrency settings

### Recovery
- JSON backups for data recovery
- Checkpoint resumption for workflows
- Manual review for failed consensus

## Performance Optimization

### Current Benchmarks
- Batch size: 250 tweets
- Processing time: ~30 minutes per batch
- Consensus rate: ~85%
- Memory usage: < 500MB

### Scaling Strategies
- Horizontal scaling of LLM services
- Database connection pooling
- Caching for repeated patterns
- Async processing queues

## Future Enhancements

### Planned Improvements
- Real-time parsing WebSocket updates
- Advanced ML models for better accuracy
- Multi-language support
- Automated prompt optimization
- Performance analytics dashboard

### Research Areas
- Few-shot learning for domain adaptation
- Ensemble methods for consensus
- Confidence score calibration
- Error analysis and feedback loops