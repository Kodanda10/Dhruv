import os
import types
import json
import pytest


from api.src.app import create_app


class FakeCursor:
    def __init__(self, scenario, real_dict=False):
        self.scenario = scenario
        self.queries = []
        self._rows = None
        self.real_dict = real_dict

    # accept any args to mimic psycopg2 API
    def execute(self, sql, params=None):
        self.queries.append((sql, params))
        sql_norm = ' '.join(sql.split()).lower()

        # SELECT list tags
        if 'from tags' in sql_norm and 'order by' in sql_norm and 'select id, slug' in sql_norm:
            rows = [
                {'id': 1, 'slug': 'tag-1', 'label_hi': 'स्वच्छ भारत मिशन', 'label_en': None, 'status': 'active'},
                {'id': 2, 'slug': 'tag-2', 'label_hi': 'जल जीवन मिशन', 'label_en': None, 'status': 'active'},
            ]
            self._rows = rows if self.real_dict else [(r['id'], r['slug'], r['label_hi'], r['label_en'], r['status']) for r in rows]
            return

        # SELECT existing tag by label
        if 'select id from tags where label_hi' in sql_norm:
            label = params[0] if params else None
            if self.scenario.get('tag_exists') and label == self.scenario['tag_exists']:
                self._rows = [(10,)]
            else:
                self._rows = None
            return

        # INSERT new tag
        if 'insert into tags' in sql_norm and 'returning id' in sql_norm:
            # return dict for RealDictCursor, tuple for normal cursor
            self._rows = [{'id': 42, 'slug': 'new-slug'}] if self.real_dict else [(42,)]
            return

        # Upsert tweet_tags
        if 'insert into tweet_tags' in sql_norm:
            self._rows = None
            return

    def fetchall(self):
        return self._rows or []

    def fetchone(self):
        if isinstance(self._rows, list):
            return self._rows[0] if self._rows else None
        if self._rows is None:
            return None
        return self._rows

    def close(self):
        pass


class FakeConn:
    def __init__(self, scenario=None):
        self.scenario = scenario or {}
        self.cursors = []

    def cursor(self, *_, **kwargs):
        real_dict = bool(kwargs.get('cursor_factory'))
        cur = FakeCursor(self.scenario, real_dict=real_dict)
        self.cursors.append(cur)
        return cur

    def commit(self):
        pass

    def close(self):
        pass


@pytest.fixture(autouse=True)
def set_db_env(monkeypatch):
    # Provide a dummy DATABASE_URL so code path proceeds
    monkeypatch.setenv('DATABASE_URL', 'postgres://user:pass@localhost:5432/db')


def test_list_tags_returns_rows(monkeypatch):
    # Patch psycopg2.connect to our fake connection
    import psycopg2
    monkeypatch.setattr(psycopg2, 'connect', lambda *_args, **_kwargs: FakeConn())

    app = create_app()
    client = app.test_client()

    resp = client.get('/api/tags')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['success'] is True
    assert any(t['label_hi'] == 'स्वच्छ भारत मिशन' for t in data['tags'])


def test_create_tag_inserts_when_missing(monkeypatch):
    import psycopg2
    # tag does not exist, so INSERT path should be used
    monkeypatch.setattr(psycopg2, 'connect', lambda *_args, **_kwargs: FakeConn({'tag_exists': None}))

    app = create_app()
    client = app.test_client()

    resp = client.post('/api/tags', data=json.dumps({'label_hi': 'नया टैग'}), content_type='application/json')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['success'] is True
    assert data['id'] == 42


def test_attach_tags_creates_missing_labels_and_links(monkeypatch):
    import psycopg2
    monkeypatch.setattr(psycopg2, 'connect', lambda *_a, **_k: FakeConn())

    app = create_app()
    client = app.test_client()

    payload = {'labels': ['जल जीवन मिशन', 'स्वच्छ भारत मिशन'], 'source': 'human'}
    resp = client.post('/api/tweets/123/tags', data=json.dumps(payload), content_type='application/json')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['success'] is True


