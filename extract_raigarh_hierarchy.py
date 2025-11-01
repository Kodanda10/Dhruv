#!/usr/bin/env python3
"""
Extract Raigarh Assembly Constituency > Block > ULB/Village hierarchy
from Chhattisgarh geography dataset.
"""

import json
from collections import defaultdict

def main():
    # Read the constituencies data
    with open('data/constituencies.json', 'r', encoding='utf-8') as f:
        constituencies_data = json.load(f)
    
    # Read the Raigarh district detailed data
    villages_data = []
    with open('data/datasets/by_district/र-यगढ़.ndjson', 'r', encoding='utf-8') as f:
        for line in f:
            villages_data.append(json.loads(line))
    
    # Get Raigarh district info from constituencies  
    districts = constituencies_data.get('districts', {})
    
    # Find Raigarh key (handle encoding issues)
    raigarh_key = None
    for key in districts.keys():
        if key == 'रायगढ़':
            raigarh_key = key
            break
    
    if not raigarh_key:
        # Fallback: get from sorted list (position 27)
        sorted_keys = sorted(districts.keys())
        if len(sorted_keys) >= 27:
            raigarh_key = sorted_keys[26]  # 0-indexed
    
    raigarh_info = districts.get(raigarh_key, {}) if raigarh_key else {}
    assemblies = raigarh_info.get('assemblies', [])
    blocks = raigarh_info.get('block_names', [])
    ulbs = raigarh_info.get('ulb_names', [])
    
    print("=== RAIGARH DISTRICT ASSEMBLY CONSTITUENCIES HIERARCHY ===\n")
    print(f"Parliamentary Constituency: {raigarh_info.get('parliamentary', 'N/A')}")
    print(f"Assembly Constituencies: {', '.join(assemblies)}")
    print(f"Total Blocks: {len(blocks)}")
    print(f"Total ULBs: {len(ulbs)}")
    print()
    
    # Organize village data by block and gram panchayat
    block_hierarchy = defaultdict(lambda: defaultdict(list))
    
    for village in villages_data:
        block_name = village['block']
        gram_panchayat = village['gram_panchayat']
        village_name = village['village']
        
        block_hierarchy[block_name][gram_panchayat].append(village_name)
    
    # Display the hierarchy
    print("=== DETAILED HIERARCHY: ASSEMBLY CONSTITUENCY > BLOCK > GRAM PANCHAYAT > VILLAGES ===\n")
    
    for i, assembly in enumerate(assemblies, 1):
        print(f"{i}. ASSEMBLY CONSTITUENCY: {assembly}")
        print("   " + "="*50)
        
        # For this example, we'll show all blocks under each assembly
        # In reality, you'd need additional mapping data to know which blocks belong to which assembly
        
        for block_name in sorted(block_hierarchy.keys()):
            print(f"   📍 BLOCK: {block_name}")
            
            # Check if block has corresponding ULB
            if block_name in ulbs:
                print(f"      🏛️  ULB: {block_name} (Urban Local Body)")
            
            # Show gram panchayats and villages
            for gp_name in sorted(block_hierarchy[block_name].keys()):
                villages = sorted(block_hierarchy[block_name][gp_name])
                print(f"      📄 Gram Panchayat: {gp_name}")
                print(f"         Villages ({len(villages)}): {', '.join(villages[:5])}")
                if len(villages) > 5:
                    print(f"         ... and {len(villages)-5} more villages")
                print()
        print()
    
    # Summary statistics
    print("=== SUMMARY STATISTICS ===")
    total_villages = len(villages_data)
    total_gps = sum(len(gps) for gps in block_hierarchy.values())
    
    print(f"Total Assembly Constituencies: {len(assemblies)}")
    print(f"Total Blocks: {len(blocks)}")
    print(f"Total Urban Local Bodies (ULBs): {len(ulbs)}")
    print(f"Total Gram Panchayats: {total_gps}")
    print(f"Total Villages: {total_villages}")
    
    # Block-wise breakdown
    print("\n=== BLOCK-WISE BREAKDOWN ===")
    for block_name in sorted(block_hierarchy.keys()):
        gp_count = len(block_hierarchy[block_name])
        village_count = sum(len(villages) for villages in block_hierarchy[block_name].values())
        is_ulb = "✓" if block_name in ulbs else "✗"
        print(f"{block_name}: {gp_count} GPs, {village_count} villages [ULB: {is_ulb}]")
    
    # Export to JSON for further use
    output_data = {
        "district": "रायगढ़",
        "parliamentary_constituency": raigarh_info.get('parliamentary'),
        "assembly_constituencies": assemblies,
        "blocks": blocks,
        "ulbs": ulbs,
        "hierarchy": dict(block_hierarchy),
        "statistics": {
            "assembly_constituencies": len(assemblies),
            "blocks": len(blocks),
            "ulbs": len(ulbs),
            "gram_panchayats": total_gps,
            "villages": total_villages
        }
    }
    
    with open('data/raigarh_hierarchy_extract.json', 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Detailed hierarchy exported to: data/raigarh_hierarchy_extract.json")

if __name__ == "__main__":
    main()