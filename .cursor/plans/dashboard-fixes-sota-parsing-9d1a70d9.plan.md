<!-- 9d1a70d9-8ecb-4a47-aa8d-2e99adcc88a1 7c03567f-c3aa-459a-b23c-3f47ea232db8 -->
# Phase 2 Enhanced: Automated Parsing Pipeline + Dynamic Learning + Analytics

## Architecture Overview

```
Fetch Tweets → Parse (Gemini + Datasets) → Review Queue (Human) → Learn & Update Datasets → Approved → Main Table + Analytics
     ↓              ↓                            ↓                         ↓                  ↓              ↓
  (5 sec)    (Gemini + Reference)      (Human edits/adds)         (Auto-update datasets)    (reflect)  (charts)
```

**Enhanced Features**:

- **Dynamic Learning**: Human-approved data automatically updates suggestion datasets
- **Pre-populated Datasets**: Schemes (Central + CG), Event Types, Geography
- **Hashtag Generation**: Integrated from existing `tag-search.ts` utilities
- **Analytics Fix**: Properly aggregate and display approved tweets data
- **Strict TDD**: Red→Green→Refactor per devops_agent_policy.yaml

---

## Task 2.1: Database Schema + Reference Datasets (TDD) [3h]

### Files to Create/Modify

- `infra/migrations/003_add_parsing_metadata.sql` (new - enhanced)
- `infra/migrations/004_reference_datasets.sql` (new)
- `scripts/seed_reference_data.py` (new)
- `tests/test_migration_004.py` (new)

### RED Phase: Write Failing Tests

**Test file**: `tests/test_migration_004.py`

```python
def test_reference_tables_exist():
    """Migration should create reference data tables"""
    conn = psycopg2.connect(...)
    cursor = conn.cursor()
    
    tables = ['ref_schemes', 'ref_event_types', 'ref_hashtags', 
              'user_contributed_data']
    
    for table in tables:
        cursor.execute(f"""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = '{table}'
            )
        """)
        assert cursor.fetchone()[0], f"{table} should exist"

def test_schemes_seed_data_loaded():
    """Should have Central and CG schemes pre-loaded"""
    cursor.execute("SELECT COUNT(*) FROM ref_schemes")
    count = cursor.fetchone()[0]
    assert count >= 10, "Should have at least 10 schemes"
    
    cursor.execute("""
        SELECT COUNT(*) FROM ref_schemes 
        WHERE category = 'central'
    """)
    assert cursor.fetchone()[0] >= 4  # PM-KISAN, Ayushman etc
    
    cursor.execute("""
        SELECT COUNT(*) FROM ref_schemes 
        WHERE category = 'state'
    """)
    assert cursor.fetchone()[0] >= 3  # CG state schemes

def test_event_types_preloaded():
    """Should have standard event types"""
    cursor.execute("SELECT name_hi FROM ref_event_types")
    types = [row[0] for row in cursor.fetchall()]
    
    assert 'बैठक' in types
    assert 'रैली' in types
    assert 'निरीक्षण' in types
    assert len(types) >= 8

def test_user_contributed_tracking():
    """Should track human-added suggestions"""
    cursor.execute("""
        INSERT INTO user_contributed_data 
        (entity_type, value_hi, value_en, source_tweet_id, approved_by)
        VALUES ('event_type', 'नया कार्यक्रम', 'New Event', 123, 'human')
    """)
    
    cursor.execute("""
        SELECT COUNT(*) FROM user_contributed_data
        WHERE entity_type = 'event_type'
    """)
    assert cursor.fetchone()[0] == 1
```

### GREEN Phase: Create Enhanced Migrations

**File**: `infra/migrations/003_add_parsing_metadata.sql` (same as before)

**File**: `infra/migrations/004_reference_datasets.sql`

