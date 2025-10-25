import json
import pytest

from api.src.app import create_app


class FakeCursor:
    def __init__(self, scenario, real_dict=False):
        self.scenario = scenario
        self.real_dict = real_dict
        self._rows = None

    def execute(self, sql, params=None):
        s = ' '.join(sql.split()).lower()
        # Query tweet text + attached tags aggregate
        if 'from raw_tweets' in s and 'left join tweet_tags' in s and 'where rt.tweet_id' in s:
            text = self.scenario.get('tweet_text', '')
            if self.real_dict:
                self._rows = [{'tweet_text': text, 'attached': []}]
            else:
                self._rows = [(text, [])]
            return
        # Load tags + aliases for suggestions
        if 'from tags t left join tag_aliases a' in s:
            items = self.scenario.get('tags_aliases', [])
            if self.real_dict:
                self._rows = [{'label_hi': i['label_hi'], 'alias': i.get('alias')} for i in items]
            else:
                self._rows = [(i['label_hi'], i.get('alias')) for i in items]
            return

    def fetchone(self):
        if isinstance(self._rows, list):
            return self._rows[0] if self._rows else None
        return self._rows

    def fetchall(self):
        return self._rows or []

    def close(self):
        pass


class FakeConn:
    def __init__(self, scenario=None):
        self.scenario = scenario or {}

    def cursor(self, *_, **kwargs):
        return FakeCursor(self.scenario, real_dict=bool(kwargs.get('cursor_factory')))

    def commit(self):
        pass

    def close(self):
        pass


@pytest.fixture(autouse=True)
def set_db_env(monkeypatch):
    monkeypatch.setenv('DATABASE_URL', 'postgres://user:pass@localhost:5432/db')


def test_get_tweet_tags_returns_attached_and_suggestions(monkeypatch):
    import psycopg2
    scenario = {
        'tweet_text': 'गाँव में जल जीवन के कार्यों की समीक्षा की गई।',
        'tags_aliases': [
            {'label_hi': 'जल जीवन मिशन', 'alias': 'जल जीवन'},
            {'label_hi': 'स्वच्छ भारत मिशन', 'alias': 'स्वच्छ भारत'},
        ],
    }
    monkeypatch.setattr(psycopg2, 'connect', lambda *_a, **_k: FakeConn(scenario))

    app = create_app()
    client = app.test_client()

    resp = client.get('/api/tweets/123/tags')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['success'] is True
    assert data['attached'] == []
    # Suggestions include जल जीवन मिशन
    sug = data.get('suggested', [])
    assert any(t['label_hi'] == 'जल जीवन मिशन' for t in sug)
    # Confidence should be present
    c = next(t['confidence'] for t in sug if t['label_hi'] == 'जल जीवन मिशन')
    assert c >= 0.6


