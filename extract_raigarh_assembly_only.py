#!/usr/bin/env python3
"""
Extract ONLY रायगढ़ Assembly Constituency data with complete hierarchy:
Block > Gram Panchayats > Villages / ULB > Ward
"""

import json
import csv
from collections import defaultdict

def main():
    # Read the Raigarh district detailed data
    villages_data = []
    with open('data/datasets/by_district/र-यगढ़.ndjson', 'r', encoding='utf-8') as f:
        for line in f:
            villages_data.append(json.loads(line))
    
    # Read the constituencies data to get assembly mapping
    with open('data/constituencies.json', 'r', encoding='utf-8') as f:
        constituencies_data = json.load(f)
    
    # Get Raigarh district info
    districts = constituencies_data.get('districts', {})
    raigarh_key = None
    for key in districts.keys():
        if key == 'रायगढ़':
            raigarh_key = key
            break
    
    if not raigarh_key:
        sorted_keys = sorted(districts.keys())
        if len(sorted_keys) >= 27:
            raigarh_key = sorted_keys[26]
    
    raigarh_info = districts.get(raigarh_key, {}) if raigarh_key else {}
    assemblies = raigarh_info.get('assemblies', [])
    
    print("=== RAIGARH ASSEMBLY CONSTITUENCY DETAILED HIERARCHY ===\n")
    print(f"Target Assembly Constituency: रायगढ़")
    print(f"All Available Assemblies: {', '.join(assemblies)}")
    print()
    
    # For रायगढ़ assembly constituency, we need to determine which blocks belong to it
    # Since we don't have direct mapping, we'll assume the रायगढ़ block belongs to रायगढ़ assembly
    # and create the hierarchy for that block
    
    target_assembly = "रायगढ़"
    
    # Organize village data by block and gram panchayat
    block_hierarchy = defaultdict(lambda: defaultdict(list))
    
    for village in villages_data:
        block_name = village['block']
        gram_panchayat = village['gram_panchayat']
        village_name = village['village']
        
        block_hierarchy[block_name][gram_panchayat].append(village_name)
    
    # For रायगढ़ Assembly Constituency, we'll focus on blocks that likely belong to it
    # Based on naming convention, रायगढ़ block should belong to रायगढ़ assembly
    target_blocks = ['रायगढ़']  # Main Raigarh block
    
    # Create CSV data for the target assembly constituency
    csv_data = []
    
    print(f"=== ASSEMBLY CONSTITUENCY: {target_assembly} ===\n")
    
    for block_name in target_blocks:
        if block_name in block_hierarchy:
            print(f"📍 BLOCK: {block_name}")
            
            # Check ULBs for this block
            ulbs = raigarh_info.get('ulb_names', [])
            has_ulb = block_name in ulbs
            
            if has_ulb:
                print(f"   🏛️  ULB: {block_name}")
                # For ULBs, we would need ward data, but it's not available in current dataset
                csv_data.append([
                    target_assembly,
                    block_name,
                    "ULB",
                    block_name,
                    "Ward data not available in current dataset",
                    "ULB"
                ])
            
            # Process Gram Panchayats and Villages
            for gp_name in sorted(block_hierarchy[block_name].keys()):
                villages = sorted(set(block_hierarchy[block_name][gp_name]))  # Remove duplicates
                print(f"   📄 Gram Panchayat: {gp_name}")
                print(f"      Villages ({len(villages)}): {', '.join(villages[:10])}")
                if len(villages) > 10:
                    print(f"      ... and {len(villages)-10} more villages")
                
                # Add to CSV data
                for village in villages:
                    csv_data.append([
                        target_assembly,
                        block_name,
                        "Gram Panchayat",
                        gp_name,
                        village,
                        "Village"
                    ])
                print()
            print()
    
    # Create detailed CSV file
    csv_filename = f'data/raigarh_assembly_constituency_detailed.csv'
    with open(csv_filename, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow([
            'Assembly Constituency',
            'Block',
            'Administrative Type',
            'GP/ULB Name',
            'Village/Ward',
            'Entity Type'
        ])
        writer.writerows(csv_data)
    
    # Create summary statistics
    total_villages = len([row for row in csv_data if row[5] == 'Village'])
    total_gps = len(set([row[3] for row in csv_data if row[2] == 'Gram Panchayat']))
    total_ulbs = len([row for row in csv_data if row[5] == 'ULB'])
    
    print("=== SUMMARY STATISTICS ===")
    print(f"Assembly Constituency: {target_assembly}")
    print(f"Blocks Covered: {len(target_blocks)}")
    print(f"Gram Panchayats: {total_gps}")
    print(f"Villages: {total_villages}")
    print(f"ULBs: {total_ulbs}")
    
    # Export structured JSON for the specific assembly constituency
    output_data = {
        "assembly_constituency": target_assembly,
        "blocks": {},
        "statistics": {
            "blocks": len(target_blocks),
            "gram_panchayats": total_gps,
            "villages": total_villages,
            "ulbs": total_ulbs
        }
    }
    
    for block_name in target_blocks:
        if block_name in block_hierarchy:
            output_data["blocks"][block_name] = {
                "gram_panchayats": dict(block_hierarchy[block_name]),
                "has_ulb": block_name in ulbs,
                "ulb_name": block_name if block_name in ulbs else None
            }
    
    json_filename = f'data/raigarh_assembly_constituency_detailed.json'
    with open(json_filename, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Detailed CSV exported to: {csv_filename}")
    print(f"✅ Detailed JSON exported to: {json_filename}")
    
    # Show a sample of the CSV structure
    print(f"\n=== CSV STRUCTURE PREVIEW ===")
    print("Assembly Constituency,Block,Administrative Type,GP/ULB Name,Village/Ward,Entity Type")
    for i, row in enumerate(csv_data[:10]):
        print(','.join(row))
    if len(csv_data) > 10:
        print(f"... and {len(csv_data)-10} more rows")

if __name__ == "__main__":
    main()