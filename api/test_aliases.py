import os
from aliases import load_aliases

def test_load_aliases_when_flag_is_on(monkeypatch):
    """Test that the alias loader works when the feature flag is enabled."""
    monkeypatch.setenv('FLAG_ALIAS_LOADER', 'true')
    alias_index = load_aliases()
    assert alias_index['locations']['raigarh'] == 'रायगढ़'
    assert alias_index['tags']['farmer'] == 'किसान'

def test_load_aliases_when_flag_is_off(monkeypatch):
    """Test that the alias loader returns an empty index when the flag is disabled."""
    monkeypatch.setenv('FLAG_ALIAS_LOADER', 'false')
    alias_index = load_aliases()
    assert alias_index == { 'locations': {}, 'tags': {}, 'schemes': {}, 'events': {} }