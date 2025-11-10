from api.src.app import app


def test_health_ok():
    client = app.test_client()
    rv = client.get('/api/health')
    assert rv.status_code == 200
    data = rv.get_json()
    assert data['status'] == 'ok'
    assert 'traceId' in data

