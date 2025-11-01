from api.src.app import app


def test_metrics_counters_increment():
    client = app.test_client()
    # Baseline snapshot
    before = client.get('/api/metrics').get_json()
    client.post('/api/normalize', json={'text': 'Grand Samaroh', 'tokens': ['Samaroh']})
    after = client.get('/api/metrics').get_json()
    assert after['normalize_calls_total'] == before.get('normalize_calls_total', 0) + 1

