import pytest
import json
from unittest.mock import patch, MagicMock
import os

# Mock the database connection for tests
@pytest.fixture
def mock_db_connection():
    """Mock database connection for testing"""
    with patch('psycopg2.connect') as mock_connect:
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn
        
        # Mock schemes data
        mock_cursor.fetchall.return_value = [
            (1, 'PM_KISAN', 'प्रधानमंत्री किसान सम्मान निधि', 'PM-KISAN', 'central', 'Agriculture', 'किसानों को वित्तीय सहायता'),
            (2, 'CM_KISAN_CG', 'मुख्यमंत्री किसान योजना', 'CM Kisan Yojana CG', 'state', 'Agriculture', 'किसानों को राज्य सहायता')
        ]
        
        yield mock_conn, mock_cursor

def test_parser_uses_scheme_datasets(mock_db_connection):
    """Parser should recognize schemes from reference data"""
    from gemini_parser import parse_tweet_with_gemini
    
    # Mock Gemini response
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "event_type": "वितरण",
        "event_type_en": "Distribution", 
        "event_code": "DISTRIBUTION",
        "locations": ["रायगढ़"],
        "people": [],
        "organizations": [],
        "schemes": ["मुख्यमंत्री किसान योजना"],
        "schemes_en": ["CM Kisan Yojana CG"],
        "date": "2024-01-15",
        "confidence": 0.9,
        "reasoning": "Scheme mentioned in tweet",
        "matched_scheme_ids": [2],
        "matched_event_id": 5
    })
    
    with patch('google.generativeai.GenerativeModel') as mock_model:
        mock_model_instance = MagicMock()
        mock_model_instance.generate_content.return_value = mock_response
        mock_model.return_value = mock_model_instance
        
        result = parse_tweet_with_gemini(
            "मुख्यमंत्री किसान योजना के तहत सहायता वितरित की"
        )
        
        assert 'schemes' in result
        assert 'मुख्यमंत्री किसान योजना' in result['schemes']
        assert 'CM Kisan Yojana CG' in result['schemes_en']

def test_parser_uses_event_type_datasets(mock_db_connection):
    """Parser should match event types with aliases"""
    from gemini_parser import parse_tweet_with_gemini
    
    # Mock Gemini response
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "event_type": "बैठक",
        "event_type_en": "Meeting",
        "event_code": "MEETING",
        "locations": [],
        "people": [],
        "organizations": [],
        "schemes": [],
        "schemes_en": [],
        "date": None,
        "confidence": 0.8,
        "reasoning": "Meeting mentioned",
        "matched_scheme_ids": [],
        "matched_event_id": 1
    })
    
    with patch('google.generativeai.GenerativeModel') as mock_model:
        mock_model_instance = MagicMock()
        mock_model_instance.generate_content.return_value = mock_response
        mock_model.return_value = mock_model_instance
        
        result = parse_tweet_with_gemini("आज मुलाकात की")
        
        # 'मुलाकात' is alias for 'बैठक' (Meeting)
        assert result['event_type'] == 'बैठक'
        assert result['event_type_en'] == 'Meeting'

def test_parser_generates_relevant_hashtags(mock_db_connection):
    """Parser should generate contextual hashtags"""
    from gemini_parser import parse_tweet_with_gemini
    
    # Mock Gemini response
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "event_type": "उद्घाटन",
        "event_type_en": "Inauguration",
        "event_code": "INAUGURATION",
        "locations": ["रायगढ़"],
        "people": [],
        "organizations": [],
        "schemes": ["मुख्यमंत्री किसान योजना"],
        "schemes_en": ["CM Kisan Yojana CG"],
        "date": "2024-01-15",
        "confidence": 0.9,
        "reasoning": "Inauguration event",
        "matched_scheme_ids": [2],
        "matched_event_id": 4
    })
    
    with patch('google.generativeai.GenerativeModel') as mock_model:
        mock_model_instance = MagicMock()
        mock_model_instance.generate_content.return_value = mock_response
        mock_model.return_value = mock_model_instance
        
        result = parse_tweet_with_gemini(
            "रायगढ़ में किसान योजना का शुभारंभ"
        )
        
        assert 'generated_hashtags' in result
        hashtags = result['generated_hashtags']
        # Should include location, scheme type, event type
        assert any('#रायगढ़' in h or '#Raigarh' in h for h in hashtags)
        assert any('किसान' in h or 'Kisan' in h for h in hashtags)

