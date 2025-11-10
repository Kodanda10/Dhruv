import json
import re

def normalize_key(text):
    """Converts text to lowercase, collapses whitespace, and removes Zero Width Joiner characters."""
    if isinstance(text, str):
        # Remove Zero Width Joiner and then collapse whitespace
        text = text.replace('\u200d', '')
        return re.sub(r'\s+', '', text).lower()
    elif isinstance(text, list):
        return [normalize_key(item) for item in text]
    return text

def load_json_data(filepath):
    """Loads JSON data from a given filepath."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: File not found at {filepath}")
        return None
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from {filepath}")
        return None

def validate_constituencies(existing_data, authoritative_data):
    """
    Validates existing constituency data against authoritative data.
    Reports discrepancies and coverage.
    """
    if not existing_data or not authoritative_data:
        print("Validation cannot proceed due to missing data.")
        return

    print("Starting constituency data validation...")
    discrepancies = []
    coverage_report = {}

    existing_districts = existing_data.get('districts', {})
    authoritative_districts = authoritative_data.get('districts', {})

    # Check for district coverage
    for district_name, district_data in existing_districts.items():
        normalized_district_name = normalize_key(district_name)
        if normalized_district_name not in [normalize_key(k) for k in authoritative_districts.keys()]:
            discrepancies.append(f"Missing district in authoritative data: {district_name}")
            continue

        # Find the matching authoritative district (case-insensitive)
        auth_district_name = next((k for k in authoritative_districts.keys() if normalize_key(k) == normalized_district_name), None)
        if not auth_district_name:
            continue # Should not happen due to previous check

        auth_district_data = authoritative_districts[auth_district_name]
        coverage_report[district_name] = {"status": "covered", "details": []}

        # Validate 'assembly'
        if 'assembly' in district_data and 'assembly' in auth_district_data:
            if normalize_key(district_data['assembly']) != normalize_key(auth_district_data['assembly']):
                discrepancies.append(f"District '{district_name}': Assembly mismatch. Existing: '{district_data['assembly']}', Authoritative: '{auth_district_data['assembly']}'")
                coverage_report[district_name]["details"].append(f"Assembly mismatch: Existing: '{district_data['assembly']}', Authoritative: '{auth_district_data['assembly']}'")
        elif 'assembly' in district_data and 'assembly' not in auth_district_data:
            discrepancies.append(f"District '{district_name}': 'assembly' present in existing but not in authoritative.")
            coverage_report[district_name]["details"].append(f"'assembly' present in existing but not in authoritative.")
        elif 'assembly' not in district_data and 'assembly' in auth_district_data:
            discrepancies.append(f"District '{district_name}': 'assembly' missing in existing but present in authoritative.")
            coverage_report[district_name]["details"].append(f"'assembly' missing in existing but present in authoritative.")

        # Validate 'parliamentary'
        existing_parliamentary = set(normalize_key(p) for p in (district_data['parliamentary'] if isinstance(district_data.get('parliamentary'), list) else [district_data.get('parliamentary')]).copy() if p)
        auth_parliamentary = set(normalize_key(p) for p in (auth_district_data['parliamentary'] if isinstance(auth_district_data.get('parliamentary'), list) else [auth_district_data.get('parliamentary')]).copy() if p)

        if existing_parliamentary != auth_parliamentary:
            discrepancies.append(f"District '{district_name}': Parliamentary constituency mismatch. Existing: {existing_parliamentary}, Authoritative: {auth_parliamentary}")
            coverage_report[district_name]["details"].append(f"Parliamentary constituency mismatch: Existing: {existing_parliamentary}, Authoritative: {auth_parliamentary}")

        # Validate 'assemblies' list
        existing_assemblies = set(normalize_key(a) for a in district_data.get('assemblies', []))
        auth_assemblies = set(normalize_key(a) for a in auth_district_data.get('assemblies', []))
        if existing_assemblies != auth_assemblies:
            discrepancies.append(f"District '{district_name}': Assemblies list mismatch. Existing: {existing_assemblies}, Authoritative: {auth_assemblies}")
            coverage_report[district_name]["details"].append(f"Assemblies list mismatch: Existing: {existing_assemblies}, Authoritative: {auth_assemblies}")

        # Validate 'block_names' list
        existing_blocks = set(normalize_key(b) for b in district_data.get('block_names', []))
        auth_blocks = set(normalize_key(b) for b in auth_district_data.get('block_names', []))
        if existing_blocks != auth_blocks:
            discrepancies.append(f"District '{district_name}': Block names list mismatch. Existing: {existing_blocks}, Authoritative: {auth_blocks}")
            coverage_report[district_name]["details"].append(f"Block names list mismatch: Existing: {existing_blocks}, Authoritative: {auth_blocks}")

        # Validate 'ulb_names' list
        existing_ulbs = set(normalize_key(u) for u in district_data.get('ulb_names', []))
        auth_ulbs = set(normalize_key(u) for u in auth_district_data.get('ulb_names', []))
        
        if existing_ulbs != auth_ulbs:
            discrepancies.append(f"District '{district_name}': ULB names list mismatch. Existing: {existing_ulbs}, Authoritative: {auth_ulbs}")
            coverage_report[district_name]["details"].append(f"ULB names list mismatch: Existing: {existing_ulbs}, Authoritative: {auth_ulbs}")

    # Check for authoritative districts not in existing data
    for auth_district_name in authoritative_districts.keys():
        normalized_auth_district_name = normalize_key(auth_district_name)
        if normalized_auth_district_name not in [normalize_key(k) for k in existing_districts.keys()]:
            discrepancies.append(f"Missing district in existing data: {auth_district_name}")
            coverage_report[auth_district_name] = {"status": "missing_in_existing", "details": [f"District '{auth_district_name}' not found in existing data."]}

    if not discrepancies:
        print("\nValidation successful: No discrepancies found.")
    else:
        print("\nValidation completed with discrepancies:")
        for d in discrepancies:
            print(f"- {d}")

    print("\n--- Coverage Report ---")
    for district, report in coverage_report.items():
        print(f"District: {district} - Status: {report['status']}")
        for detail in report['details']:
            print(f"  - {detail}")
    
    # Check for 100% coverage (all authoritative districts are covered and consistent)
    all_authoritative_districts_covered = all(normalize_key(k) in [normalize_key(ek) for ek in existing_districts.keys()] for k in authoritative_districts.keys())
    if all_authoritative_districts_covered and not discrepancies:
        print("\n100% coverage achieved and all data is consistent!")
    elif not all_authoritative_districts_covered:
        print("\nWarning: Not all authoritative districts are covered in the existing data.")
    else:
        print("\nWarning: Coverage might be incomplete or inconsistent due to discrepancies.")


if __name__ == "__main__":
    existing_filepath = 'data/constituencies.json'
    authoritative_filepath = 'data/authoritative_constituencies.json'

    existing_data = load_json_data(existing_filepath)
    authoritative_data = load_json_data(authoritative_filepath)

    if existing_data and authoritative_data:
        validate_constituencies(existing_data, authoritative_data)
