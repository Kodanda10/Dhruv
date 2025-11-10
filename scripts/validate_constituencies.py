import json
import re

def normalize_key(text):
    """
    Converts text to lowercase, removes Zero Width Joiner characters,
    removes '_x000D_', and collapses multiple spaces to a single space.
    """
    if isinstance(text, str):
        text = text.replace('‍', '')
        text = text.replace('_x000D_', '') # Remove the specific suffix
        return re.sub(r'\s+', ' ', text).strip().lower() # Collapse multiple spaces to single, strip, then lowercase
    elif isinstance(text, list):
        return [normalize_key(item) for item in text]
    return text

def load_json_data(filepath):
    """Loads JSON data from a given filepath."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            # Attempt to strip markdown code block delimiters if present (for robustness)
            if content.startswith('```json'):
                content = content[len('```json'):].strip()
            if content.endswith('```'):
                content = content[:-len('```')].strip()
            return json.loads(content)
    except FileNotFoundError:
        print(f"Error: File not found at {filepath}")
        return None
    except json.JSONDecodeError as e:
        print(f"Error: Could not decode JSON from {filepath}. Details: {e}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred while reading/parsing {filepath}: {e}")
        return None

def validate_all_constituencies(existing_data, aggregated_data, name_map_filepath):
    """
    Validates all district entries in existing_data against aggregated_data,
    using a name map for canonical district names.
    """
    if not existing_data or not aggregated_data:
        print("Validation cannot proceed due to missing data.")
        return

    district_name_map = load_json_data(name_map_filepath)
    if not district_name_map:
        print("Warning: District name map not loaded. Proceeding without canonical mapping for validation.")
        district_name_map = {}

    print("Starting comprehensive constituency data validation...")
    all_discrepancies = []
    all_coverage_reports = {}

    # Create a map for existing districts with normalized keys for easier lookup
    existing_districts_canonical_map = {}
    for k, v in existing_data.get('districts', {}).items():
        canonical_k = district_name_map.get(normalize_key(k), normalize_key(k)) # Use map for existing keys
        existing_districts_canonical_map[canonical_k] = (k, v) # Store original key and value

    for aggregated_district_name_raw, aggregated_district_details in aggregated_data.items():
        # The aggregated_district_name_raw is already canonical Hindi name from aggregate_ndjson_data.py
        canonical_agg_district_name = aggregated_district_name_raw
        normalized_agg_district_name = normalize_key(canonical_agg_district_name)
        
        discrepancies_for_district = []
        coverage_report_for_district = {"status": "covered", "details": []}

        if normalized_agg_district_name not in existing_districts_canonical_map:
            discrepancies_for_district.append(f"District '{canonical_agg_district_name}' from aggregated data not found in existing constituencies.json.")
            coverage_report_for_district["status"] = "missing_in_existing"
            all_discrepancies.extend(discrepancies_for_district)
            all_coverage_reports[canonical_agg_district_name] = coverage_report_for_district
            continue

        # Get the original name and data from existing_constituencies_data
        original_existing_name, existing_district_entry = existing_districts_canonical_map[normalized_agg_district_name]

        # Extract data from aggregated source for comparison
        agg_blocks_list = sorted(list(set(aggregated_district_details.get("blocks", []))))

        # Validate 'block_names' list
        existing_blocks = set(normalize_key(b) for b in existing_district_entry.get('block_names', []))
        agg_blocks = set(normalize_key(b) for b in agg_blocks_list)
        if existing_blocks != agg_blocks:
            discrepancies_for_district.append(f"District '{original_existing_name}': Block names list mismatch. Existing: {existing_blocks}, Aggregated: {agg_blocks}")
            coverage_report_for_district["details"].append(f"Block names list mismatch: Existing: {existing_blocks}, Aggregated: {agg_blocks}")

        # For 'assembly', 'parliamentary', 'assemblies', 'ulb_names', we are preserving existing data
        # and aggregated_data doesn't provide them, so we can't validate against it directly.
        # We can add checks here if we have another authoritative source for these fields.

        if discrepancies_for_district:
            all_discrepancies.extend(discrepancies_for_district)
            all_coverage_reports[original_existing_name] = coverage_report_for_district
        else:
            all_coverage_reports[original_existing_name] = {"status": "consistent", "details": ["No discrepancies found for blocks."]}

    # Check for districts in existing_data that are not in aggregated_data
    agg_district_names_normalized = {normalize_key(k) for k in aggregated_data.keys()}
    for existing_district_name_raw, existing_district_details in existing_data.get('districts', {}).items():
        normalized_existing_district_name = normalize_key(existing_district_name_raw)
        if normalized_existing_district_name not in agg_district_names_normalized:
            all_discrepancies.append(f"District '{existing_district_name_raw}' in existing constituencies.json not found in aggregated data.")
            all_coverage_reports[existing_district_name_raw] = {"status": "missing_in_aggregated", "details": [f"District '{existing_district_name_raw}' not found in aggregated data."]}


    if not all_discrepancies:
        print("\nValidation successful: No discrepancies found across all districts for blocks.")
    else:
        print("\nValidation completed with discrepancies:")
        for d in all_discrepancies:
            print(f"- {d}")

    print("\n--- Comprehensive Coverage Report ---")
    for district, report in all_coverage_reports.items():
        print(f"District: {district} - Status: {report['status']}")
        for detail in report['details']:
            print(f"  - {detail}")
    
    if not all_discrepancies:
        print("\nAll district block data is consistent with the aggregated hierarchy extract!")
    else:
        print("\nWarning: Some district block data is inconsistent with or missing from the aggregated hierarchy extract.")


if __name__ == "__main__":
    constituencies_filepath = 'data/constituencies.json'
    aggregated_filepath = 'data/aggregated_constituency_data.json'
    name_map_filepath = 'data/district_name_map.json'

    existing_data = load_json_data(constituencies_filepath)
    aggregated_data = load_json_data(aggregated_filepath)

    if existing_data and aggregated_data:
        validate_all_constituencies(existing_data, aggregated_data, name_map_filepath)
