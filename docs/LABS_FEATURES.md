# Labs Features Documentation

## Overview

The Labs environment (`/labs/*`) provides isolated, production-ready implementations of advanced features:

- **FAISS Primary Vector Search**: Fast semantic location search
- **AI Assistant Modal**: Context-aware suggestions for tweet review
- **Dynamic Learning**: Learn from human feedback and generate artifacts
- **Mapbox Maps**: Interactive map visualization of event locations
- **D3 Mindmap**: Graph visualization of entity relationships

All features use **real production data** (read-only) and are fully tested.

## Features

### 1. FAISS Vector Search (`/labs/search`)

**Purpose**: Fast semantic search for location names using FAISS vector database.

**Implementation**:
- Uses existing FAISS index at `data/embeddings/multilingual_geography/faiss_index.bin`
- Wraps Python FAISS implementation via child_process
- Embedding model: `intfloat/multilingual-e5-base` (384 dimensions)

**API**: `GET /api/labs/faiss/search?q=<query>&limit=5`

**Performance**: p95 < 500ms @ 25 VUs

### 2. AI Assistant (`/labs/ai`)

**Purpose**: Provides AI-powered suggestions for tweet review.

**Implementation**:
- Uses existing `LangGraphAIAssistant` from production
- Calls Gemini API (`gemini-1.5-flash` model)
- Displays suggestions with confidence scores and rationale

**API**: `POST /api/labs/ai/assist`

**Performance**: p95 < 1.5s @ 10 VUs

### 3. Dynamic Learning (`/labs/learning`)

**Purpose**: Processes approved reviews and generates learning artifacts.

**Implementation**:
- Reads `parsed_events` where `review_status IN ('approved', 'edited')`
- Generates artifacts:
  - Rule weights (event type patterns)
  - Alias maps (location name variants)
  - Prompt exemplars (successful parse examples)
- Writes JSON artifacts to `data/learning/` directory

**API**: `POST /api/labs/learning/run`

### 4. Mapbox Maps (`/labs/maps`)

**Purpose**: Interactive map visualization of event locations.

**Implementation**:
- Uses Mapbox GL JS
- Clusters events by location
- Click to view event details
- Pulls real data from `parsed_events.locations`

**Requirements**: `NEXT_PUBLIC_MAPBOX_TOKEN` environment variable

### 5. D3 Mindmap (`/labs/mindmap`)

**Purpose**: Graph visualization of entity relationships.

**Implementation**:
- Builds graph from analytics data
- Nodes: Event types, Locations, People, Organizations
- Edges: Co-occurrence above threshold
- Uses D3 force layout for visualization

**API**: `GET /api/labs/mindmap/graph?threshold=2`

**Performance**: p95 < 800ms @ 5 VUs

## Access

All labs features are accessible via direct URL only (not in main navigation):

- `/labs/search` - FAISS search tester
- `/labs/ai` - AI Assistant demo
- `/labs/maps` - Mapbox maps
- `/labs/mindmap` - D3 mindmap
- `/labs/learning` - Dynamic learning job

## Testing

### E2E Tests
```bash
npm run labs:test:e2e
```

### Load Tests
```bash
npm run labs:test:load
```

### Lighthouse Tests
```bash
npm run labs:lighthouse
```

## Environment Variables

See `.env.local.example` for required configuration:

- `FAISS_INDEX_PATH` - Path to FAISS index
- `FAISS_LOCATIONS_PATH` - Path to locations JSON
- `MILVUS_ENABLE` - Enable Milvus fallback (default: false)
- `NEXT_PUBLIC_MAPBOX_TOKEN` - Mapbox access token
- `LEARNING_LOG_DIR` - Directory for learning artifacts
- `GEMINI_API_KEY` - Gemini API key for AI Assistant
- `PYTHON_PATH` - Python executable path (default: python3)

## Data Sources

All features use **read-only** access to production database:

- `parsed_events` - Event data
- `raw_tweets` - Tweet text
- Only reads `review_status IN ('approved', 'edited')` for learning

## Integration Status

- ✅ FAISS: Primary (index exists, wrapper implemented)
- ✅ AI Assistant: Fully functional (uses production LangGraph)
- ✅ Dynamic Learning: Enabled for labs (generates artifacts)
- ✅ Mapbox: Implemented (requires token)
- ✅ D3 Mindmap: Implemented (builds graph from real data)
- ⚠️ Milvus: Fallback only (archived/deferred)

## Next Steps

Once approved, features can be integrated into production behind feature flags.