```sql
BEGIN;

-- Reference Schemes Table
CREATE TABLE IF NOT EXISTS ref_schemes (
    id SERIAL PRIMARY KEY,
    scheme_code VARCHAR(50) UNIQUE NOT NULL,
    name_hi VARCHAR(200) NOT NULL,
    name_en VARCHAR(200) NOT NULL,
    category VARCHAR(20) NOT NULL, -- 'central' or 'state'
    description_hi TEXT,
    description_en TEXT,
    ministry VARCHAR(100),
    eligibility TEXT,
    benefits TEXT,
    application_process TEXT,
    official_url VARCHAR(300),
    is_active BOOLEAN DEFAULT true,
    usage_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Central Govt Schemes (Seed Data)
INSERT INTO ref_schemes (scheme_code, name_hi, name_en, category, ministry, description_hi, description_en) VALUES
('PM_KISAN', 'प्रधानमंत्री किसान सम्मान निधि', 'PM-KISAN', 'central', 'Agriculture', 'किसानों को वित्तीय सहायता', 'Financial support to farmers'),
('AYUSHMAN_BHARAT', 'आयुष्मान भारत', 'Ayushman Bharat', 'central', 'Health', 'स्वास्थ्य बीमा योजना', 'Health insurance scheme'),
('UJJWALA', 'प्रधानमंत्री उज्ज्वला योजना', 'PM Ujjwala Yojana', 'central', 'Petroleum', 'मुफ्त गैस कनेक्शन', 'Free LPG connections'),
('PMAY', 'प्रधानमंत्री आवास योजना', 'PM Awas Yojana', 'central', 'Housing', 'सभी के लिए आवास', 'Housing for all');

-- Chhattisgarh State Schemes (Seed Data)
INSERT INTO ref_schemes (scheme_code, name_hi, name_en, category, ministry, description_hi, description_en) VALUES
('CM_KISAN_CG', 'मुख्यमंत्री किसान योजना', 'CM Kisan Yojana CG', 'state', 'Agriculture', 'किसानों को राज्य सहायता', 'State support to farmers'),
('GODHAN_NYAY', 'गोधन न्याय योजना', 'Godhan Nyay Yojana', 'state', 'Agriculture', 'गाय के गोबर की खरीद', 'Cow dung procurement'),
('RAJIV_YUVA_MITAN', 'राजीव युवा मितान क्लब', 'Rajiv Yuva Mitan Club', 'state', 'Youth Affairs', 'युवा विकास कार्यक्रम', 'Youth development program');

-- Reference Event Types Table
CREATE TABLE IF NOT EXISTS ref_event_types (
    id SERIAL PRIMARY KEY,
    event_code VARCHAR(50) UNIQUE NOT NULL,
    name_hi VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    aliases_hi TEXT[], -- Array of Hindi variants
    aliases_en TEXT[], -- Array of English variants
    category VARCHAR(50), -- 'administrative', 'political', 'social', 'religious'
    usage_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Seed Event Types
INSERT INTO ref_event_types (event_code, name_hi, name_en, aliases_hi, aliases_en, category) VALUES
('MEETING', 'बैठक', 'Meeting', ARRAY['मुलाकात', 'चर्चा'], ARRAY['discussion', 'meeting'], 'administrative'),
('RALLY', 'रैली', 'Rally', ARRAY['सम्मेलन', 'जनसभा'], ARRAY['conference', 'public meeting'], 'political'),
('INSPECTION', 'निरीक्षण', 'Inspection', ARRAY['समीक्षा', 'जांच'], ARRAY['review', 'examination'], 'administrative'),
('INAUGURATION', 'उद्घाटन', 'Inauguration', ARRAY['शिलान्यास', 'भूमिपूजन'], ARRAY['foundation', 'opening'], 'administrative'),
('DISTRIBUTION', 'वितरण', 'Distribution', ARRAY['बंटवारा', 'प्रदान'], ARRAY['handover', 'giving'], 'social'),
('VISIT', 'दौरा', 'Visit', ARRAY['भ्रमण', 'यात्रा'], ARRAY['tour', 'trip'], 'administrative'),
('CELEBRATION', 'समारोह', 'Celebration', ARRAY['उत्सव', 'जयंती'], ARRAY['festival', 'anniversary'], 'social'),
('WORSHIP', 'पूजा', 'Worship', ARRAY['प्रार्थना', 'आरती'], ARRAY['prayer', 'ritual'], 'religious');

-- Reference Hashtags Table (for intelligent suggestions)
CREATE TABLE IF NOT EXISTS ref_hashtags (
    id SERIAL PRIMARY KEY,
    hashtag VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50), -- 'scheme', 'event', 'location', 'general'
    related_entity_id INT, -- FK to schemes/events/locations
    usage_count INT DEFAULT 0,
    first_seen TIMESTAMP DEFAULT NOW(),
    last_used TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- User Contributed Data Tracking (Dynamic Learning)
CREATE TABLE IF NOT EXISTS user_contributed_data (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL, -- 'event_type', 'scheme', 'hashtag', 'location', 'organization'
    value_hi VARCHAR(200),
    value_en VARCHAR(200),
    aliases TEXT[], -- Additional variants user provided
    source_tweet_id INT REFERENCES raw_tweets(id),
    contributed_at TIMESTAMP DEFAULT NOW(),
    approved_by VARCHAR(100), -- 'human' or username
    approval_status VARCHAR(20) DEFAULT 'approved', -- 'approved', 'pending', 'rejected'
    usage_count INT DEFAULT 1,
    metadata JSONB -- Store additional context
);

-- Indexes for performance
CREATE INDEX idx_schemes_category ON ref_schemes(category);
CREATE INDEX idx_schemes_active ON ref_schemes(is_active);
CREATE INDEX idx_event_types_active ON ref_event_types(is_active);
CREATE INDEX idx_hashtags_category ON ref_hashtags(category);
CREATE INDEX idx_user_contrib_type ON user_contributed_data(entity_type);
CREATE INDEX idx_user_contrib_status ON user_contributed_data(approval_status);

-- Function to auto-update usage counts
CREATE OR REPLACE FUNCTION increment_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'parsed_events' THEN
        -- Update scheme usage if scheme mentioned
        UPDATE ref_schemes 
        SET usage_count = usage_count + 1, updated_at = NOW()
        WHERE name_hi = ANY(NEW.schemes) OR name_en = ANY(NEW.schemes);
        
        -- Update event type usage
        UPDATE ref_event_types
        SET usage_count = usage_count + 1
        WHERE name_hi = NEW.event_type OR name_en = NEW.event_type;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_usage_on_approval
AFTER INSERT OR UPDATE ON parsed_events
FOR EACH ROW
WHEN (NEW.review_status = 'approved')
EXECUTE FUNCTION increment_usage_count();

COMMIT;
```

