import json
import pytest

from api.src.sota.dataset_builders import electoral_enrichment as mod


def write_lookup(tmp_path, payload):
    path = tmp_path / "lookup.json"
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return str(path)


def test_enrich_ulb_specific_match(tmp_path):
    lookup_payload = {
        "districts": {
            "रायपुर": {
                "assembly": "रायपुर ग्रामीण",
                "parliamentary": "रायपुर",
                "ulbs": {
                    "रायपुर नगर निगम": {
                        "assembly": "रायपुर शहर उत्तर",
                        "parliamentary": "रायपुर"
                    }
                }
            }
        }
    }
    lookup_path = write_lookup(tmp_path, lookup_payload)
    rejects_path = tmp_path / "rejects.ndjson"

    records = [
        json.dumps({"district": "रायपुर", "ulb": "रायपुर नगर निगम", "ward": "वार्ड 1"}, ensure_ascii=False)
    ]

    enriched_lines = list(
        mod.enrich_ndjson_lines(
            records,
            lookup_path=lookup_path,
            rejects_path=str(rejects_path),
            strict=False,
            source_label="test"
        )
    )

    assert len(enriched_lines) == 1
    record = json.loads(enriched_lines[0])
    assert record["assembly_constituency"] == "रायपुर शहर उत्तर"
    assert record["parliamentary_constituency"] == "रायपुर"
    assert record["electoral_match_level"] == "ulb"
    # rejects file should be empty
    assert not rejects_path.exists()


def test_enrich_missing_records_strict_writes_reject(tmp_path):
    lookup_payload = {
        "रायपुर": {
            "assembly": "रायपुर शहर उत्तर",
            "parliamentary": "रायपुर"
        }
    }
    lookup_path = write_lookup(tmp_path, lookup_payload)
    rejects_path = tmp_path / "rejects.ndjson"

    records = [
        json.dumps({"district": "रायपुर"}, ensure_ascii=False),
        json.dumps({"district": "अज्ञात"}, ensure_ascii=False),
    ]

    with pytest.raises(ValueError) as exc:
        list(
            mod.enrich_ndjson_lines(
                records,
                lookup_path=lookup_path,
                rejects_path=str(rejects_path),
                strict=True,
                source_label="strict-test"
            )
        )
    assert "missing 1" in str(exc.value)
    assert rejects_path.exists()
    data = [json.loads(line) for line in rejects_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert len(data) == 1
    reject_entry = data[0]
    assert reject_entry["reason"] == "lookup_miss"
    assert reject_entry["district"] == "अज्ञात"


def test_enrich_non_strict_skips_missing(tmp_path):
    lookup_payload = {
        "districts": {
            "रायपुर": {
                "assembly": "रायपुर शहर उत्तर",
                "parliamentary": "रायपुर"
            }
        }
    }
    lookup_path = write_lookup(tmp_path, lookup_payload)
    rejects_path = tmp_path / "rejects.ndjson"

    records = [
        json.dumps({"district": "रायपुर"}, ensure_ascii=False),
        json.dumps({"district": "अज्ञात"}, ensure_ascii=False),
    ]

    enriched_lines = list(
        mod.enrich_ndjson_lines(
            records,
            lookup_path=lookup_path,
            rejects_path=str(rejects_path),
            strict=False,
            source_label="non-strict"
        )
    )

    # Only the matched record should be returned
    assert len(enriched_lines) == 1
    enriched = json.loads(enriched_lines[0])
    assert enriched["assembly_constituency"] == "रायपुर शहर उत्तर"
    assert enriched["electoral_match_level"] == "district"

    # Reject file should include the unmatched district
    data = [json.loads(line) for line in rejects_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert len(data) == 1
    assert data[0]["district"] == "अज्ञात"
