import json
import os
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

def aggregate_ndjson_data(directory_path):
    """
    Aggregates data from all .ndjson files in a directory into a structured dictionary
    for each district, extracting Blocks, Gram Panchayats, and Villages.
    """
    aggregated_data = {}

    for filename in os.listdir(directory_path):
        if filename.endswith('.ndjson'):
            filepath = os.path.join(directory_path, filename)
            
            district_name_from_ndjson = None
            current_district_data = {
                "blocks": set(),
                "gram_panchayats": set(),
                "villages": set()
            }

            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    for line in f:
                        entry = json.loads(line)
                        
                        if district_name_from_ndjson is None and 'district' in entry:
                            district_name_from_ndjson = entry['district']

                        if 'block' in entry and entry['block']:
                            current_district_data["blocks"].add(entry['block'])
                        if 'gram_panchayat' in entry and entry['gram_panchayat']:
                            current_district_data["gram_panchayats"].add(entry['gram_panchayat'])
                        if 'village' in entry and entry['village']:
                            current_district_data["villages"].add(entry['village'])
                        
            except json.JSONDecodeError as e:
                print(f"Error decoding JSON in {filename}: {e}")
                continue
            except Exception as e:
                print(f"Error processing {filename}: {e}")
                continue
            
            if district_name_from_ndjson:
                # Use the refined normalize_key for the district name
                canonical_district_name = normalize_key(district_name_from_ndjson)
                
                # Convert sets to sorted lists for consistent output
                aggregated_data[canonical_district_name] = {
                    "blocks": sorted(list(current_district_data["blocks"])),
                    "gram_panchayats": sorted(list(current_district_data["gram_panchayats"])),
                    "villages": sorted(list(current_district_data["villages"]))
                }
            else:
                print(f"Warning: Could not determine district name from {filename}. Skipping.")
    
    return aggregated_data

if __name__ == "__main__":
    ndjson_directory = 'data/datasets/by_district'
    
    print(f"Aggregating data from {ndjson_directory}...")
    all_districts_aggregated_data = aggregate_ndjson_data(ndjson_directory)

    print("\n--- Aggregated Data Summary ---")
    for district, data in all_districts_aggregated_data.items():
        print(f"District: {district}")
        print(f"  Blocks: {len(data['blocks'])}")
        print(f"  GPs: {len(data['gram_panchayats'])}")
        print(f"  Villages: {len(data['villages'])}")
    
    # Optionally save the aggregated data to a JSON file for inspection
    with open('data/aggregated_constituency_data.json', 'w', encoding='utf-8') as f:
        json.dump(all_districts_aggregated_data, f, ensure_ascii=False, indent=2)
    print("\nAggregated data saved to data/aggregated_constituency_data.json")