**File**: `scripts/seed_reference_data.py`

```python
import psycopg2
import os
from datetime import datetime

def seed_additional_data():
    """Seed additional reference data beyond migration defaults"""
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        database=os.getenv('DB_NAME', 'project_dhruv'),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD')
    )
    cursor = conn.cursor()
    
    # Additional Central Schemes
    additional_central = [
        ('PMFBY', 'प्रधानमंत्री फसल बीमा योजना', 'PM Fasal Bima Yojana', 'Agriculture'),
        ('PMGKY', 'प्रधानमंत्री गरीब कल्याण योजना', 'PM Garib Kalyan Yojana', 'Welfare'),
        ('PMGSY', 'प्रधानमंत्री ग्राम सड़क योजना', 'PM Gram Sadak Yojana', 'Rural Development'),
    ]
    
    for code, name_hi, name_en, ministry in additional_central:
        cursor.execute("""
            INSERT INTO ref_schemes (scheme_code, name_hi, name_en, category, ministry)
            VALUES (%s, %s, %s, 'central', %s)
            ON CONFLICT (scheme_code) DO NOTHING
        """, (code, name_hi, name_en, ministry))
    
    # Additional CG Schemes
    additional_state = [
        ('SHAHEED_MAHILA_SAMMAN', 'शहीद महिला सम्मान योजना', 'Shaheed Mahila Samman', 'Women Welfare'),
        ('NARVA_GARWA', 'नरवा गरवा घुरवा बाड़ी', 'Narva Garwa Ghurwa Baadi', 'Rural Development'),
    ]
    
    for code, name_hi, name_en, ministry in additional_state:
        cursor.execute("""
            INSERT INTO ref_schemes (scheme_code, name_hi, name_en, category, ministry)
            VALUES (%s, %s, %s, 'state', %s)
            ON CONFLICT (scheme_code) DO NOTHING
        """, (code, name_hi, name_en, ministry))
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print("✓ Reference data seeded successfully")

if __name__ == "__main__":
    seed_additional_data()
```

### REFACTOR Phase

- Add function to auto-suggest based on usage_count ranking
- Add API endpoint `/api/reference/suggestions?type=scheme&q=किसान`
- Cache frequently used references in Redis

---

## Task 2.2: Enhanced Gemini Parser with Reference Datasets (TDD) [3h]

### Files to Modify

- `gemini_parser.py` (major enhancement)
- `scripts/parse_new_tweets.py` (integrate with datasets)
- `tests/test_gemini_parser.py` (comprehensive)

### RED Phase: Write Failing Tests

```python
def test_parser_uses_scheme_datasets():
    """Parser should recognize schemes from reference data"""
    result = parse_tweet_with_gemini(
        "मुख्यमंत्री किसान योजना के तहत सहायता वितरित की"
    )
    
    assert 'schemes' in result
    assert 'मुख्यमंत्री किसान योजना' in result['schemes']
    # Should also include the English name for consistency
    assert 'CM Kisan Yojana CG' in result['schemes_en']

def test_parser_uses_event_type_datasets():
    """Parser should match event types with aliases"""
    result = parse_tweet_with_gemini("आज मुलाकात की")
    
    # 'मुलाकात' is alias for 'बैठक' (Meeting)
    assert result['event_type'] == 'बैठक'
    assert result['event_type_en'] == 'Meeting'

def test_parser_generates_relevant_hashtags():
    """Parser should generate contextual hashtags"""
    result = parse_tweet_with_gemini(
        "रायगढ़ में किसान योजना का शुभारंभ"
    )
    
    assert 'generated_hashtags' in result
    hashtags = result['generated_hashtags']
    # Should include location, scheme type, event type
    assert any('#रायगढ़' in h or '#Raigarh' in h for h in hashtags)
    assert any('किसान' in h or 'Kisan' in h for h in hashtags)

def test_parser_returns_all_dataset_matches():
    """Parser should return matched items with IDs for tracking"""
    result = parse_tweet_with_gemini(
        "PM-KISAN योजना के तहत किसानों को सहायता"
    )
    
    assert 'matched_schemes' in result
    assert len(result['matched_schemes']) > 0
    # Should include scheme ID for usage tracking
    assert 'scheme_id' in result['matched_schemes'][0]
```

### GREEN Phase: Enhance Parser

**File**: `gemini_parser.py` (complete rewrite with datasets)

````python
import google.generativeai as genai
import psycopg2
import os
import json
from typing import Dict, List, Optional
from src.utils.tag_search import normalize_for_matching, transliterate_devanagari

genai.configure(api_key=os.getenv('GEMINI_API_KEY'))

# SOTA Context (unchanged)
CHHATTISGARH_CONTEXT = """..."""  # Same as before

