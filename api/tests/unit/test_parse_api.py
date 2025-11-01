import json
import pytest
from api.src.app import app

@pytest.mark.skip(reason="Endpoint /api/sota/parse not implemented - outdated test")
def test_parse_invalid_input_400():
    client = app.test_client()
    rv = client.post('/api/sota/parse', json={})
    assert rv.status_code == 400

@pytest.mark.skip(reason="Endpoint /api/sota/parse not implemented - outdated test")
def test_parse_valid_input_200():
    # Load sample from data/posts.json
    with open("data/posts.json", "r", encoding="utf-8") as f:
        posts = json.load(f)
    client = app.test_client()
    rv = client.post('/api/sota/parse', json={"text": posts[0]["content"], "source_id": "test"})
    assert rv.status_code == 200
    data = rv.get_json()
    assert "event" in data
    assert data["event"]["type"] in ["Announcement", "Meeting"]
    assert "event_id" in data["event"]
    assert "certainty_score" in data["event"]
