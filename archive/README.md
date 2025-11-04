# Archive - Deferred MVP Features

This directory contains over-engineered components that were deferred to focus on the **OP Choudhary Twitter Analytics MVP**.

## Decision Date
2025-01-XX

## Why These Components Were Archived

The original plan included sophisticated features (Neo4j knowledge graphs, Milvus vector search, IndicBERT fine-tuning) that were **over-engineered** for the MVP scope:

- **Target**: ~500-2000 tweets from OP Choudhary (Dec 2023 - Oct 2025)
- **Goal**: Analytics dashboard showing visit patterns, event types, Raigarh constituency coverage
- **Timeline**: 9 weeks to MVP

These advanced features would have added **months of development time** without delivering immediate business value.

## Archived Components

### 1. Neo4j Knowledge Graph
- **Original Plan**: Store parsed events as nodes with relationships (Person → Event → Location)
- **Why Deferred**: 
  - Simple Postgres queries sufficient for analytics (visit frequency, event types)
  - No complex graph traversal queries needed
  - Added infrastructure complexity (separate database, connection management)
- **Future Consideration**: If we need multi-hop queries like "find all people who attended events in Raigarh" → consider Neo4j v2

### 2. Milvus Vector Search
- **Original Plan**: Generate embeddings for semantic search and similarity matching
- **Why Deferred**:
  - Gemini API already provides good NLP without custom embeddings
  - 2000 tweets don't need vector search (can use simple keyword matching)
  - Added ML infrastructure complexity
- **Future Consideration**: If we scale to 100k+ tweets and need semantic search → consider Milvus v2

### 3. IndicBERT Fine-Tuning
- **Original Plan**: Fine-tune IndicBERT model for Hindi text classification
- **Why Deferred**:
  - Gemini API handles Hindi/English/Hinglish well out-of-the-box
  - No labeled training data yet (would need months to collect)
  - ML training adds weeks of effort
- **Future Consideration**: If Gemini accuracy <85% after review → consider custom model

### 4. OpenTelemetry Distributed Tracing
- **Original Plan**: Add distributed tracing for observability
- **Why Deferred**:
  - Simple Flask API doesn't need distributed tracing
  - Structured logging + metrics sufficient for MVP
  - Added observability infrastructure complexity
- **Future Consideration**: If we add microservices → add tracing

### 5. MLflow Experiment Tracking
- **Original Plan**: Track ML experiments, model versions, metrics
- **Why Deferred**:
  - No ML experiments to track (using Gemini API directly)
  - Simple metrics logging sufficient
- **Future Consideration**: If we add custom ML models → add MLflow

### 6. Prefect Orchestration
- **Original Plan**: Use Prefect for ETL pipeline orchestration
- **Why Deferred**:
  - Simple cron jobs sufficient for weekly tweet fetching
  - No complex DAGs needed
- **Future Consideration**: If ETL becomes complex → add Prefect

### 7. Full 20k Village Dataset
- **Original Plan**: Build complete Chhattisgarh geography with all villages
- **Why Deferred**:
  - Start with ~500-1000 major locations (district HQs, towns)
  - Add villages incrementally as encountered in tweets
  - 20k villages = weeks of data collection
- **Future Consideration**: As we discover more locations in tweets → expand dataset

## What We're Keeping (Simplified MVP)

✅ **Postgres**: Single database for raw tweets + parsed events  
✅ **Gemini API**: For text parsing (Hindi/English/Hinglish)  
✅ **Flask API**: Simple REST endpoints  
✅ **Next.js Dashboard**: Analytics UI (maps, charts)  
✅ **MapMyIndia**: For geocoding and map tiles  
✅ **Existing Parsing Logic**: Extend, don't rebuild  

## Migration Path (If Needed Later)

If we decide to re-enable any of these features:

1. **Neo4j**: 
   - Add to `docker-compose.yml`
   - Create migration scripts to sync Postgres → Neo4j
   - Update API to query Neo4j for graph queries

2. **Milvus**:
   - Add to `docker-compose.yml`
   - Generate embeddings for all tweets (batch job)
   - Add `/api/search/semantic` endpoint

3. **IndicBERT**:
   - Collect labeled data (human review queue)
   - Fine-tune model (2-3 weeks)
   - Deploy as fallback to Gemini

## References

- Original SOTA Plan: `Brains 🧠/PROJECT_DHRUV_SOTA_BRAIN_v4.0_SOTA.md`
- MVP Plan: `complete-phase-5---3.plan.md`
- Task List: `.taskmaster/tasks/tasks.json`

## Questions?

Contact: Abhi (Product Lead)

