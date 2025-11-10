import json
import re

def normalize_key(text):
    """
    Converts text to lowercase, removes Zero Width Joiner characters,
    removes '_x000D_', and collapses multiple spaces to a single space.
    """
    if isinstance(text, str):
        text = text.replace('\u200d', '')
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
        print(f"An unexpected error occurred while reading/parsing {filepath}: {filepath}: {e}")
        return None

def update_constituency_data_from_aggregated(aggregated_filepath, constituencies_filepath):
    """
    Updates constituencies.json using data from an aggregated .ndjson file.
    Merges new block data while preserving existing assembly, parliamentary, and ULB data.
    """
    aggregated_data = load_json_data(aggregated_filepath)
    if not aggregated_data:
        return

    existing_constituencies_data = load_json_data(constituencies_filepath)
    if not existing_constituencies_data:
        return

    updated_districts = {}

    # Create a map for existing districts with normalized keys for easier lookup
    existing_districts_normalized_map = {normalize_key(k): k for k in existing_constituencies_data.get("districts", {}).keys()}

    for aggregated_district_name_raw, aggregated_district_details in aggregated_data.items():
        # Normalize the aggregated district name for comparison
        normalized_aggregated_district_name = normalize_key(aggregated_district_name_raw)
        
        # Find the actual key in existing_constituencies_data
        actual_existing_district_name = existing_districts_normalized_map.get(normalized_aggregated_district_name)

        if actual_existing_district_name:
            # District exists, merge data
            existing_district_details = existing_constituencies_data["districts"][actual_existing_district_name]
            
            updated_district_details = {
                "assembly": existing_district_details.get("assembly"),
                "parliamentary": existing_district_details.get("parliamentary"),
                "assemblies": existing_district_details.get("assemblies", []),
                "block_names": aggregated_district_details.get("blocks", []), # Update from aggregated data
                "ulb_names": existing_district_details.get("ulb_names", [])
            }
            updated_districts[actual_existing_district_name] = updated_district_details
        else:
            # District from aggregated data is new, create a new entry
            print(f"Warning: District '{aggregated_district_name_raw}' from aggregated data not found in existing constituencies.json. Adding new entry.")
            new_entry = {
                "assembly": None,
                "parliamentary": None,
                "assemblies": [],
                "block_names": aggregated_district_details.get("blocks", []),
                "ulb_names": []
            }
            # Use the normalized name from aggregated data as the key for the new entry
            updated_districts[normalized_aggregated_district_name] = new_entry

    # Add any districts from existing_constituencies_data that are not in aggregated_data
    # This ensures no districts are accidentally removed if aggregated_data is incomplete
    aggregated_district_names_normalized = {normalize_key(k) for k in aggregated_data.keys()}
    for existing_district_name_raw, existing_district_details in existing_constituencies_data["districts"].items():
        normalized_existing_district_name = normalize_key(existing_district_name_raw)
        if normalized_existing_district_name not in aggregated_district_names_normalized:
            updated_districts[existing_district_name_raw] = existing_district_details


    existing_constituencies_data["districts"] = updated_districts

    try:
        with open(constituencies_filepath, 'w', encoding='utf-8') as f:
            json.dump(existing_constituencies_data, f, ensure_ascii=False, indent=2)
        print(f"Successfully updated {constituencies_filepath} with aggregated geography data.")
    except Exception as e:
        print(f"Error writing to {constituencies_filepath}: {e}")

if __name__ == "__main__":
    aggregated_filepath = 'data/aggregated_constituency_data.json'
    constituencies_filepath = 'data/constituencies.json'
    
    update_constituency_data_from_aggregated(aggregated_filepath, constituencies_filepath)