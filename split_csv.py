#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Split Chhattisgarh Geography CSV into smaller files

This script splits the large CSV file into smaller chunks of 9999 rows each.
"""

import csv
import os
import sys
import math

def split_csv_file():
    """Split the CSV file into smaller chunks."""
    
    input_file = "data/chhattisgarh_complete_geography.csv"
    rows_per_file = 9999
    
    # Check if input file exists
    if not os.path.exists(input_file):
        print(f"Error: Input file {input_file} not found!")
        return False
    
    print(f"Splitting {input_file} into files with {rows_per_file} rows each...")
    
    try:
        with open(input_file, 'r', encoding='utf-8') as infile:
            reader = csv.reader(infile)
            header = next(reader)  # Read the header row
            
            # Count total rows
            total_rows = sum(1 for row in reader)
            infile.seek(0)  # Reset to beginning
            next(reader)  # Skip header again
            
            print(f"Total data rows: {total_rows}")
            
            # Calculate number of files needed
            num_files = math.ceil(total_rows / rows_per_file)
            print(f"Number of files to create: {num_files}")
            
            # Create output directory
            output_dir = "data/split_csv"
            os.makedirs(output_dir, exist_ok=True)
            
            current_file_num = 1
            current_row_count = 0
            current_writer = None
            current_file = None
            
            for row_num, row in enumerate(reader, 1):
                # Start new file if needed
                if current_row_count == 0:
                    if current_file:
                        current_file.close()
                    
                    output_filename = f"chhattisgarh_geography_part_{current_file_num:02d}.csv"
                    output_path = os.path.join(output_dir, output_filename)
                    current_file = open(output_path, 'w', encoding='utf-8', newline='')
                    current_writer = csv.writer(current_file)
                    current_writer.writerow(header)  # Write header to each file
                    
                    print(f"Creating file {current_file_num}: {output_filename}")
                
                # Write the row
                current_writer.writerow(row)
                current_row_count += 1
                
                # Check if we need to start a new file
                if current_row_count >= rows_per_file:
                    print(f"  - File {current_file_num} completed with {current_row_count} rows")
                    current_file_num += 1
                    current_row_count = 0
            
            # Close the last file
            if current_file:
                if current_row_count > 0:
                    print(f"  - File {current_file_num} completed with {current_row_count} rows")
                current_file.close()
            
            print(f"\nSuccessfully split CSV into {num_files} files!")
            print(f"Output directory: {output_dir}")
            
            # List the created files
            print("\nCreated files:")
            for i in range(1, num_files + 1):
                filename = f"chhattisgarh_geography_part_{i:02d}.csv"
                filepath = os.path.join(output_dir, filename)
                if os.path.exists(filepath):
                    file_size = os.path.getsize(filepath)
                    with open(filepath, 'r', encoding='utf-8') as f:
                        line_count = sum(1 for line in f) - 1  # Subtract header
                    print(f"  - {filename}: {line_count} rows, {file_size:,} bytes")
            
            return True
            
    except Exception as e:
        print(f"Error during splitting: {e}")
        return False

if __name__ == "__main__":
    success = split_csv_file()
    sys.exit(0 if success else 1)










