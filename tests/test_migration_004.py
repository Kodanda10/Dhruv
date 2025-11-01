import psycopg2
import os
import pytest
from unittest.mock import patch

# Test database connection
@pytest.fixture
def db_connection():
    """Create test database connection"""
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        database=os.getenv('DB_NAME', 'dhruv_db'),
        user=os.getenv('DB_USER', 'dhruv_user'),
        password=os.getenv('DB_PASSWORD', 'dhruv_pass')
    )
    yield conn
    conn.close()

@pytest.fixture
def cursor(db_connection):
    """Create test cursor"""
    cursor = db_connection.cursor()
    yield cursor
    cursor.close()

def test_reference_tables_exist(cursor):
    """Migration should create reference data tables"""
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

def test_schemes_seed_data_loaded(cursor):
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

def test_event_types_preloaded(cursor):
    """Should have standard event types"""
    cursor.execute("SELECT name_hi FROM ref_event_types")
    types = [row[0] for row in cursor.fetchall()]
    
    assert 'बैठक' in types
    assert 'रैली' in types
    assert 'निरीक्षण' in types
    assert len(types) >= 8

def test_user_contributed_tracking(cursor, db_connection):
    """Should track human-added suggestions"""
    cursor.execute("""
        INSERT INTO user_contributed_data 
        (entity_type, value_hi, value_en, source_tweet_id, approved_by)
        VALUES ('event_type', 'नया कार्यक्रम', 'New Event', 'test_tweet_123', 'human')
    """)
    db_connection.commit()
    
    cursor.execute("""
        SELECT COUNT(*) FROM user_contributed_data
        WHERE entity_type = 'event_type'
    """)
    assert cursor.fetchone()[0] == 1

def test_usage_count_tracking_trigger(cursor, db_connection):
    """Should auto-update usage counts when tweets are approved"""
    # First, ensure we have test data
    cursor.execute("""
        INSERT INTO ref_schemes (scheme_code, name_hi, name_en, category, ministry)
        VALUES ('TEST_SCHEME', 'टेस्ट योजना', 'Test Scheme', 'central', 'Test')
        ON CONFLICT (scheme_code) DO NOTHING
    """)
    
    cursor.execute("""
        INSERT INTO ref_event_types (event_code, name_hi, name_en, category)
        VALUES ('TEST_EVENT', 'टेस्ट कार्यक्रम', 'Test Event', 'test')
        ON CONFLICT (event_code) DO NOTHING
    """)
    
    # Insert a parsed event (simulating approval)
    cursor.execute("""
        INSERT INTO parsed_events 
        (tweet_id, event_type, schemes, review_status, needs_review)
        VALUES ('test_tweet_999', 'टेस्ट कार्यक्रम', ARRAY['टेस्ट योजना'], 'approved', false)
    """)
    db_connection.commit()
    
    # Check if usage counts were incremented
    cursor.execute("SELECT usage_count FROM ref_schemes WHERE scheme_code = 'TEST_SCHEME'")
    scheme_count = cursor.fetchone()[0]
    assert scheme_count > 0, "Scheme usage count should be incremented"
    
    cursor.execute("SELECT usage_count FROM ref_event_types WHERE event_code = 'TEST_EVENT'")
    event_count = cursor.fetchone()[0]
    assert event_count > 0, "Event type usage count should be incremented"

def test_indexes_exist(cursor):
    """Should have performance indexes"""
    indexes = [
        'idx_schemes_category',
        'idx_schemes_active', 
        'idx_event_types_active',
        'idx_hashtags_category',
        'idx_user_contrib_type',
        'idx_user_contrib_status'
    ]
    
    for index in indexes:
        cursor.execute(f"""
            SELECT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE indexname = '{index}'
            )
        """)
        assert cursor.fetchone()[0], f"Index {index} should exist"
