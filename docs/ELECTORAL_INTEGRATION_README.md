# Chhattisgarh Electoral Data Integration

## Overview

This document describes the process of integrating electoral constituency data into the Chhattisgarh village dataset. The integration uses the Mapbox Tilequery API from the [publicmap/electionmap](https://github.com/publicmap/electionmap/) repository to map each village to its corresponding:

- **Assembly Constituency** (Vidhan Sabha)
- **Parliamentary Constituency** (Lok Sabha)

## Current Status: DRAFT

⚠️ **This is a draft implementation** using open-source electoral boundary data. The user will obtain more authentic government sources for final validation and corrections.

## Requirements

### 1. Mapbox Access Token
- **Free account** required from [mapbox.com](https://account.mapbox.com/)
- Token provides access to the electionmap tileset
- No credit card required for basic usage

### 2. Existing Dataset
- Chhattisgarh village dataset with coordinates (from OSM)
- Located at: `scripts/test.ndjson`

### 3. Dependencies
```bash
pip install requests
```

## Setup Process

### Step 1: Get Mapbox Token
1. Visit [https://account.mapbox.com/access-tokens/](https://account.mapbox.com/access-tokens/)
2. Create a free account
3. Generate a new access token
4. Copy the token (starts with `pk.`)

### Step 2: Set Environment Variable
```bash
export MAPBOX_ACCESS_TOKEN=your_token_here
```

### Step 3: Run Integration
```bash
# Using the setup script (recommended)
./scripts/setup_electoral_integration.sh

# Or manually
python3 scripts/enhance_chhattisgarh_with_electoral_data.py
```

## Files Overview

```
scripts/
├── enhance_chhattisgarh_with_electoral_data.py  # Legacy HTTP enrichment script
├── setup_electoral_integration.sh               # Setup and execution script
└── test.ndjson                                  # Input: OSM village dataset

api/src/sota/dataset_builders/
└── electoral_enrichment.py                      # Deterministic offline builder

data/
├── constituencies.json                          # Primary lookup table
└── chhattisgarh_villages_with_electoral.ndjson   # Output: Enriched dataset
```

### New Dataset Builder (Offline)

`scripts/build_constituency_lookup.py` regenerates the lookup consumed by the
enrichment utilities. It derives the district → PC/AC mapping from
`data/Chhattisgarh_District_Vidhansabha List.xlsx`, the list of rural blocks
from `data/CG_Geo_[1..3].xlsx`, and ULB names from `data/CG_Urban_Geo_5.xlsx`.
Because the state does not publish block/ULB level constituency assignments,
the generated JSON records the block and ULB names for reference but only maps
to constituencies at the district level.

`api/src/sota/dataset_builders/electoral_enrichment.py` offers a deterministic,
offline alternative to the HTTP workflow. Key properties:

- Works with any NDJSON iterable (e.g. output from `cg_urban_excel_builder`).
- Adds `assembly_constituency`, `parliamentary_constituency`, and
  `electoral_match_level` fields.
- Logs rejects to `data/rejects/electoral_mismatches.ndjson` and exits with an
  error when strict mode is enabled (default).

Usage examples:

```bash
# Enrich an existing NDJSON file
python api/src/sota/dataset_builders/electoral_enrichment.py \
  --input data/urban.ndjson \
  --output data/urban_with_constituencies.ndjson

# Wrap an in-repo builder (example)
python - <<'PY'
from api.src.sota.dataset_builders.cg_urban_excel_builder import build_cg_urban_excel_dataset
from api.src.sota.dataset_builders.electoral_enrichment import enrich_from_builder

for line in enrich_from_builder(build_cg_urban_excel_dataset):
    print(line)
PY
```

## Output Format

The enhanced dataset maintains the same structure but adds electoral fields:

```json
{
  "state": "छत्तीसगढ़",
  "districts": [
    {
      "name": "Unknown",
      "villages": [
        {
          "name": "Raipur",
          "latitude": 21.2514,
          "longitude": 81.6296,
          "district": "Unknown",
          "source": "osm",
          "assembly_constituency": "रायपुर शहर उत्तर",
          "parliamentary_constituency": "रायपुर"
        }
      ]
    }
  ],
  "metadata": {
    "electoral_enhanced": true,
    "last_updated": "2024-01-15T10:30:00Z",
    "total_villages": 818
  }
}
```

## Validation Steps

### 1. Check Coverage
```bash
# Count villages with electoral data
grep -c '"assembly_constituency"' data/chhattisgarh_villages_with_electoral.ndjson
grep -c '"parliamentary_constituency"' data/chhattisgarh_villages_with_electoral.ndjson
```

### 2. Sample Validation
```bash
# Check a few known villages
python3 -c "
import json
with open('data/chhattisgarh_villages_with_electoral.ndjson') as f:
    data = json.load(f)
    for village in data['districts'][0]['villages'][:5]:
        print(f'{village[\"name\"]}: {village.get(\"assembly_constituency\", \"Missing\")}')
"
```

### 3. Geographic Sanity Check
- Verify that nearby villages have consistent constituency assignments
- Cross-reference with known administrative boundaries

## API Details

### Mapbox Tilequery API
- **Endpoint**: `https://api.mapbox.com/v4/publicmap.electionmap/tilequery/{lon},{lat}.json`
- **Layers**: `assembly_constituencies`, `parliamentary_constituencies`
- **Rate Limit**: ~600 requests/minute (free tier)
- **Coverage**: India-wide electoral boundaries

### Rate Limiting
- Script includes 1-second delays between requests
- Processing 818 villages takes ~15 minutes
- Monitor API usage in Mapbox dashboard

## Known Limitations

### Current Implementation
1. **Draft Status**: Uses open-source boundary data, not official government sources
2. **District Mapping**: All villages currently grouped under "Unknown" district
3. **Boundary Accuracy**: May have minor discrepancies with official boundaries
4. **Real-time Updates**: Electoral boundaries can change with redistricting

### Data Quality
- OSM coordinates may have varying accuracy
- Some villages may fall on boundary lines
- Rural areas may have less precise mapping

## Next Steps

### 1. Authentic Source Integration
- Obtain official electoral boundary data from Election Commission of India
- Cross-validate with State Election Commission data
- Integrate with official census village directories

### 2. Administrative Enhancement
- Map villages to correct districts and blocks
- Add panchayat and revenue circle information
- Include administrative hierarchy validation

### 3. Data Enrichment
- Add population and demographic data
- Include infrastructure and development indicators
- Add historical election data

### 4. Quality Assurance
- Implement automated validation tests
- Cross-reference with multiple data sources
- Add confidence scores for mappings

## Troubleshooting

### Common Issues

**"MAPBOX_ACCESS_TOKEN not set"**
```bash
export MAPBOX_ACCESS_TOKEN=your_actual_token
```

**"Input file not found"**
- Ensure `scripts/test.ndjson` exists
- Run the original OSM fetch script if needed

**API Rate Limiting**
- Increase delay in script: `self.rate_limit_delay = 2.0`
- Consider batch processing for large datasets

**No Electoral Data Found**
- Check coordinates are within India
- Verify Mapbox token has correct permissions
- Some remote areas may not have electoral mappings

## Contributing

### Code Improvements
- Add error handling for edge cases
- Implement caching for repeated coordinates
- Add progress bars for long-running processes

### Data Validation
- Create validation scripts for constituency mappings
- Add geographic boundary validation
- Implement cross-source comparison tools

## References

- [publicmap/electionmap Repository](https://github.com/publicmap/electionmap/)
- [Mapbox Tilequery API Documentation](https://docs.mapbox.com/api/maps/#tilequery)
- [Election Commission of India](https://eci.gov.in/)
- [Chhattisgarh State Election Commission](https://sec.cg.gov.in/)

## Contact

For questions about this integration:
- Check the main project documentation
- Review the script comments for technical details
- Validate against official government sources

---

**Last Updated**: January 2024
**Status**: Draft - Awaiting Authentic Government Sources
