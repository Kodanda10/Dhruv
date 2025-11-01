from typing import Dict

_counters: Dict[str, int] = {
    'alias_hits_total': 0,
    'alias_misses_total': 0,
    'normalize_calls_total': 0,
}


def inc(name: str, by: int = 1) -> None:
    _counters[name] = _counters.get(name, 0) + by


def snapshot() -> Dict[str, int]:
    return dict(_counters)

