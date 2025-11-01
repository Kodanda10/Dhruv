import json
from pathlib import Path

from api.src.sota.dataset_builders.tools import coverage_history as mod


def sample_summary(tmp_path: Path, percent: float) -> Path:
    data = {
        "coverage": {
            "village": {"percent": percent},
            "gram_panchayat": {"percent": percent / 2},
            "overall": {"percent": percent},
        },
        "missing": {
            "unique": {
                "village": 10,
                "gram_panchayat": 5,
                "overall": 15,
            }
        }
    }
    path = tmp_path / "summary.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    return path


def test_append_history_creates_file(tmp_path):
    summary = sample_summary(tmp_path, 12.5)
    history_path = tmp_path / "history.json"
    payload = mod.append_history(summary, history_path, max_points=10)
    assert history_path.exists()
    assert payload["history"][0]["overall_percent"] == 12.5


def test_append_history_truncates(tmp_path):
    history_path = tmp_path / "history.json"
    # Seed with two entries
    seed = {
        "updated_at": "2025-09-01T00:00:00Z",
        "history": [
            {"timestamp": "2025-08-01T00:00:00Z", "overall_percent": 1.0},
            {"timestamp": "2025-08-08T00:00:00Z", "overall_percent": 2.0},
        ],
    }
    history_path.write_text(json.dumps(seed), encoding="utf-8")

    summary = sample_summary(tmp_path, 3.3)
    payload = mod.append_history(summary, history_path, max_points=2)
    assert len(payload["history"]) == 2
    # Ensure the most recent value is present
    assert payload["history"][-1]["overall_percent"] == 3.3
