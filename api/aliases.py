import json
import os
from config import is_flag_enabled

def load_aliases(file_path='api/data/aliases.json'):
    """
    Loads aliases from the given JSON file and builds a reverse index
    mapping variants to their canonical names, gated by a feature flag.
    """
    empty_index = { 'locations': {}, 'tags': {}, 'schemes': {}, 'events': {} }
    
    if not is_flag_enabled('FLAG_ALIAS_LOADER'):
        return empty_index

    if not os.path.exists(file_path):
        return empty_index

    with open(file_path, 'r') as f:
        data = json.load(f)

    alias_index = { 'locations': {}, 'tags': {}, 'schemes': {}, 'events': {} }

    for category, items in data.items():
        if category == 'version':
            continue
        for canonical, details in items.items():
            for variant in details.get('variants', []):
                alias_index[category][variant.lower()] = canonical
            # Also map the canonical name to itself
            alias_index[category][canonical.lower()] = canonical

    return alias_index