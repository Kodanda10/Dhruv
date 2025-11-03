import os
from typing import List

from api.src.app import app
from api.src.parsing.prompts import EXTRACTION_PROMPTS


def test_parse_flag_off_returns_503(monkeypatch):
    # Turn off the parse engine via feature flag
    monkeypatch.setenv('FLAG_PARSE_ENGINE', 'off')

    client = app.test_client()
    payload = {"text": "कुछ टेक्स्ट", "entity": "theme"}
    rv = client.post('/api/parse', json=payload)

    # Expect service unavailable when flag is off
    assert rv.status_code == 503
    data = rv.get_json()
    assert data.get('disabled') is True
    assert data.get('flag') == 'FLAG_PARSE_ENGINE'
    assert 'traceId' in data


def test_parse_invalid_entity_returns_400_with_allowed():
    client = app.test_client()
    payload = {"text": "दिल्ली में बैठक", "entity": "unknown_entity"}

    rv = client.post('/api/parse', json=payload)
    assert rv.status_code == 400
    data = rv.get_json()

    # Should include a helpful error and the allowed entities
    assert 'error' in data
    assert 'allowedEntities' in data
    allowed: List[str] = data['allowedEntities']
    assert sorted(allowed) == sorted(list(EXTRACTION_PROMPTS.keys()))


def test_parse_missing_text_returns_400():
    client = app.test_client()
    payload = {"entity": "theme"}  # missing 'text'

    rv = client.post('/api/parse', json=payload)
    assert rv.status_code == 400
    data = rv.get_json()
    assert 'error' in data
    assert 'text' in (data.get('fields') or [])  # e.g., fields: ['text']


def test_parse_success_returns_200_and_parser_result(monkeypatch):
    # Ensure parse engine is enabled
    monkeypatch.setenv('FLAG_PARSE_ENGINE', 'on')

    # Patch the LangExtractParser.parse to avoid external calls
    from api.src.parsing import parser as parser_module
    monkeypatch.setattr(parser_module.LangExtractParser, 'parse', lambda self, text, entity: 'विकास कार्य')

    client = app.test_client()
    payload = {
        "text": "आज रायगढ़ में विकास कार्यों की समीक्षा की। #विकास",
        "entity": "theme",
    }
    rv = client.post('/api/parse', json=payload)
    assert rv.status_code == 200

    data = rv.get_json()
    # Basic contract checks
    assert data.get('entity') == 'theme'
    assert data.get('text') == payload['text']
    assert data.get('result') == 'विकास कार्य'
    assert 'traceId' in data
