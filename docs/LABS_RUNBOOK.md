# Labs Runbook

## Quick Start

### 1. Environment Setup

```bash
# Copy environment template
cp .env.local.example .env.local

# Edit .env.local and set:
# - NEXT_PUBLIC_MAPBOX_TOKEN (get from mapbox.com)
# - GEMINI_API_KEY (for AI Assistant)
# - DATABASE_URL (for data access)
```

### 2. Verify FAISS Index

```bash
# Check if index exists
ls -lh data/embeddings/multilingual_geography/faiss_index.bin

# Test search
npm run labs:faiss:verify
```

### 3. Start Development Server

```bash
npm run dev
```

### 4. Access Labs Features

- http://localhost:3000/labs/search
- http://localhost:3000/labs/ai
- http://localhost:3000/labs/maps
- http://localhost:3000/labs/mindmap
- http://localhost:3000/labs/learning

## Building FAISS Index

The FAISS index already exists at `data/embeddings/multilingual_geography/`.

To rebuild from new data:

```bash
# Run Python script (if needed)
cd api
python scripts/rebuild_geography_embeddings_multilingual.py
```

## Running Learning Job

### Via UI
1. Navigate to `/labs/learning`
2. Click "Learning Job चलाएं"
3. Wait for completion
4. Check artifacts in `data/learning/`

### Via API
```bash
curl -X POST http://localhost:3000/api/labs/learning/run
```

## Troubleshooting

### FAISS Search Fails

**Error**: "FAISS index not found"

**Solution**:
1. Verify index exists: `ls data/embeddings/multilingual_geography/faiss_index.bin`
2. Check `FAISS_INDEX_PATH` in `.env.local`
3. Rebuild index if needed

### AI Assistant Returns Errors

**Error**: "AI assistant request failed"

**Solution**:
1. Verify `GEMINI_API_KEY` is set
2. Check API quota/rate limits
3. Review server logs for detailed error

### Mapbox Map Not Rendering

**Error**: "Mapbox token not configured"

**Solution**:
1. Set `NEXT_PUBLIC_MAPBOX_TOKEN` in `.env.local`
2. Restart dev server
3. Get token from https://account.mapbox.com/

### Learning Job Fails

**Error**: "Learning job failed"

**Solution**:
1. Verify database connection (`DATABASE_URL`)
2. Check `data/learning/` directory exists and is writable
3. Review server logs for database errors

### Python Script Errors

**Error**: "Python script failed"

**Solution**:
1. Verify Python 3 is installed: `python3 --version`
2. Check required packages: `pip install sentence-transformers faiss-cpu`
3. Set `PYTHON_PATH` in `.env.local` if needed

## Performance Monitoring

### Check API Latency

```bash
# FAISS search
time curl "http://localhost:3000/api/labs/faiss/search?q=खरसिया"

# AI Assistant
time curl -X POST http://localhost:3000/api/labs/ai/assist \
  -H "Content-Type: application/json" \
  -d '{"tweet_id":"123","text":"test","entities":{}}'

# Mindmap graph
time curl "http://localhost:3000/api/labs/mindmap/graph?threshold=2"
```

### Run Load Tests

```bash
# Install k6 if needed
brew install k6  # macOS
# or download from https://k6.io/

# Run load tests
npm run labs:test:load
```

## Artifacts

### Learning Artifacts

Location: `data/learning/`

Files:
- `rule_weights_<timestamp>.json` - Event type pattern weights
- `alias_maps_<timestamp>.json` - Location name aliases
- `prompt_exemplars_<timestamp>.json` - Successful parse examples

### Test Reports

Location: `reports/`

Files:
- `labs-*-lighthouse.html` - Lighthouse reports
- `perf/labs-api-summary.json` - k6 load test summary
- `playwright-report/` - E2E test reports

## CI/CD

### Local CI Simulation

```bash
# Run all checks locally
npm ci
npm run build
npm run start &
sleep 10
npm run labs:test:e2e
npm run labs:test:load
npm run labs:lighthouse
```

### GitHub Actions

CI runs automatically on push to `feature/labs-prod-ready` branch.

Check status: https://github.com/<repo>/actions

## Rollback

If labs features cause issues:

1. **Disable via environment**:
   ```bash
   # Set in .env.local
   LEARNING_ENABLE=false
   MILVUS_ENABLE=false
   ```

2. **Remove labs routes** (if needed):
   ```bash
   # Labs routes are isolated - removing them won't affect production
   rm -rf src/app/labs
   rm -rf src/app/api/labs
   ```

3. **Revert branch**:
   ```bash
   git checkout main
   ```

## Support

For issues or questions:
1. Check logs: `npm run dev` (server logs)
2. Review test reports in `reports/`
3. Check database connectivity
4. Verify environment variables

