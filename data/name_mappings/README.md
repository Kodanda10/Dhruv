# Name Mapping Seeds

This directory stores the inputs and outputs for autonomous geography name curation.

- `missing_names.ndjson` — NDJSON list of names requiring verification.
- `manual_mappings.json` — deterministic lookups seeded from authoritative portals (gov/nic/census).
- `autocurated/` — generated artifacts written by the web-curation workflow.
- `geography_name_map.json` — normalized map consumed by the app.

To refresh the dataset locally, run `npm run curate:web`. Generated files should be committed alongside changes so CI jobs and scheduled workflows remain deterministic.
