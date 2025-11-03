import json
from pathlib import Path

import pytest

from api.validations import great_expectations as mod


def test_run_all_skips_when_flag_disabled(monkeypatch, tmp_path):
    monkeypatch.setenv("FLAG_DATA_VALIDATION", "off")
    out_path = tmp_path / "summary.json"
    summary = mod.run_all(json_out=str(out_path))
    assert summary["status"] == "skipped"
    assert summary["success"] is True
    assert json.loads(out_path.read_text(encoding="utf-8"))["status"] == "skipped"


def test_run_all_success_with_stubbed_suite(monkeypatch, tmp_path):
    monkeypatch.setenv("FLAG_DATA_VALIDATION", "on")

    def fake_builder():
        yield json.dumps({
            "district": "रायपुर",
            "ulb": "रायपुर नगर निगम",
            "ward": "वार्ड 1",
            "composite_key": "r|u|w",
        }, ensure_ascii=False)

    monkeypatch.setattr(mod, "SUITES", [
        {
            "name": "stub_suite",
            "builder": fake_builder,
            "required_columns": ["district", "ulb", "ward", "composite_key"],
            "expectation_func": lambda dataset: None,
        }
    ])

    def fake_validate(df, expectation_funcs):
        assert list(df.columns) == ["district", "ulb", "ward", "composite_key"]
        return {
            "success": True,
            "statistics": {"evaluated_expectations": 0},
            "evaluated_expectations": 0,
            "successful_expectations": 0,
            "unsuccessful_expectations": 0,
        }

    monkeypatch.setattr(mod, "_validate_with_ge", fake_validate)
    out_path = tmp_path / "summary.json"
    summary = mod.run_all(json_out=str(out_path))
    assert summary["status"] == "completed"
    assert summary["success"] is True
    written = json.loads(out_path.read_text(encoding="utf-8"))
    assert written["results"][0]["status"] == "passed"


def test_run_all_records_suite_error(monkeypatch, tmp_path):
    monkeypatch.setenv("FLAG_DATA_VALIDATION", "on")

    def failing_builder():
        yield json.dumps({"district": "A"})  # missing required keys

    monkeypatch.setattr(mod, "SUITES", [
        {
            "name": "bad_suite",
            "builder": failing_builder,
            "required_columns": ["district", "ulb"],
            "expectation_func": lambda dataset: None,
        }
    ])

    monkeypatch.setattr(mod, "_validate_with_ge", lambda df, funcs: {})
    out_path = tmp_path / "summary.json"
    summary = mod.run_all(json_out=str(out_path))
    assert summary["success"] is False
    result = summary["results"][0]
    assert result["status"] == "error"
    assert "missing required columns" in result["error"]