def test_parser_returns_all_dataset_matches(mock_db_connection):
    """Parser should return matched items with IDs for tracking"""
    from gemini_parser import parse_tweet_with_gemini
    
    # Mock Gemini response
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "event_type": "वितरण",
        "event_type_en": "Distribution",
        "event_code": "DISTRIBUTION",
        "locations": [],
        "people": [],
        "organizations": [],
        "schemes": ["प्रधानमंत्री किसान सम्मान निधि"],
        "schemes_en": ["PM-KISAN"],
        "date": "2024-01-15",
        "confidence": 0.9,
        "reasoning": "PM-KISAN scheme mentioned",
        "matched_scheme_ids": [1],
        "matched_event_id": 5
    })
    
    with patch('google.generativeai.GenerativeModel') as mock_model:
        mock_model_instance = MagicMock()
        mock_model_instance.generate_content.return_value = mock_response
        mock_model.return_value = mock_model_instance
        
        result = parse_tweet_with_gemini(
            "PM-KISAN योजना के तहत किसानों को सहायता"
        )
        
        assert 'matched_scheme_ids' in result
        assert len(result['matched_scheme_ids']) > 0
        assert result['matched_scheme_ids'][0] == 1

def test_parser_handles_gemini_error():
    """Parser should handle Gemini API errors gracefully"""
    from gemini_parser import parse_tweet_with_gemini
    
    with patch('google.generativeai.GenerativeModel') as mock_model:
        mock_model_instance = MagicMock()
        mock_model_instance.generate_content.side_effect = Exception("API Error")
        mock_model.return_value = mock_model_instance
        
        result = parse_tweet_with_gemini("Test tweet")
        
        assert result['event_type'] == 'Unknown'
        assert result['confidence'] == 0.0
        assert 'error' in result
        assert result['error'] == 'API Error'

def test_reference_data_loader_initialization():
    """ReferenceDataLoader should load data from database"""
    from gemini_parser import ReferenceDataLoader
    
    with patch('psycopg2.connect') as mock_connect:
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn
        
        # Mock schemes data
        mock_cursor.fetchall.return_value = [
            (1, 'PM_KISAN', 'प्रधानमंत्री किसान सम्मान निधि', 'PM-KISAN', 'central', 'Agriculture', 'किसानों को वित्तीय सहायता')
        ]
        
        loader = ReferenceDataLoader()
        
        assert loader.schemes_cache is not None
        assert len(loader.schemes_cache) == 1
        assert loader.schemes_cache[0][2] == 'प्रधानमंत्री किसान सम्मान निधि'

def test_scheme_matching():
    """Should match schemes using fuzzy matching"""
    from gemini_parser import ReferenceDataLoader
    
    with patch('psycopg2.connect') as mock_connect:
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn
        
        # Mock schemes data
        mock_cursor.fetchall.return_value = [
            (1, 'PM_KISAN', 'प्रधानमंत्री किसान सम्मान निधि', 'PM-KISAN', 'central', 'Agriculture', 'किसानों को वित्तीय सहायता')
        ]
        
        loader = ReferenceDataLoader()
        matched = loader.match_scheme("प्रधानमंत्री किसान सम्मान निधि के तहत सहायता")
        
        assert len(matched) == 1
        assert matched[0]['id'] == 1
        assert matched[0]['name_hi'] == 'प्रधानमंत्री किसान सम्मान निधि'
