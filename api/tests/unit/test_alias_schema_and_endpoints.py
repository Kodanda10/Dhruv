import os
from api.src.app import app
from api.src.parsing.alias_loader import validate_aliases


def test_validate_aliases_confidence_range():
    bad = {'tags': {'x': {'variants': [], 'confidence': 2}}, 'locations': {}}
    ok, msg = validate_aliases(bad)
    assert not ok


def test_aliases_etag_and_payload():
    client = app.test_client()
    rv = client.get('/api/aliases')
    assert rv.status_code == 200
    # ETag should be present for caching
    assert 'ETag' in rv.headers or 'Etag' in rv.headers
    data = rv.get_json()
    assert 'version' in data


def test_hot_reload_respects_flag():
    os.environ['FLAG_ALIAS_LOADER'] = 'off'
    client = app.test_client()
    rv = client.post('/api/aliases/reload')
    assert rv.status_code == 400
    os.environ['FLAG_ALIAS_LOADER'] = 'on'
    rv2 = client.post('/api/aliases/reload')
    assert rv2.status_code == 200
    data = rv2.get_json()
    assert data.get('reloaded') is True


def test_normalize_batch_endpoint_shape():
    client = app.test_client()
    batch = {
        'items': [
            {'text': 'दिल्ली में बैठक', 'tokens': ['दिल्ली', '#बैठक']},
            {'text': 'Grand Samaroh', 'tokens': ['Samaroh']},
        ]
    }
    rv = client.post('/api/normalize/batch', json=batch)
    assert rv.status_code == 200
    data = rv.get_json()
    assert isinstance(data.get('items'), list)
    assert len(data['items']) == 2
    assert 'traceId' in data['items'][0]

