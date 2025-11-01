# Curated Name Backfill Workflow

This walkthrough explains how to convert a curated CSV of name fixes into the
NDJSON artifacts consumed by the dataset builders. The flow uses the existing
`scripts/mappings_from_csv.py` helper and the append-only
`data/name_mappings/missing_names.ndjson` log that is generated whenever the
parsers encounter a name without four variants.

## Inputs

1. **Missing names log** – `data/name_mappings/missing_names.ndjson`
   - Each entry records the `kind` (e.g. `village`) and the English token that
     still needs Hindi/Nukta variants.
2. **Curated CSV** – e.g. `data/name_mappings/curated_names.sample.csv`
   - Required columns: `kind`, `english`, `hindi`, `nukta_hindi`
   - Optional metadata: `district`, `block`, `source`, `verified_by`,
     `verified_on`, `notes`

A minimal curated CSV looks like this:

```csv
kind,english,hindi,nukta_hindi,district,block,source,verified_by,verified_on,notes
village,Chhote Urla,छोटे उरला,छोटे उरला,Raipur,Abhanpur,manual,QA Team,2025-09-15,"High-frequency facebook variant"
Gram_Panchayat,Bhatgaon,भटगांव,भटगाँव,Baloda Bazar,Baloda Bazar,survey,QA Team,2025-09-15,
```

> **Tip:** `nukta_hindi` defaults to the `hindi` value if left blank, but adding
> the explicit nukta form avoids ambiguity.

## Generating NDJSON mappings

```bash
# Dry run (shows summary without writing files)
python api/src/sota/dataset_builders/tools/mappings_from_csv.py \
  --csv data/name_mappings/curated_names.sample.csv \
  --dry-run

# Append NDJSON mappings for the curated rows
python api/src/sota/dataset_builders/tools/mappings_from_csv.py \
  --csv data/name_mappings/curated_names.sample.csv \
  --out-ndjson data/name_mappings/curated_names.sample.ndjson
```

The generated NDJSON can then be merged into `data/name_mappings/geography_name_map.json`
(used by `translation.py`) via:

```bash
python api/src/sota/dataset_builders/tools/mappings_from_csv.py \
  --csv data/name_mappings/curated_names.sample.csv \
  --out-ndjson data/name_mappings/curated_names.sample.ndjson \
  --out-json data/name_mappings/geography_name_map.json \
  --merge-json
```

## Best practices

- Prioritise the highest-occurrence English tokens in
  `missing_names.ndjson` to reduce parser rejects quickly.
- Always track who verified the mapping (`verified_by`, `verified_on`) so the
  audit trail stays intact.
- Keep the curated CSV under version control when possible. The shared template
  lives at `data/name_mappings/curated_names.template.csv`.
- Store command output (NDJSON/JSON) inside `data/name_mappings/` to keep the
  workflow reproducible for other contributors.