class ReferenceDataLoader:
    """Load and cache reference datasets for parsing"""
    
    def __init__(self):
        self.schemes_cache = None
        self.event_types_cache = None
        self._load_reference_data()
    
    def _load_reference_data(self):
        """Load reference data from database"""
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            database=os.getenv('DB_NAME', 'project_dhruv'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD')
        )
        cursor = conn.cursor()
        
        # Load schemes
        cursor.execute("""
            SELECT id, scheme_code, name_hi, name_en, category, 
                   ministry, description_hi
            FROM ref_schemes
            WHERE is_active = true
            ORDER BY usage_count DESC
        """)
        self.schemes_cache = cursor.fetchall()
        
        # Load event types with aliases
        cursor.execute("""
            SELECT id, event_code, name_hi, name_en, 
                   aliases_hi, aliases_en, category
            FROM ref_event_types
            WHERE is_active = true
            ORDER BY usage_count DESC
        """)
        self.event_types_cache = cursor.fetchall()
        
        cursor.close()
        conn.close()
    
    def get_schemes_context(self) -> str:
        """Format schemes for Gemini prompt"""
        if not self.schemes_cache:
            return ""
        
        central = [s for s in self.schemes_cache if s[4] == 'central']
        state = [s for s in self.schemes_cache if s[4] == 'state']
        
        context = "GOVERNMENT SCHEMES:\n"
        context += "Central Schemes:\n"
        for scheme in central[:10]:  # Top 10 by usage
            context += f"- {scheme[2]} ({scheme[3]})\n"
        
        context += "\nChhattisgarh State Schemes:\n"
        for scheme in state[:10]:
            context += f"- {scheme[2]} ({scheme[3]})\n"
        
        return context
    
    def get_event_types_context(self) -> str:
        """Format event types for Gemini prompt"""
        if not self.event_types_cache:
            return ""
        
        context = "EVENT TYPES (with Hindi aliases):\n"
        for evt in self.event_types_cache:
            evt_id, code, name_hi, name_en, aliases_hi, aliases_en, category = evt
            aliases_str = ", ".join(aliases_hi or [])
            context += f"- {name_hi} ({name_en})"
            if aliases_str:
                context += f" | Aliases: {aliases_str}"
            context += "\n"
        
        return context
    
    def match_scheme(self, text: str) -> List[Dict]:
        """Match schemes in text using fuzzy matching"""
        matched = []
        text_normalized = normalize_for_matching(text)
        
        for scheme in self.schemes_cache:
            scheme_id, code, name_hi, name_en, category, ministry, desc = scheme
            
            # Check direct match
            if name_hi in text or name_en in text:
                matched.append({
                    'id': scheme_id,
                    'code': code,
                    'name_hi': name_hi,
                    'name_en': name_en,
                    'category': category
                })
                continue
            
            # Check normalized match
            if normalize_for_matching(name_hi) in text_normalized:
                matched.append({
                    'id': scheme_id,
                    'code': code,
                    'name_hi': name_hi,
                    'name_en': name_en,
                    'category': category
                })
        
        return matched
    
    def match_event_type(self, text: str) -> Optional[Dict]:
        """Match event type including aliases"""
        text_normalized = normalize_for_matching(text)
        
        for evt in self.event_types_cache:
            evt_id, code, name_hi, name_en, aliases_hi, aliases_en, category = evt
            
            # Check main names
            if name_hi in text or name_en in text:
                return {
                    'id': evt_id,
                    'code': code,
                    'name_hi': name_hi,
                    'name_en': name_en,
                    'category': category
                }
            
            # Check aliases
            if aliases_hi:
                for alias in aliases_hi:
                    if alias in text:
                        return {
                            'id': evt_id,
                            'code': code,
                            'name_hi': name_hi,
                            'name_en': name_en,
                            'category': category,
                            'matched_via': alias
                        }
        
        return None

# Global reference data loader
ref_loader = ReferenceDataLoader()

def generate_contextual_hashtags(parsed_data: Dict) -> List[str]:
    """Generate intelligent hashtags based on parsed data"""
    hashtags = []
    
    # From locations
    if parsed_data.get('locations'):
        for loc in parsed_data['locations'][:2]:  # Max 2
            # Hindi version
            hashtags.append(f"#{loc.replace(' ', '')}")
            # Transliterated version
            hashtags.append(f"#{transliterate_devanagari(loc)}")
    
    # From event type
    if parsed_data.get('event_type'):
        evt = parsed_data['event_type']
        hashtags.append(f"#{evt.replace(' ', '')}")
    
    # From schemes
    if parsed_data.get('schemes'):
        for scheme in parsed_data['schemes'][:1]:  # Max 1
            # Extract key term (e.g., "किसान" from "मुख्यमंत्री किसान योजना")
            terms = scheme.split()
            if len(terms) >= 2:
                key_term = terms[1]  # Usually the category
                hashtags.append(f"#{key_term}")
    
    # General political hashtags
    hashtags.append("#छत्तीसगढ़")
    hashtags.append("#Chhattisgarh")
    
    # Deduplicate
    return list(set(hashtags))

