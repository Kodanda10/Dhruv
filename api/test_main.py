import pytest
import logging
from main import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_health_check(client, caplog):
    with caplog.at_level(logging.INFO):
        response = client.get('/api/health')
        assert response.status_code == 200
        assert response.json == {'status': 'ok'}
        assert 'Health check endpoint called' in caplog.text

def test_get_aliases(client):
    response = client.get('/api/aliases')
    assert response.status_code == 200
    assert 'locations' in response.json

def test_reload_aliases(client):
    response = client.post('/api/aliases/reload')
    assert response.status_code == 200
    assert response.json == {'status': 'aliases reloaded'}

def test_normalize_endpoint(client):
    response = client.post('/api/normalize', json={'text': 'some text'})
    assert response.status_code == 200
    assert response.json == {'original': 'some text', 'normalized': 'some text'}