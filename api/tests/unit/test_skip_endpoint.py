import json
import pytest

from api.src.app import create_app


class FakeCursor:
    def __init__(self):
        self.queries = []

    def execute(self, sql, params=None):
        self.queries.append((sql, params))

    def close(self):
        pass


class FakeConn:
    def __init__(self):
        self.cursors = []

    def cursor(self, *_, **__):
        cur = FakeCursor()
        self.cursors.append(cur)
        return cur

    def commit(self):
        pass

    def close(self):
        pass


@pytest.fixture(autouse=True)
def set_db_env(monkeypatch):
    monkeypatch.setenv('DATABASE_URL', 'postgres://user:pass@localhost:5432/db')


def test_skip_sets_status_and_needs_review_false(monkeypatch):
    import psycopg2
    conn = FakeConn()
    monkeypatch.setattr(psycopg2, 'connect', lambda *_a, **_k: conn)

    app = create_app()
    client = app.test_client()

    resp = client.post('/api/parsed-events/123/skip', data=json.dumps({'reviewed_by': 'tester'}), content_type='application/json')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['success'] is True

    # verify query updated status and needs_review
    sqls = ' '.join(' '.join(q[0].split()) for q in conn.cursors[0].queries)
    assert 'update parsed_events' in sqls.lower()
    assert 'review_status = \u0027skipped\u0027' in sqls.lower() or 'review_status = \'skipped\'' in sqls.lower()




