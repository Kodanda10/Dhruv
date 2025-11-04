import os
from api.src.parsing.alias_loader import load_aliases, validate_aliases


def test_load_aliases_seed_ok():
    path = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'aliases.json')
    idx = load_aliases(path)
    assert idx.version >= 1
    assert 'दिल्ली' in idx.variant_to_canonical
    assert 'bombay' in idx.variant_to_canonical


def test_validate_aliases_schema():
    ok, msg = validate_aliases({'tags': {'x': {'variants': []}}, 'locations': {}})
    assert ok, msg


def test_validate_aliases_rejects_bad_types():
    bad = {'tags': {'x': {'variants': 'not-a-list'}}, 'locations': {}}
    ok, msg = validate_aliases(bad)
    assert not ok
