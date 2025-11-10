import pandas as pd
import json
import sys
import re

def normalize_name(name):
    """Converts text to lowercase and collapses whitespace."""
    if isinstance(name, str):
        return re.sub(r'\s+', '', name).lower()
    return name

def process_raigarh_excel(excel_filepath):
    """
    Processes the Raigarh Excel file to extract unique Assembly Constituencies and Blocks.
    """
    try:
        df = pd.read_excel(excel_filepath)

        unique_assembly_constituencies = df['Assembly Constituency'].dropna().unique().tolist()
        unique_blocks = df['Block'].dropna().unique().tolist()

        print("Unique Assembly Constituencies in Raigarh Excel:")
        for ac in unique_assembly_constituencies:
            print(f"- {ac}")

        print("\nUnique Blocks in Raigarh Excel:")
        for block in unique_blocks:
            print(f"- {block}")

        # Optionally, return a structured data for later use
        return {
            "assembly_constituencies": unique_assembly_constituencies,
            "blocks": unique_blocks
        }

    except FileNotFoundError:
        print(f"Error: Excel file not found at {excel_filepath}")
        sys.exit(1)
    except Exception as e:
        print(f"Error processing Excel file: {e}")
        print("Please ensure pandas and openpyxl are installed (`pip install pandas openpyxl`)")
        sys.exit(1)

if __name__ == "__main__":
    excel_filepath = '/Users/abhijita/Projects/Project_Dhruv/Raigarh_Constituency_Data.xlsx'
    
    # Process the Excel data
    raigarh_data = process_raigarh_excel(excel_filepath)

    # Load existing constituencies.json
    try:
        with open('data/constituencies.json', 'r', encoding='utf-8') as f:
            existing_constituencies = json.load(f)
    except FileNotFoundError:
        print("Error: data/constituencies.json not found.")
        existing_constituencies = {"districts": {}}
    except json.JSONDecodeError:
        print("Error: Could not decode JSON from data/constituencies.json.")
        existing_constituencies = {"districts": {}}

    # Update Raigarh entry in existing_constituencies if data was extracted
    if raigarh_data and "रायगढ़" in existing_constituencies["districts"]:
        raigarh_entry = existing_constituencies["districts"]["रायगढ़"]
        
        # Update assemblies
        existing_assemblies_normalized = set(normalize_name(a) for a in raigarh_entry.get('assemblies', []))
        excel_assemblies_normalized = set(normalize_name(a) for a in raigarh_data['assembly_constituencies'])
        
        if existing_assemblies_normalized != excel_assemblies_normalized:
            print("\nDiscrepancy found in Raigarh assemblies. Updating...")
            raigarh_entry['assemblies'] = raigarh_data['assembly_constituencies']
        else:
            print("\nRaigarh assemblies are consistent with Excel data.")

        # Update block_names
        existing_blocks_normalized = set(normalize_name(b) for b in raigarh_entry.get('block_names', []))
        excel_blocks_normalized = set(normalize_name(b) for b in raigarh_data['blocks'])

        if existing_blocks_normalized != excel_blocks_normalized:
            print("Discrepancy found in Raigarh block_names. Updating...")
            raigarh_entry['block_names'] = raigarh_data['blocks']
        else:
            print("Raigarh block_names are consistent with Excel data.")

        # Save the updated constituencies.json (or authoritative_constituencies.json)
        # For now, let's just print the updated Raigarh entry
        print("\nUpdated Raigarh entry (preview):")
        print(json.dumps(raigarh_entry, ensure_ascii=False, indent=2))

        # If we were to update the authoritative_constituencies.json, it would look like this:
        # authoritative_constituencies = {"districts": {}}
        # authoritative_constituencies["districts"]["रायगढ़"] = raigarh_entry
        # with open('data/authoritative_constituencies.json', 'w', encoding='utf-8') as f:
        #     json.dump(authoritative_constituencies, f, ensure_ascii=False, indent=2)
        # print("\nUpdated data/authoritative_constituencies.json with Raigarh data.")
    elif raigarh_data:
        print("\nRaigarh data extracted, but 'रायगढ़' district not found in existing constituencies.json.")
    else:
        print("\nNo Raigarh data extracted from Excel.")
