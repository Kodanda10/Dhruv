# Three-Layer Consensus Integration - COMPLETE ✅

**Date:** November 4, 2025  
**Status:** ✅ **INTEGRATED AND READY**

---

## What Was Done

### 1. Created New Parsing Script
**File:** `scripts/parse_tweets_with_three_layer.py`

**Features:**
- ✅ Calls three-layer consensus API endpoint
- ✅ Converts TypeScript result to database format
- ✅ Stores consensus metadata in `consensus_results` JSONB column
- ✅ Stores geo-hierarchy data
- ✅ Optional Python orchestrator fallback
- ✅ Batch processing support
- ✅ Error handling and logging

### 2. Integration Details

**API Endpoint Used:**
- `POST /api/parsing/three-layer-consensus`
- Host: `localhost:3000` (or `NEXTJS_API_URL` env var)

**Request Format:**
```json
{
  "tweet_id": "123456",
  "tweet_text": "रायगढ़ में बैठक हुई",
  "created_at": "2025-11-03T12:00:00Z",
  "author_handle": "OPChoudhary_Ind"
}
```

**Response Format:**
```json
{
  "success": true,
  "result": {
    "tweet_id": "123456",
    "parsed_data": {
      "locations": ["रायगढ़"],
      "event_type": "बैठक",
      "schemes_mentioned": [],
      "people_mentioned": [],
      "geo_hierarchy": [...]
    },
    "consensus_analysis": {
      "consensus_score": 0.85,
      "agreement_level": "high",
      "conflicts": []
    },
    "layer_results": {
      "gemini": {...},
      "ollama": {...},
      "custom": {...}
    }
  }
}
```

---

## Usage

### Basic Usage
```bash
# Parse all pending tweets using three-layer consensus
python3 scripts/parse_tweets_with_three_layer.py
```

### With Options
```bash
# Parse only 100 tweets
python3 scripts/parse_tweets_with_three_layer.py --limit 100

# Reparse all tweets
python3 scripts/parse_tweets_with_three_layer.py --reparse

# Use fallback if API fails
python3 scripts/parse_tweets_with_three_layer.py --fallback

# Custom API URL
python3 scripts/parse_tweets_with_three_layer.py --api-url http://localhost:3000
```

---

## Prerequisites

### 1. Next.js Server Running
The three-layer consensus engine requires the Next.js server to be running:
```bash
npm run dev
# or
npm run start
```

### 2. Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTJS_API_URL` - Optional, defaults to `http://localhost:3000`
- `GOOGLE_API_KEY` - For Gemini API (Layer 1)
- `OLLAMA_BASE_URL` - Optional, defaults to `http://localhost:11434`

### 3. Database Schema
The `parsed_events` table must have:
- `consensus_results` JSONB column (from migration 003)
- `geo_hierarchy` JSONB column (from migration 003)

---

## How It Works

### Flow:
```
1. Python Script (parse_tweets_with_three_layer.py)
   ↓
2. HTTP POST to /api/parsing/three-layer-consensus
   ↓
3. Three-Layer Consensus Engine (TypeScript)
   ├─ Layer 1: Gemini API
   ├─ Layer 2: Ollama Local Model
   └─ Layer 3: Custom Parsing Engine
   ↓
4. Consensus Algorithm (2/3 voting)
   ↓
5. Geo-Hierarchy Resolution
   ↓
6. Return Result to Python Script
   ↓
7. Convert to Database Format
   ↓
8. Insert into parsed_events table
```

### Consensus Algorithm:
- **2/3 Voting:** At least 2 layers must agree
- **Confidence Scoring:** Based on agreement level
- **Conflict Detection:** Identifies disagreements between layers
- **Agreement Levels:**
  - `high`: Consensus score ≥ 0.8
  - `medium`: Consensus score ≥ 0.6
  - `low`: Consensus score < 0.6

---

## Database Storage

### parsed_events Table:
- `parsed_by`: `'three-layer-consensus'`
- `consensus_results`: JSONB with:
  - `consensus_score`
  - `agreement_level`
  - `conflicts`
  - `layer_results` (gemini, ollama, custom)
  - `processing_time_ms`
- `geo_hierarchy`: JSONB with resolved geographic hierarchy
- `overall_confidence`: Calculated from consensus score

---

## Testing

### Test API Endpoint:
```bash
curl "http://localhost:3000/api/parsing/three-layer-consensus?tweet_text=रायगढ़ में बैठक हुई"
```

### Test Parsing Script:
```bash
# Parse a single tweet
python3 scripts/parse_tweets_with_three_layer.py --limit 1
```

### Verify in Database:
```sql
SELECT 
  tweet_id,
  event_type,
  parsed_by,
  overall_confidence,
  consensus_results->>'agreement_level' as agreement,
  consensus_results->>'consensus_score' as score
FROM parsed_events
WHERE parsed_by = 'three-layer-consensus'
ORDER BY id DESC
LIMIT 10;
```

---

## Fallback Mode

If `--fallback` flag is used:
1. Tries three-layer API first
2. If API fails, falls back to Python orchestrator
3. Marks as `parsed_by = 'python-orchestrator-fallback'`

This ensures parsing continues even if Next.js server is down.

---

## Next Steps for 500 Tweets

1. ✅ **Integration Complete** - Three-layer system integrated
2. ⏭️ **Start Next.js Server** - Required for three-layer API
3. ⏭️ **Fetch 500 Tweets** - Use `fetch_tweets_safe.py`
4. ⏭️ **Parse with Three-Layer** - Use `parse_tweets_with_three_layer.py`
5. ⏭️ **Verify Results** - Check review page and analytics

---

## Comparison: Old vs New

### Old Parsing (Python Orchestrator):
- ✅ Fast
- ✅ No external dependencies
- ❌ Single parsing source
- ❌ No consensus mechanism

### New Parsing (Three-Layer Consensus):
- ✅ Multiple parsing sources (Gemini + Ollama + Custom)
- ✅ Consensus algorithm (2/3 voting)
- ✅ Geo-hierarchy resolution
- ✅ Higher accuracy through agreement
- ⚠️ Requires Next.js server running
- ⚠️ Slightly slower (multiple API calls)

---

## Summary

✅ **Three-layer consensus engine is now integrated into the parsing pipeline!**

**Ready to use for:**
- Parsing 500 tweets
- Production parsing
- High-accuracy parsing with consensus

**Command for 500 tweets:**
```bash
# After fetching 500 tweets
python3 scripts/parse_tweets_with_three_layer.py
```

