

import os
import json
import hashlib
import time
from datetime import datetime, timedelta
from .dataset_builders.geography_builder import build_geography_dataset
from .dataset_builders.festival_builder import build_festival_dataset
from .dataset_builders.poi_builder import build_poi_dataset
from .dataset_builders.chhattisgarh_schemes_builder import build_chhattisgarh_schemes_dataset
from .dataset_builders.central_schemes_builder import build_central_schemes_dataset
from .dataset_builders.cg_geo_excel_builder import build_cg_geo_excel_dataset
from .dataset_builders.electoral_enrichment import enrich_ndjson_lines

# Database connection
import psycopg2

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'data')
CHECKSUM_FILE = os.path.join(DATA_DIR, 'dataset_checksums.json')

def compute_checksum(data: str) -> str:
    """Compute SHA256 checksum for data integrity."""
    return hashlib.sha256(data.encode('utf-8')).hexdigest()

def load_checksums() -> dict:
    """Load previous checksums from file."""
    if os.path.exists(CHECKSUM_FILE):
        with open(CHECKSUM_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_checksums(checksums: dict):
    """Save checksums to file."""
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(CHECKSUM_FILE, 'w', encoding='utf-8') as f:
        json.dump(checksums, f, indent=2)

def run_etl_for_builder(builder_func, dataset_name: str):
    """Run ETL for a specific dataset builder."""
    print(f"Running ETL for {dataset_name}...")

    # Collect data
    data_lines = list(builder_func())
    data = '\n'.join(data_lines)

    # Compute checksum
    checksum = compute_checksum(data)

    # Load previous checksums
    checksums = load_checksums()

    # Check if data has changed
    if checksums.get(dataset_name) == checksum:
        print(f"No changes for {dataset_name}, skipping update.")
        return

    # Insert into Postgres dims
    conn = psycopg2.connect(
        host="localhost",
        database="dhruv_db",
        user="dhruv_user",
        password="dhruv_pass"
    )
    cursor = conn.cursor()

    if dataset_name == 'geography':
        for line in data_lines:
            record = json.loads(line)
            # Flatten the nested geography hierarchy and insert each village as a separate row
            state = record.get('state')
            for district in record.get('districts', []):
                district_name = district.get('name')
                for ac in district.get('acs', []):
                    ac_name = ac.get('name')
                    for block in ac.get('blocks', []):
                        block_name = block.get('name')
                        for gp in block.get('gps', []):
                            gp_name = gp.get('name')
                            for village in gp.get('villages', []):
                                village_name = village.get('name')
                                pincode = village.get('pincode')
                                # Insert each village with full hierarchy
                                cursor.execute("""
                                    INSERT INTO dims.dim_geography (state, district, ac, block, gp, village, pincode)
                                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                                    ON CONFLICT (state, district, village) DO NOTHING
                                """, (
                                    state,
                                    district_name,
                                    ac_name,
                                    block_name,
                                    gp_name,
                                    village_name,
                                    pincode
                                ))

    elif dataset_name == 'festival':
        for line in data_lines:
            record = json.loads(line)
            # Insert festival
            cursor.execute("""
                INSERT INTO dims.dim_festival (name, type, month, day, description)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (name) DO NOTHING
                RETURNING id
            """, (
                record['name'],
                record['type'],
                record['month'],
                record['day'],
                record.get('description')
            ))
            festival_id = cursor.fetchone()
            if festival_id:
                # Insert dates
                for year, date_str in record.get('year_dates', {}).items():
                    cursor.execute("""
                        INSERT INTO dims.dim_festival_dates (festival_id, year, date)
                        VALUES (%s, %s, %s)
                        ON CONFLICT DO NOTHING
                    """, (festival_id[0], int(year), date_str))

    elif dataset_name == 'poi':
        for line in data_lines:
            record = json.loads(line)
            # Insert POI
            cursor.execute("""
                INSERT INTO dims.dim_poi (name, type, lat, lon, address, osm_id, description)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING
            """, (
                record['name'],
                record['type'],
                record.get('lat'),
                record.get('lon'),
                record.get('address'),
                record.get('osm_id'),
                record.get('description')
            ))

    elif dataset_name == 'geography_excel':
        for line in data_lines:
            record = json.loads(line)
            # Insert flat excel-derived geography (dedup handled in builder)
            cursor.execute("""
                INSERT INTO dims.dim_geography (state, district, ac, block, gp, village, pincode)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (state, district, village) DO NOTHING
            """, (
                'छत्तीसगढ़',
                record.get('district'),
                None,
                record.get('block'),
                record.get('gram_panchayat'),
                record.get('village'),
                record.get('pincode')
            ))
    elif dataset_name in ['chhattisgarh_schemes', 'central_schemes']:
        for line in data_lines:
            record = json.loads(line)
            # Insert scheme (assuming dim_schemes table exists with JSON columns)
            cursor.execute("""
                INSERT INTO dims.dim_schemes (name, type, department, eligibility, benefits, application_process, contact)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (name) DO NOTHING
            """, (
                record['name'],
                record['type'],
                record.get('department'),
                json.dumps(record.get('eligibility', {})),
                json.dumps(record.get('benefits', {})),
                json.dumps(record.get('application_process', {})),
                json.dumps(record.get('contact', {}))
            ))

    conn.commit()
    cursor.close()
    conn.close()

    print(f"Updated {dataset_name} with {len(data_lines)} records.")

    # Update checksum
    checksums[dataset_name] = checksum
    save_checksums(checksums)

def run_monthly_etl():
    """Run monthly ETL for all dataset builders."""
    print("Starting monthly ETL pipeline...")

    # Check if it's time for monthly refresh (placeholder logic)
    # In production, use a scheduler like cron or Airflow
    last_run_file = os.path.join(DATA_DIR, 'last_etl_run.txt')
    now = datetime.now()

    if os.path.exists(last_run_file):
        with open(last_run_file, 'r') as f:
            last_run_str = f.read().strip()
            last_run = datetime.fromisoformat(last_run_str)
            if now - last_run < timedelta(days=30):
                print("Monthly ETL not due yet.")
                return

    # Run ETL for each builder
    run_etl_for_builder(build_geography_dataset, 'geography')
    run_etl_for_builder(build_cg_geo_excel_dataset, 'geography_excel')
    run_etl_for_builder(build_festival_dataset, 'festival')
    run_etl_for_builder(build_poi_dataset, 'poi')
    run_etl_for_builder(build_chhattisgarh_schemes_dataset, 'chhattisgarh_schemes')
    run_etl_for_builder(build_central_schemes_dataset, 'central_schemes')

    # Update last run
    with open(last_run_file, 'w') as f:
        f.write(now.isoformat())

    print("Monthly ETL completed.")

if __name__ == "__main__":
    run_monthly_etl()
