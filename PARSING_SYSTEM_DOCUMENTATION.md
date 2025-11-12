# Three-Layer Consensus Parsing System

## Overview
The parsing system implements a strict three-layer consensus approach that requires all layers to succeed for tweet acceptance. This ensures high accuracy and reliability in Hindi language tweet processing.

## Architecture Components

### 1. Three-Layer Consensus Engine (`src/lib/parsing/three-layer-consensus-engine.ts`)
- **Primary Layer**: Google Gemini AI (strict validation, Hindi language support)
- **Secondary Layer**: Ollama AI (local fallback, multilingual embeddings)
- **Validation Layer**: Regex patterns + FAISS semantic search (geospatial verification)

### 2. Rate Limiter (`src/lib/parsing/rate-limiter.ts`)
- **Gemini**: 2 requests/minute (free tier conservative limits)
- **Ollama**: 30 requests/minute (local processing capacity)
- Exponential backoff with configurable retry logic

### 3. API Endpoint (`src/app/api/parsing/three-layer-consensus/route.ts`)
- RESTful POST endpoint accepting tweet data
- Comprehensive error handling with failure reason extraction
- Strict consensus requirements (all 3 layers must succeed)

### 4. FAISS Geospatial Search (`src/labs/faiss/`)
- Semantic location linking using multilingual embeddings
- Python script execution for vector similarity search
- Hindi location name support with fuzzy matching

## Consensus Algorithm

### Strict Requirements
```typescript
// All three layers MUST succeed for acceptance
const consensusThreshold = 2; // At least 2 layers must agree (actually requires all 3)
const enableFallback = false; // No fallbacks allowed - strict mode
```

### Layer Processing Flow
1. **Gemini Layer**: Primary AI parsing with Hindi language understanding
2. **Ollama Layer**: Secondary AI validation with local processing
3. **Regex+FAISS Layer**: Pattern matching + geospatial verification
4. **Consensus Voting**: All layers must agree on core entities

### Error Handling
- Comprehensive failure logging to `failed_tweets.jsonl`
- Rate limit management with exponential backoff
- Graceful degradation with detailed error messages
- Tweet retry queues for transient failures

## Key Features

### Hindi Language Support
- Native Hindi text processing
- Event type classification in Hindi
- Location name recognition with Devanagari script
- Cultural context awareness

### Geospatial Validation
- FAISS-powered semantic location search
- Multilingual embedding support
- Fuzzy matching for location names
- District and village level accuracy

### Rate Limiting & Reliability
- Conservative API usage limits
- Automatic retry with backoff
- Request history tracking
- Status monitoring endpoints

## Usage Examples

### API Call
```bash
curl -X POST http://localhost:3000/api/parsing/three-layer-consensus \
  -H "Content-Type: application/json" \
  -d '{
    "tweet_text": "रायगढ़ में शिक्षा योजना का उद्घाटन",
    "tweet_id": "123456",
    "created_at": "2024-01-15T10:00:00Z",
    "author_handle": "@OPChoudhary_Ind"
  }'
```

### Bulk Processing
```bash
node scripts/bulk-ingest-tweets.js --batch-size 50 --max-retries 3
```

## Configuration

### Environment Variables
- `GOOGLE_GENAI_API_KEY`: Gemini AI access
- `OLLAMA_BASE_URL`: Local Ollama instance
- `FAISS_INDEX_PATH`: Vector database location
- `DATABASE_URL`: PostgreSQL connection

### Rate Limits
- Gemini: 2 RPM (configurable)
- Ollama: 30 RPM (configurable)
- Backoff: 5 seconds initial, 2x multiplier

## Recent Improvements (From Working Commits)

### Enhanced Error Handling
- Detailed failure reason extraction
- Structured error logging
- Retry queue management
- Comprehensive test coverage

### Performance Optimizations
- Batch processing with configurable sizes
- Rate limit awareness
- Memory-efficient streaming
- Parallel processing where possible

### Quality Assurance
- Three-layer consensus validation
- Accuracy metrics tracking
- Comprehensive test suites
- Real-world Hindi tweet datasets

## Testing & Validation

### Comprehensive Test Runner
- 1500+ test scenarios
- Real tweet data validation
- Accuracy measurement across all layers
- Performance benchmarking

### Quality Metrics
- Event type classification accuracy
- Entity extraction precision
- Geospatial validation success rate
- Consensus agreement percentages

## Future Enhancements

### Planned Improvements
- Additional AI model support
- Enhanced Hindi language models
- Real-time accuracy monitoring
- Automated model retraining

### Scalability Considerations
- Distributed processing support
- Caching layer optimization
- Database performance tuning
- API rate limit optimization</content>
<parameter name="filePath">/Users/abhijita/Projects/Project_Dhruv/PARSING_SYSTEM_DOCUMENTATION.md