def parse_tweet_with_gemini(tweet_text: str) -> dict:
    """Enhanced parser with reference datasets"""
    
    # Pre-match using reference data
    matched_schemes = ref_loader.match_scheme(tweet_text)
    matched_event = ref_loader.match_event_type(tweet_text)
    
    # Build enhanced context
    schemes_context = ref_loader.get_schemes_context()
    events_context = ref_loader.get_event_types_context()
    
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    prompt = f"""
{CHHATTISGARH_CONTEXT}

{schemes_context}

{events_context}

PRE-MATCHED DATA (use as hints):
- Schemes detected: {[s['name_hi'] for s in matched_schemes]}
- Event type hint: {matched_event['name_hi'] if matched_event else 'Unknown'}

TASK: Analyze this tweet and extract structured information.

TWEET TEXT:
{tweet_text}

OUTPUT FORMAT (JSON):
{{
  "event_type": "Use one from EVENT TYPES list above",
  "event_type_en": "English name",
  "event_code": "CODE from list",
  "locations": ["District/Block/Village names"],
  "people": ["Person names mentioned"],
  "organizations": ["Organization names"],
  "schemes": ["Use EXACT names from GOVERNMENT SCHEMES list"],
  "schemes_en": ["English names of schemes"],
  "date": "YYYY-MM-DD or null",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation",
  "matched_scheme_ids": [1, 2],  // IDs of matched schemes
  "matched_event_id": 5  // ID of matched event type
}}

IMPORTANT:
- Use EXACT scheme names from the reference list
- Match event type to one from the EVENT TYPES list
- Include both Hindi and English names for schemes
- Return scheme/event IDs for tracking

Return ONLY valid JSON, no extra text.
"""
    
    try:
        response = model.generate_content(prompt)
        result_text = response.text.strip()
        
        # Clean markdown
        if result_text.startswith('```'):
            result_text = result_text.split('```')[1]
            if result_text.startswith('json'):
                result_text = result_text[4:]
        
        parsed = json.loads(result_text)
        
        # Ensure confidence
        if 'confidence' not in parsed:
            parsed['confidence'] = 0.5
        
        # Add pre-matched data if Gemini missed it
        if matched_schemes and not parsed.get('matched_scheme_ids'):
            parsed['matched_scheme_ids'] = [s['id'] for s in matched_schemes]
            if not parsed.get('schemes'):
                parsed['schemes'] = [s['name_hi'] for s in matched_schemes]
                parsed['schemes_en'] = [s['name_en'] for s in matched_schemes]
        
        if matched_event and not parsed.get('matched_event_id'):
            parsed['matched_event_id'] = matched_event['id']
        
        # Generate hashtags
        parsed['generated_hashtags'] = generate_contextual_hashtags(parsed)
        
        return parsed
        
    except Exception as e:
        print(f"Gemini parsing error: {str(e)}")
        return {
            "event_type": "Unknown",
            "locations": [],
            "people": [],
            "organizations": [],
            "schemes": [],
            "schemes_en": [],
            "date": None,
            "confidence": 0.0,
            "error": str(e),
            "generated_hashtags": []
        }
````

---

## Task 2.3: Dynamic Learning System (Human-in-Loop) (TDD) [3h]

### Files to Create/Modify

- `src/app/api/reference/learn/route.ts` (new)
- `src/components/review/ReviewQueueNew.tsx` (enhance)
- `tests/api/learn.test.ts` (new)

### RED Phase: Write Failing Tests

```typescript
// tests/api/learn.test.ts
describe('POST /api/reference/learn', () => {
  it('should save human-added scheme to user_contributed_data', async () => {
    const response = await fetch('/api/reference/learn', {
      method: 'POST',
      body: JSON.stringify({
        entity_type: 'scheme',
        value_hi: 'नई योजना',
        value_en: 'New Scheme',
        source_tweet_id: 123
      })
    });
    
    expect(response.status).toBe(200);
    
    // Verify database
    const result = await db.query(
      "SELECT * FROM user_contributed_data WHERE value_hi = 'नई योजना'"
    );
    expect(result.rows.length).toBe(1);
  });
  
  it('should add to reference tables after 3+ uses', async () => {
    // Simulate 3 different humans adding same value
    for (let i = 0; i < 3; i++) {
      await fetch('/api/reference/learn', {
        method: 'POST',
        body: JSON.stringify({
          entity_type: 'event_type',
          value_hi: 'नया कार्यक्रम',
          value_en: 'New Event',
          source_tweet_id: 100 + i
        })
      });
    }
    
    // Should auto-promote to ref_event_types
    const result = await db.query(
      "SELECT * FROM ref_event_types WHERE name_hi = 'नया कार्यक्रम'"
    );
    expect(result.rows.length).toBe(1);
  });
});
```

### GREEN Phase: Implement Learning API

