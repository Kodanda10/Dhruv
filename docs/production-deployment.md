# Production Deployment Configuration for Tweet Parsing Pipeline

## Environment Variables

### Required Secrets (GitHub Secrets / Vercel Env)
```bash
# Database
DATABASE_URL=postgresql://user:pass@host:port/dbname

# API Keys
GEMINI_API_KEY=your_gemini_api_key_here
OLLAMA_HOST=http://your-ollama-host:11434

# GitHub Actions
API_BASE=https://your-production-domain.com
```

### Optional Configuration
```bash
# Parser Configuration
PARSER_VERSION=v3-consensus-001
EVENT_HIGH=0.88
EVENT_LOW=0.60

# Rate Limiting
OLLAMA_TIMEOUT=30000
GEMINI_TIMEOUT=30000
BATCH_DELAY=1000

# Workflow Settings
CONCURRENCY_GROUP=parse-tweets
TIMEOUT_MINUTES=60
```

## Infrastructure Requirements

### Database Schema
The pipeline requires PostgreSQL with the following tables:
- `raw_tweets` - Source tweets
- `parsed_events` - Parsed event data with consensus fields
- `tags`, `tag_aliases`, `tweet_tags` - Tag taxonomy

### API Endpoints
- `GET /api/tweets/unparsed` - Fetch unparsed tweets
- `POST /api/llm/gemini/parse` - Gemini LLM parsing
- `POST /api/llm/ollama/parse` - Ollama LLM parsing
- `PUT /api/review/[tweet_id]/finalize` - Consensus finalization

### External Services
- Google Gemini API (for LLM parsing layer)
- Ollama service (for local LLM parsing layer)

## Deployment Steps

### 1. Database Setup
```bash
# Run migrations in order
psql $DATABASE_URL -f infra/init.sql
psql $DATABASE_URL -f infra/migrations/001_create_raw_tweets.sql
psql $DATABASE_URL -f infra/migrations/002_create_parsed_events.sql
psql $DATABASE_URL -f infra/migrations/003_add_hindi_labels.sql
psql $DATABASE_URL -f infra/migrations/004_create_learning_tables.sql
psql $DATABASE_URL -f infra/migrations/005_create_cms_tables.sql
psql $DATABASE_URL -f infra/migrations/20251017_add_tags.sql
psql $DATABASE_URL -f infra/migrations/20250117_add_consensus_fields.sql
```

### 2. Environment Configuration
Set all required environment variables in your deployment platform (Vercel, Railway, etc.)

### 3. Ollama Setup (if using local LLM)
```bash
# On your Ollama server
ollama pull llama2:7b-chat  # or your preferred model
ollama serve
```

### 4. Deploy Application
```bash
npm run build
npm run start  # or deploy to Vercel/Railway/etc.
```

### 5. Run Initial Parsing
Trigger the GitHub Actions workflow with:
- `start_offset`: 0
- `batch_size`: 250
- `dry_run`: false

## Monitoring & Maintenance

### Health Checks
- API endpoint: `GET /api/health`
- Database connectivity check
- LLM service availability

### Logs to Monitor
- Consensus failure rates (>20% needs investigation)
- API timeout errors
- Database connection issues
- Rate limiting triggers

### Backup Strategy
- JSON backups created after each batch
- Database snapshots before major parsing runs
- Artifact storage in GitHub Actions

### Scaling Considerations
- Batch size: Start with 250, monitor performance
- Concurrency: Single workflow prevents conflicts
- Rate limits: Built-in delays between API calls
- Memory: Monitor for large batches

## Troubleshooting

### Common Issues

1. **API_BASE undefined**
   - Set `API_BASE` environment variable
   - Ensure it's accessible from GitHub Actions

2. **Database connection failed**
   - Verify `DATABASE_URL` format
   - Check SSL configuration for production
   - Ensure database is accessible from deployment

3. **LLM timeouts**
   - Increase timeout values in environment
   - Check LLM service health
   - Reduce batch size if needed

4. **Consensus failures**
   - Review parsing logic in `scripts/parse_tweets.js`
   - Check LLM prompt quality
   - Validate regex patterns

### Recovery Procedures

1. **Resume interrupted parsing**
   - Use checkpoint restoration in GitHub Actions
   - Set `start_offset` to last successful batch

2. **Reprocess failed tweets**
   - Query database for `needs_review = true` tweets
   - Manual review or adjust consensus thresholds

3. **Rollback consensus changes**
   - Restore from JSON backups
   - Use database snapshots if available