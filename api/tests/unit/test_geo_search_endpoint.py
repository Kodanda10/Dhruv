import json
import pytest

from api.src.app import create_app


class FakeCursor:
    def __init__(self, rows=None, real_dict=False):
        self.rows = rows or []
        self.real_dict = real_dict
        self.queries = []

    def execute(self, sql, params=None):
        self.queries.append((sql, params))

    def fetchall(self):
        return self.rows

    def close(self):
        pass


class FakeConn:
    def __init__(self, rows=None):
        self.rows = rows or []
        self.cursors = []

    def cursor(self, *_, **kwargs):
        real_dict = bool(kwargs.get('cursor_factory'))
        cur = FakeCursor(rows=self.rows, real_dict=real_dict)
        self.cursors.append(cur)
        return cur

    def close(self):
        pass


@pytest.fixture(autouse=True)
def set_db_env(monkeypatch):
    monkeypatch.setenv('DATABASE_URL', 'postgres://user:pass@localhost:5432/db')


def test_geo_search_returns_labeled_paths(monkeypatch):
    import psycopg2
    rows = [
        {
            'path': [
                {'type': 'district', 'name': 'Raigarh'},
                {'type': 'ac', 'name': 'Kharsia'},
                {'type': 'block', 'name': 'Kharsia'},
                {'type': 'gp', 'name': 'X GP'},
                {'type': 'village', 'name': 'Village A'},
                {'type': 'ward', 'name': '12'},
            ]
        }
    ]
    monkeypatch.setattr(psycopg2, 'connect', lambda *_a, **_k: FakeConn(rows=rows))

    app = create_app()
    client = app.test_client()

    resp = client.get('/api/geo/search?query=raig')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['success'] is True
    assert data['results'] and 'label' in data['results'][0]
    assert 'Raigarh' in data['results'][0]['label']



