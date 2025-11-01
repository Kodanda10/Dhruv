# Parsed Events Database Schema

## Overview

The `parsed_events` table stores structured event data extracted from tweets. This table is populated by the AI parsing engine and serves as the foundation for analytics and human review workflows.

## Table: `parsed_events`

### Purpose
Store parsed event data from tweets with confidence scores, location information, and review status for quality assurance.

### Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-incrementing unique identifier |
| `tweet_id` | VARCHAR | NOT NULL, FK → raw_tweets | Reference to source tweet |
| `event_type` | VARCHAR | | Type of event (inauguration, rally, meeting, etc.) |
| `event_type_confidence` | DECIMAL(3,2) | 0.00-1.00 | Confidence score for event type classification |
| `event_date` | DATE | | Date of the event |
| `date_confidence` | DECIMAL(3,2) | 0.00-1.00 | Confidence score for date extraction |
| `locations` | JSONB | | Array of location objects with name, type, confidence |
| `people_mentioned` | TEXT[] | | Array of people mentioned in the tweet |
| `organizations` | TEXT[] | | Array of organizations mentioned |
| `schemes_mentioned` | TEXT[] | | Array of government schemes mentioned |
| `overall_confidence` | DECIMAL(3,2) | 0.00-1.00 | Overall confidence score for entire parse |
| `needs_review` | BOOLEAN | DEFAULT false | Flag indicating if human review is required |
| `review_status` | VARCHAR | DEFAULT 'pending' | Status: pending, approved, rejected, edited |
| `reviewed_at` | TIMESTAMP | | Timestamp when reviewed |
| `reviewed_by` | VARCHAR | | Username of reviewer |
| `parsed_at` | TIMESTAMP | DEFAULT NOW() | Timestamp when parsed |
| `parsed_by` | VARCHAR | DEFAULT 'system' | Parser identifier (system, model name) |

### Indexes

1. **`idx_parsed_events_tweet_id`** - Fast foreign key lookups
2. **`idx_parsed_events_date`** - Timeline queries (event_date DESC)
3. **`idx_parsed_events_review_status`** - Review queue queries (filtered index on pending + needs_review)
4. **`idx_parsed_events_type`** - Event type analysis
5. **`idx_parsed_events_confidence`** - Confidence-based queries
6. **`idx_parsed_events_date_type`** - Composite index for analytics (date + type)

### JSONB Schema: `locations` Field

```json
[
  {
    "name": "रायगढ़",
    "name_en": "Raigarh",
    "type": "city",
    "confidence": 0.95,
    "state": "Chhattisgarh",
    "district": "रायगढ़",
    "block": "रायगढ़",
    "assembly_constituency": "रायगढ़"
  },
  {
    "name": "खरसिया",
    "name_en": "Kharsia",
    "type": "block",
    "confidence": 0.88,
    "state": "Chhattisgarh",
    "district": "रायगढ़"
  }
]
```

### Event Types

Standard event types:
- `inauguration` - उद्घाटन
- `rally` - रैली, जनसभा
- `meeting` - बैठक
- `inspection` - निरीक्षण, दौरा
- `scheme_announcement` - योजना घोषणा
- `samaj_function` - समाज समारोह
- `festival_event` - त्योहार कार्यक्रम
- `constituent_engagement` - जनसंपर्क
- `relief` - राहत कार्य
- `other` - अन्य

### Review Status Values

- `pending` - Awaiting human review
- `approved` - Reviewed and approved
- `rejected` - Reviewed and rejected (incorrect parse)
- `edited` - Reviewed and manually corrected

### Confidence Scoring

Confidence scores range from 0.00 to 1.00:
- **0.90-1.00**: High confidence, likely correct
- **0.70-0.89**: Medium confidence, mostly correct
- **0.50-0.69**: Low confidence, needs review
- **0.00-0.49**: Very low confidence, definitely needs review

**Review Threshold**: `needs_review = true` when `overall_confidence < 0.70`

## Example Queries

### Get All Events Needing Review

```sql
SELECT 
    pe.id,
    pe.tweet_id,
    pe.event_type,
    pe.event_date,
    pe.overall_confidence,
    rt.text,
    rt.created_at
FROM parsed_events pe
JOIN raw_tweets rt ON pe.tweet_id = rt.tweet_id
WHERE pe.needs_review = true
  AND pe.review_status = 'pending'
ORDER BY pe.overall_confidence ASC, pe.parsed_at DESC
LIMIT 20;
```

### Get Events by Date Range

```sql
SELECT 
    event_date,
    event_type,
    COUNT(*) as event_count,
    AVG(overall_confidence) as avg_confidence
FROM parsed_events
WHERE event_date BETWEEN '2024-01-01' AND '2024-12-31'
  AND review_status = 'approved'
GROUP BY event_date, event_type
ORDER BY event_date DESC;
```

### Get Location Visit Frequency

```sql
SELECT 
    location->>'name' as location_name,
    location->>'type' as location_type,
    COUNT(*) as visit_count
FROM parsed_events,
     jsonb_array_elements(locations) as location
WHERE review_status = 'approved'
GROUP BY location->>'name', location->>'type'
ORDER BY visit_count DESC
LIMIT 20;
```

### Get Events by Type

```sql
SELECT 
    event_type,
    COUNT(*) as count,
    AVG(overall_confidence) as avg_confidence,
    COUNT(*) FILTER (WHERE needs_review = true) as needs_review_count
FROM parsed_events
GROUP BY event_type
ORDER BY count DESC;
```

## Migration

To create this table, run:

```bash
python scripts/run_migrations.py
```

Or apply specific migration:

```bash
python scripts/run_migrations.py --migration 002
```

## Related Tables

- **`raw_tweets`** - Source tweets (foreign key: `tweet_id`)
- **`schema_migrations`** - Migration tracking

## Future Enhancements

1. **Add embedding column** for semantic search (if using Milvus)
2. **Add geocoding data** (lat/lon) for map visualization
3. **Add media_urls** for image/video analysis
4. **Add sentiment analysis** scores
5. **Add topic modeling** tags

## References

- Migration file: `infra/migrations/002_create_parsed_events.sql`
- Migration runner: `scripts/run_migrations.py`
- Parser implementation: `api/src/parsing/tweet_parser.py`
