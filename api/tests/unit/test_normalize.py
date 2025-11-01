from api.src.app import app
import os


def test_normalize_echo_tokens_and_text():
    client = app.test_client()
    payload = {
        'text': 'दिल्ली में बैठक',
        'tokens': ['#बैठक', 'दिल्ली']
    }
    rv = client.post('/api/normalize', json=payload)
    assert rv.status_code == 200
    data = rv.get_json()
    assert data['input']['text'] == payload['text']
    n = data['normalized']
    assert '#बैठक' in n
    assert 'दिल्ली' in n


def test_normalize_alias_hits_samaroh_hinglish():
    # Ensure alias loader is on
    os.environ['FLAG_ALIAS_LOADER'] = 'on'
    client = app.test_client()
    rv = client.post('/api/normalize', json={'text': 'Grand Samaroh today', 'tokens': ['Samaroh']})
    assert rv.status_code == 200
    data = rv.get_json()
    hits = data.get('aliases') or []
    # Expect an alias mapping to समारोह
    assert any(h['canonical'] == 'समारोह' for h in hits)