**File**: `src/app/api/reference/learn/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'project_dhruv',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      entity_type,  // 'scheme', 'event_type', 'hashtag', 'organization'
      value_hi,
      value_en,
      aliases,
      source_tweet_id,
      approved_by = 'human'
    } = body;
    
    // Insert into user_contributed_data
    const insertResult = await pool.query(
      `INSERT INTO user_contributed_data 
       (entity_type, value_hi, value_en, aliases, source_tweet_id, approved_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [entity_type, value_hi, value_en, aliases || [], source_tweet_id, approved_by]
    );
    
    const contributionId = insertResult.rows[0].id;
    
    // Check if this value has been contributed 3+ times
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM user_contributed_data
       WHERE entity_type = $1 AND value_hi = $2 AND approval_status = 'approved'`,
      [entity_type, value_hi]
    );
    
    const usageCount = parseInt(countResult.rows[0].count);
    
    // Auto-promote to reference table if 3+ uses
    if (usageCount >= 3) {
      if (entity_type === 'scheme') {
        await pool.query(
          `INSERT INTO ref_schemes 
           (scheme_code, name_hi, name_en, category, ministry, usage_count)
           VALUES ($1, $2, $3, 'user_contributed', 'Various', $4)
           ON CONFLICT (scheme_code) DO UPDATE SET usage_count = ref_schemes.usage_count + 1`,
          [value_hi.replace(/\s/g, '_').toUpperCase(), value_hi, value_en || value_hi, usageCount]
        );
      } else if (entity_type === 'event_type') {
        await pool.query(
          `INSERT INTO ref_event_types 
           (event_code, name_hi, name_en, aliases_hi, aliases_en, category, usage_count)
           VALUES ($1, $2, $3, $4, $5, 'user_contributed', $6)
           ON CONFLICT (event_code) DO UPDATE SET usage_count = ref_event_types.usage_count + 1`,
          [value_hi.replace(/\s/g, '_').toUpperCase(), value_hi, value_en || value_hi, 
           aliases || [], [], usageCount]
        );
      }
    }
    
    return NextResponse.json({
      success: true,
      contribution_id: contributionId,
      usage_count: usageCount,
      promoted: usageCount >= 3
    });
    
  } catch (error) {
    console.error('Learning API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save contribution' },
      { status: 500 }
    );
  }
}

// GET endpoint for suggestions
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // 'scheme', 'event_type', etc.
  const query = searchParams.get('q') || '';
  
  try {
    let results = [];
    
    if (type === 'scheme') {
      const dbResult = await pool.query(
        `SELECT name_hi, name_en, category, usage_count 
         FROM ref_schemes
         WHERE is_active = true 
         AND (name_hi ILIKE $1 OR name_en ILIKE $1)
         ORDER BY usage_count DESC, name_hi
         LIMIT 10`,
        [`%${query}%`]
      );
      results = dbResult.rows;
    } else if (type === 'event_type') {
      const dbResult = await pool.query(
        `SELECT name_hi, name_en, category, usage_count 
         FROM ref_event_types
         WHERE is_active = true 
         AND (name_hi ILIKE $1 OR name_en ILIKE $1 OR $1 = ANY(aliases_hi))
         ORDER BY usage_count DESC, name_hi
         LIMIT 10`,
        [`%${query}%`]
      );
      results = dbResult.rows;
    }
    
    return NextResponse.json({
      success: true,
      suggestions: results
    });
    
  } catch (error) {
    console.error('Suggestions API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch suggestions' },
      { status: 500 }
    );
  }
}
```

**File**: `src/components/review/ReviewQueueNew.tsx` (enhance with learning)

```typescript
// Add autocomplete for schemes/events
const [schemeSuggestions, setSchemeSuggestions] = useState<any[]>([]);
const [eventSuggestions, setEventSuggestions] = useState<any[]>([]);

// Fetch suggestions as user types
const fetchSuggestions = async (type: string, query: string) => {
  const response = await api.get(`/api/reference/learn?type=${type}&q=${query}`);
  if (response.success) {
    if (type === 'scheme') setSchemeSuggestions(response.suggestions);
    if (type === 'event_type') setEventSuggestions(response.suggestions);
  }
};

// When user adds new value, save to learning system
const handleAddNewValue = async (type: string, valueHi: string, valueEn?: string) => {
  await api.post('/api/reference/learn', {
    entity_type: type,
    value_hi: valueHi,
    value_en: valueEn || valueHi,
    source_tweet_id: currentTweet.id,
    approved_by: 'human'
  });
  
  // Show success message
  toast.success('नया मान जोड़ा गया और सुझावों में सहेजा गया!');
};

// Render autocomplete
<input
  type="text"
  placeholder="योजना खोजें..."
  onChange={(e) => fetchSuggestions('scheme', e.target.value)}
  list="scheme-suggestions"
/>
<datalist id="scheme-suggestions">
  {schemeSuggestions.map((s, i) => (
    <option key={i} value={s.name_hi}>{s.name_en} ({s.category})</option>
  ))}
</datalist>
```

---

## Task 2.4: Analytics Tab Fix (Reflect Approved Data) (TDD) [2h]

### Files to Modify

- `src/components/analytics/AnalyticsDashboardDark.tsx` (fix)
- `src/app/api/parsed-events/route.ts` (enhance query)
- `tests/components/AnalyticsDashboardDark.test.tsx` (comprehensive)

### RED Phase: Write Failing Tests

