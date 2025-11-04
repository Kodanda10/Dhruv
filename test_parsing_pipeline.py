#!/usr/bin/env python3
"""
Test the enhanced parsing pipeline without Gemini API dependency
"""

import psycopg2
import os
import json

def test_database_integration():
    """Test database integration for parsing pipeline"""
    
    # Test database connection
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        database=os.getenv('DB_NAME', 'dhruv_db'),
        user=os.getenv('DB_USER', 'dhruv_user'),
        password=os.getenv('DB_PASSWORD', 'dhruv_pass')
    )
    cursor = conn.cursor()
    
    # Test 1: Reference data exists
    cursor.execute("SELECT COUNT(*) FROM ref_schemes")
    scheme_count = cursor.fetchone()[0]
    assert scheme_count >= 10, f"Expected >= 10 schemes, got {scheme_count}"
    
    cursor.execute("SELECT COUNT(*) FROM ref_event_types")
    event_count = cursor.fetchone()[0]
    assert event_count >= 8, f"Expected >= 8 event types, got {event_count}"
    
    # Test 2: Can find unparsed tweets
    cursor.execute("""
        SELECT COUNT(*) FROM raw_tweets rt
        LEFT JOIN parsed_events pe ON rt.tweet_id = pe.tweet_id
        WHERE pe.tweet_id IS NULL
        AND rt.processing_status = 'pending'
    """)
    unparsed_count = cursor.fetchone()[0]
    assert unparsed_count > 0, f"Expected unparsed tweets, got {unparsed_count}"
    
    # Test 3: Can insert parsed event
    test_tweet_id = "test_parsing_123"
    cursor.execute("""
        INSERT INTO parsed_events (
            tweet_id, event_type, event_type_en, event_code,
            locations, people, organizations, schemes, schemes_en,
            date, confidence, reasoning, review_status, needs_review,
            matched_scheme_ids, matched_event_id, generated_hashtags,
            created_at, updated_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW()
        )
    """, (
        test_tweet_id,
        'बैठक',
        'Meeting',
        'MEETING',
        ['रायगढ़'],
        [],
        [],
        ['मुख्यमंत्री किसान योजना'],
        ['CM Kisan Yojana CG'],
        '2024-01-15',
        0.9,
        'Test parsing',
        'pending',
        True,
        [2],
        1,
        ['#रायगढ़', '#किसान', '#छत्तीसगढ़']
    ))
    
    # Test 4: Verify insertion
    cursor.execute("SELECT event_type, schemes FROM parsed_events WHERE tweet_id = %s", (test_tweet_id,))
    result = cursor.fetchone()
    assert result[0] == 'बैठक', f"Expected 'बैठक', got {result[0]}"
    assert 'मुख्यमंत्री किसान योजना' in result[1], f"Expected scheme in {result[1]}"
    
    # Test 5: Usage count trigger works
    cursor.execute("SELECT usage_count FROM ref_schemes WHERE scheme_code = 'CM_KISAN_CG'")
    usage_before = cursor.fetchone()[0]
    
    # Update to approved status to trigger usage count
    cursor.execute("""
        UPDATE parsed_events 
        SET review_status = 'approved', needs_review = false
        WHERE tweet_id = %s
    """, (test_tweet_id,))
    
    cursor.execute("SELECT usage_count FROM ref_schemes WHERE scheme_code = 'CM_KISAN_CG'")
    usage_after = cursor.fetchone()[0]
    assert usage_after > usage_before, f"Usage count should increase: {usage_before} -> {usage_after}"
    
    # Cleanup
    cursor.execute("DELETE FROM parsed_events WHERE tweet_id = %s", (test_tweet_id,))
    conn.commit()
    
    cursor.close()
    conn.close()
    
    print("✓ All database integration tests passed!")
    return True

def test_reference_data_queries():
    """Test reference data queries"""
    
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        database=os.getenv('DB_NAME', 'dhruv_db'),
        user=os.getenv('DB_USER', 'dhruv_user'),
        password=os.getenv('DB_PASSWORD', 'dhruv_pass')
    )
    cursor = conn.cursor()
    
    # Test scheme matching
    cursor.execute("""
        SELECT id, scheme_code, name_hi, name_en, category
        FROM ref_schemes
        WHERE name_hi ILIKE '%किसान%' OR name_en ILIKE '%kisan%'
        ORDER BY usage_count DESC
    """)
    kisan_schemes = cursor.fetchall()
    assert len(kisan_schemes) >= 2, f"Expected >= 2 kisan schemes, got {len(kisan_schemes)}"
    
    # Test event type matching with aliases
    cursor.execute("""
        SELECT id, event_code, name_hi, name_en, aliases_hi
        FROM ref_event_types
        WHERE name_hi = 'बैठक' OR 'मुलाकात' = ANY(aliases_hi)
    """)
    meeting_events = cursor.fetchall()
    assert len(meeting_events) >= 1, f"Expected meeting event type, got {len(meeting_events)}"
    
    cursor.close()
    conn.close()
    
    print("✓ Reference data queries work correctly!")
    return True

if __name__ == "__main__":
    print("Testing Enhanced Parsing Pipeline...")
    
    try:
        test_database_integration()
        test_reference_data_queries()
        print("\n🎉 All tests passed! Enhanced parsing pipeline is ready.")
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        exit(1)
