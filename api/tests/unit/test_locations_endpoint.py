import os
import json
import pytest

from api.src.app import create_app


class FakeCursor:
    def __init__(self, rows=None, real_dict=False):
        self.rows = rows or []
        self.real_dict = real_dict
        self.queries = []

    def execute(self, sql, params=None):
        # record queries for assertions if needed
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
        # Return rows as [{'name': '...'}] for RealDictCursor
        rows = self.rows
        if real_dict and rows and isinstance(rows[0], str):
            rows = [{'name': r} for r in rows]
        cur = FakeCursor(rows=rows, real_dict=real_dict)
        self.cursors.append(cur)
        return cur

    def close(self):
        pass


@pytest.fixture(autouse=True)
def set_db_env(monkeypatch):
    monkeypatch.setenv('DATABASE_URL', 'postgres://user:pass@localhost:5432/db')


def test_locations_returns_distinct_names(monkeypatch):
    import psycopg2
    rows = ['रायगढ़', 'रायपुर', 'बिलासपुर']
    monkeypatch.setattr(psycopg2, 'connect', lambda *_a, **_k: FakeConn(rows=rows))

    app = create_app()
    client = app.test_client()

    resp = client.get('/api/locations')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['success'] is True
    assert 'locations' in data and isinstance(data['locations'], list)
    assert 'रायगढ़' in data['locations'] and 'रायपुर' in data['locations']


def test_locations_filters_by_query(monkeypatch):
    import psycopg2
    rows = ['रायगढ़', 'रायपुर', 'बिलासपुर']
    monkeypatch.setattr(psycopg2, 'connect', lambda *_a, **_k: FakeConn(rows=rows))

    app = create_app()
    client = app.test_client()

    resp = client.get('/api/locations?query=राय')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['success'] is True
    # filtered to names that include the substring
    assert set(data['locations']) == {'रायगढ़', 'रायपुर'}