```typescript
it('should only show approved tweets in analytics', async () => {
  // Mock data: 5 approved, 3 pending
  const mockData = [
    ...Array(5).fill({ needs_review: false, review_status: 'approved' }),
    ...Array(3).fill({ needs_review: true, review_status: 'pending' })
  ];
  
  render(<AnalyticsDashboardDark />);
  
  await waitFor(() => {
    // Should only count 5 approved
    expect(screen.getByText(/कुल ट्वीट्स:.*5/i)).toBeInTheDocument();
  });
});

it('should display event type distribution chart', async () => {
  const mockData = [
    { event_type: 'बैठक', review_status: 'approved' },
    { event_type: 'बैठक', review_status: 'approved' },
    { event_type: 'रैली', review_status: 'approved' },
  ];
  
  render(<AnalyticsDashboardDark />);
  
  await waitFor(() => {
    expect(screen.getByText('बैठक: 2')).toBeInTheDocument();
    expect(screen.getByText('रैली: 1')).toBeInTheDocument();
  });
});

it('should show scheme usage statistics', async () => {
  render(<AnalyticsDashboardDark />);
  
  await waitFor(() => {
    expect(screen.getByText(/PM-KISAN.*2/i)).toBeInTheDocument();
  });
});
```

### GREEN Phase: Fix Analytics

**File**: `src/app/api/parsed-events/route.ts` (enhance)

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const needsReview = searchParams.get('needs_review');
  const reviewStatus = searchParams.get('review_status');
  const includeAnalytics = searchParams.get('analytics') === 'true';
  
  let query = 'SELECT * FROM parsed_events WHERE 1=1';
  const params = [];
  
  if (needsReview === 'true') {
    query += ' AND needs_review = true';
  } else if (needsReview === 'false' || includeAnalytics) {
    // For analytics, only approved tweets
    query += ' AND needs_review = false AND review_status = $1';
    params.push('approved');
  }
  
  if (reviewStatus && !includeAnalytics) {
    query += ` AND review_status = $${params.length + 1}`;
    params.push(reviewStatus);
  }
  
  query += ' ORDER BY created_at DESC';
  
  try {
    const result = await pool.query(query, params);
    
    if (includeAnalytics) {
      // Return aggregated analytics data
      const analytics = {
        total_tweets: result.rows.length,
        event_distribution: aggregateEventTypes(result.rows),
        location_distribution: aggregateLocations(result.rows),
        scheme_usage: aggregateSchemes(result.rows),
        timeline: aggregateByDate(result.rows),
        day_of_week: aggregateByDayOfWeek(result.rows)
      };
      
      return NextResponse.json({ success: true, analytics, raw_data: result.rows });
    }
    
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}

function aggregateEventTypes(tweets: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  tweets.forEach(t => {
    const evt = t.event_type || 'Unknown';
    counts[evt] = (counts[evt] || 0) + 1;
  });
  return counts;
}

function aggregateSchemes(tweets: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  tweets.forEach(t => {
    (t.schemes || []).forEach((scheme: string) => {
      counts[scheme] = (counts[scheme] || 0) + 1;
    });
  });
  return counts;
}

