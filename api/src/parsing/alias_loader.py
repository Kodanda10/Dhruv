import json
import os
from typing import Dict, Any, Tuple


class AliasIndex:
    def __init__(self, data: Dict[str, Any]):
        self.version = data.get('version', 1)
        self.tags = data.get('tags', {})
        self.locations = data.get('locations', {})
        # variant -> (domain, canonical)
        self.variant_to_canonical: Dict[str, Tuple[str, str]] = {}
        # canonical -> payload including variants/confidence/source
        self.canonical_payload: Dict[Tuple[str, str], Dict[str, Any]] = {}
        self._build_index()

    def _build_index(self):
        def ingest(domain: str, table: Dict[str, Any]):
            for canonical, payload in table.items():
                key = (domain, canonical)
                self.canonical_payload[key] = payload
                self.variant_to_canonical[canonical] = (domain, canonical)
                for v in payload.get('variants', []):
                    self.variant_to_canonical[v] = (domain, canonical)

        ingest('tags', self.tags)
        ingest('locations', self.locations)

    def lookup(self, token: str):
        """Return (domain, canonical, payload) if token maps to an alias, else None."""
        hit = self.variant_to_canonical.get(token)
        if not hit:
            return None
        payload = self.canonical_payload.get(hit, {})
        return hit[0], hit[1], payload


def validate_aliases(data: Dict[str, Any]) -> Tuple[bool, str]:
    if not isinstance(data, dict):
        return False, 'root not dict'
    for domain in ['tags', 'locations']:
        table = data.get(domain, {})
        if not isinstance(table, dict):
            return False, f'{domain} not dict'
        for canonical, payload in table.items():
            if not isinstance(payload, dict):
                return False, f'{domain}.{canonical} not dict'
            if 'variants' not in payload:
                return False, f'{domain}.{canonical}.variants missing'
            if not isinstance(payload['variants'], list):
                return False, f'{domain}.{canonical}.variants not list'
            if 'confidence' in payload:
                c = payload['confidence']
                if not isinstance(c, (int, float)):
                    return False, f'{domain}.{canonical}.confidence not number'
                if not (0 <= float(c) <= 1):
                    return False, f'{domain}.{canonical}.confidence out of range'
    return True, 'ok'


def load_aliases(path: str) -> AliasIndex:
    if not os.path.exists(path):
        raise FileNotFoundError(path)
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    ok, msg = validate_aliases(data)
    if not ok:
        raise ValueError(f'aliases.json invalid: {msg}')
    return AliasIndex(data)
