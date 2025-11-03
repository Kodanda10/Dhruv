#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Convert Chhattisgarh Geography NDJSON to CSV

This script converts the comprehensive Chhattisgarh geography dataset from NDJSON to CSV format.
The source dataset contains 18,909 villages across 33 districts, 147 blocks, and 11,620 panchayats.

Source: data/datasets/chhattisgarh_geography.ndjson
Output: data/chhattisgarh_complete_geography.csv
"""

import json
import csv
import os
import sys
from typing import Dict, Any

def convert_ndjson_to_csv():
    """Convert the NDJSON geography dataset to CSV format."""
    
    # Input and output paths
    input_file = "data/datasets/chhattisgarh_geography.ndjson"
    output_file = "data/chhattisgarh_complete_geography.csv"
    
    # Check if input file exists
    if not os.path.exists(input_file):
        print(f"Error: Input file {input_file} not found!")
        return False
    
    print(f"Converting {input_file} to {output_file}...")
    
    # Define CSV columns
    csv_columns = [
        'district',
        'district_hindi',
        'district_nukta_hindi', 
        'district_english',
        'district_transliteration',
        'block',
        'block_hindi',
        'block_nukta_hindi',
        'block_english', 
        'block_transliteration',
        'gram_panchayat',
        'gram_panchayat_english',
        'village',
        'village_english',
        'composite_key',
        'source_file',
        'source_row_index'
    ]
    
    try:
        with open(input_file, 'r', encoding='utf-8') as infile, \
             open(output_file, 'w', encoding='utf-8', newline='') as outfile:
            
            writer = csv.DictWriter(outfile, fieldnames=csv_columns)
            writer.writeheader()
            
            line_count = 0
            for line in infile:
                line = line.strip()
                if not line:
                    continue
                    
                try:
                    data = json.loads(line)
                    
                    # Extract data for CSV row
                    csv_row = {
                        'district': data.get('district', ''),
                        'district_hindi': data.get('variants', {}).get('district', {}).get('hindi', ''),
                        'district_nukta_hindi': data.get('variants', {}).get('district', {}).get('nukta_hindi', ''),
                        'district_english': data.get('variants', {}).get('district', {}).get('english', ''),
                        'district_transliteration': data.get('variants', {}).get('district', {}).get('transliteration', ''),
                        'block': data.get('block', ''),
                        'block_hindi': data.get('variants', {}).get('block', {}).get('hindi', ''),
                        'block_nukta_hindi': data.get('variants', {}).get('block', {}).get('nukta_hindi', ''),
                        'block_english': data.get('variants', {}).get('block', {}).get('english', ''),
                        'block_transliteration': data.get('variants', {}).get('block', {}).get('transliteration', ''),
                        'gram_panchayat': data.get('gram_panchayat', ''),
                        'gram_panchayat_english': data.get('gram_panchayat_english', ''),
                        'village': data.get('village', ''),
                        'village_english': data.get('village_english', ''),
                        'composite_key': data.get('composite_key', ''),
                        'source_file': data.get('source', {}).get('file', ''),
                        'source_row_index': data.get('source', {}).get('row_index', '')
                    }
                    
                    writer.writerow(csv_row)
                    line_count += 1
                    
                    if line_count % 1000 == 0:
                        print(f"Processed {line_count} records...")
                        
                except json.JSONDecodeError as e:
                    print(f"Error parsing JSON on line {line_count + 1}: {e}")
                    continue
            
            print(f"Successfully converted {line_count} records to CSV!")
            print(f"Output file: {output_file}")
            return True
            
    except Exception as e:
        print(f"Error during conversion: {e}")
        return False

if __name__ == "__main__":
    success = convert_ndjson_to_csv()
    sys.exit(0 if success else 1)