// Similar for other aggregations...
```

**File**: `src/components/analytics/AnalyticsDashboardDark.tsx` (fix completely)

```typescript
useEffect(() => {
  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const response = await api.get<{ success: boolean; analytics: any; raw_data: any[] }>(
        '/api/parsed-events?analytics=true'
      );
      
      if (response.success) {
        const { analytics, raw_data } = response;
        
        // Set aggregated data
        setEventTypeData(Object.entries(analytics.event_distribution).map(([name, count]) => ({
          name,
          count: count as number
        })));
        
        setLocationData(Object.entries(analytics.location_distribution).slice(0, 10).map(([name, count]) => ({
          name,
          count: count as number
        })));
        
        setSchemeData(Object.entries(analytics.scheme_usage).map(([name, count]) => ({
          name,
          count: count as number
        })));
        
        setTimelineData(analytics.timeline);
        setDayOfWeekData(analytics.day_of_week);
        
        // Set key insights
        setKeyInsights({
          total_tweets: analytics.total_tweets,
          unique_locations: Object.keys(analytics.location_distribution).length,
          most_common_event: Object.entries(analytics.event_distribution)
            .sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] || 'N/A',
          schemes_mentioned: Object.keys(analytics.scheme_usage).length
        });
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
      setError('विश्लेषण डेटा लोड करने में विफल');
    } finally {
      setLoading(false);
    }
  };
  
  fetchAnalyticsData();
}, []);
```

---

## Task 2.5: Complete E2E Workflow Simulation (TDD) [2h]

### Files to Create

- `tests/e2e/complete-workflow.test.ts` (new)
- `scripts/simulate_workflow.sh` (new)

### E2E Test Implementation

```typescript
// tests/e2e/complete-workflow.test.ts
describe('Complete Automated Workflow E2E', () => {
  it('should execute full pipeline: Fetch → Parse → Review → Approve → Analytics', async () => {
    // Step 1: Fetch tweets (mock)
    const fetchResponse = await exec('python fetch_5_latest_tweets_final.py');
    expect(fetchResponse).toContain('✓ Successfully fetched');
    
    // Step 2: Verify parsing started
    await wait(2000);
    const parseLog = await readFile('logs/parse_new_tweets.log');
    expect(parseLog).toContain('Found unparsed tweets');
    
    // Step 3: Wait for parsing to complete
    await wait(15000);
    
    // Step 4: Check review queue
    const reviewResponse = await fetch('/api/parsed-events?needs_review=true');
    const reviewData = await reviewResponse.json();
    expect(reviewData.data.length).toBeGreaterThan(0);
    
    // Step 5: Simulate human approval
    const tweetToApprove = reviewData.data[0];
    await fetch(`/api/parsed-events/${tweetToApprove.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        review_status: 'approved',
        needs_review: false,
        // Add human edits
        schemes: [...tweetToApprove.schemes, 'नई योजना']
      })
    });
    
    // Step 6: Verify learning system captured new value
    const learnResponse = await fetch('/api/reference/learn?type=scheme&q=नई');
    const suggestions = await learnResponse.json();
    expect(suggestions.suggestions.some(s => s.name_hi.includes('नई'))).toBe(true);
    
    // Step 7: Check analytics reflects approved tweet
    const analyticsResponse = await fetch('/api/parsed-events?analytics=true');
    const analyticsData = await analyticsResponse.json();
    expect(analyticsData.analytics.total_tweets).toBeGreaterThan(0);
    
    // Step 8: Verify home table shows approved tweet
    const homeResponse = await fetch('/api/parsed-events?needs_review=false');
    const homeData = await homeResponse.json();
    expect(homeData.data.some(t => t.id === tweetToApprove.id)).toBe(true);
  });
});
```

**File**: `scripts/simulate_workflow.sh`

```bash
#!/bin/bash
# Complete workflow simulation script

echo "=== Starting Complete Workflow Simulation ==="
echo ""

# Step 1: Apply migrations
echo "Step 1: Applying database migrations..."
psql -U postgres -d project_dhruv -f infra/migrations/003_add_parsing_metadata.sql
psql -U postgres -d project_dhruv -f infra/migrations/004_reference_datasets.sql
python scripts/seed_reference_data.py

# Step 2: Fetch tweets
echo ""
echo "Step 2: Fetching tweets..."
python fetch_5_latest_tweets_final.py

# Step 3: Wait for parsing
echo ""
echo "Step 3: Waiting for background parsing (15s)..."
sleep 15

# Step 4: Check review queue
echo ""
echo "Step 4: Checking review queue..."
curl -s http://localhost:3000/api/parsed-events?needs_review=true | jq '.data | length'

# Step 5: Test suggestions API
echo ""
echo "Step 5: Testing suggestions (किसान schemes)..."
curl -s "http://localhost:3000/api/reference/learn?type=scheme&q=किसान" | jq '.suggestions'

# Step 6: Check analytics
echo ""
echo "Step 6: Checking analytics data..."
curl -s "http://localhost:3000/api/parsed-events?analytics=true" | jq '.analytics.total_tweets'

echo ""
echo "=== Workflow Simulation Complete ==="
```

---

## Success Criteria

- ✅ Reference datasets (schemes, event types) loaded and queryable
- ✅ Gemini parser uses reference data for accurate matching
- ✅ Human-added values automatically saved to user_contributed_data
- ✅ Auto-promotion to reference tables after 3+ uses
- ✅ Autocomplete suggestions work in review UI
- ✅ Hashtag generation engine produces contextual tags
- ✅ Analytics tab displays approved tweets only (no empty state)
- ✅ All charts (event types, locations, schemes, timeline) populated
- ✅ E2E test passes: Fetch → Parse → Review → Approve → Reflect
- ✅ TDD followed for all tasks (Red → Green → Refactor)
- ✅ Coverage ≥ 85% lines, 70% branches
- ✅ All devops_agent_policy.yaml gates pass

---

## Implementation Todos

- [ ] Task 2.1: Database migrations + reference datasets + tests
- [ ] Task 2.2: Enhanced Gemini parser with reference data integration
- [ ] Task 2.3: Dynamic learning system (POST/GET /api/reference/learn)
- [ ] Task 2.4: Fix analytics tab to query approved tweets only
- [ ] Task 2.5: E2E workflow test + simulation script
- [ ] Run migrations: psql + seed scripts
- [ ] Run all tests: npm test && python -m pytest
- [ ] Run linter: npm run lint
- [ ] Execute simulation: bash scripts/simulate_workflow.sh
- [ ] Manual verification: Full workflow in browser
- [ ] Commit: "feat(parsing): dynamic learning pipeline with reference datasets and analytics fix"

### To-dos

- [ ] Database migrations + reference datasets (schemes/events) + comprehensive tests (TDD Red→Green→Refactor)
- [ ] Enhanced Gemini parser with reference data integration + hashtag generation
- [ ] Dynamic learning system with human-in-loop feedback (API + UI + tests)
- [ ] Fix analytics tab to display only approved tweets with all charts working
- [ ] E2E workflow test + automated simulation script + manual verification