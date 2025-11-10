
#!/usr/bin/env python3
"""
Chhattisgarh Village Data Loader
===============================

This script loads comprehensive Chhattisgarh village data from JSON format
and processes it into the database with complete administrative linkages.

Features:
- Loads village data with complete administrative hierarchy
- Validates data integrity and linkages
- Inserts data into PostgreSQL with proper relationships
- Provides comprehensive statistics and validation reports
- Supports incremental updates and data deduplication

Usage:
    python load_chhattisgarh_data.py --input chhattisgarh_real_villages.json --validate
    python load_chhattisgarh_data.py --input chhattisgarh_real_villages.json --load-to-db
    python load_chhattisgarh_data.py --stats --district raipur

Author: Project Dhruv Team
"""

import json
import argparse
import sys
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from datetime import datetime
import psycopg2
from psycopg2.extras import execute_values

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('chhattisgarh_load.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class VillageData:
    """Data structure for village information."""
    village_code: str
    name: str
    name_english: str
    village_type: str
    population_total: int
    population_male: int
    population_female: int
    area_hectares: float
    pincode: str
    latitude: Optional[float]
    longitude: Optional[float]
    tehsil: str
    block: str
    gram_panchayat: str
    assembly_constituency: str
    parliamentary_constituency: str
    development_block: str
    revenue_circle: str
    police_station: str
    post_office: str
    bank_branches: List[str]
    health_centers: List[str]
    schools: List[str]
    electricity_coverage: float
    water_supply: str
    sanitation_coverage: float
    literacy_rate: float
    main_occupation: str
    caste_composition: Dict[str, float]
    infrastructure: Dict[str, str]

@dataclass
class DistrictData:
    """Data structure for district information."""
    name: str
    district_code: str
    headquarters: str
    population: int
    area_km2: int
    subdivisions: int
    tehsils: int
    blocks: int
    gram_panchayats: int
    villages: List[VillageData]

class ChhattisgarhDataLoader:
    """Loader for Chhattisgarh village data."""

    def __init__(self, db_config: Optional[Dict[str, str]] = None):
        self.db_config = db_config or {
            'host': 'localhost',
            'database': 'dhruv_db',
            'user': 'dhruv_user',
            'password': 'dhruv_pass'
        }
        self.data: Optional[Dict[str, Any]] = None

    def load_json_data(self, file_path: str) -> bool:
        """
        Load Chhattisgarh data from JSON file.

        Args:
            file_path: Path to the JSON data file

        Returns:
            True if loaded successfully, False otherwise
        """
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                # Remove markdown formatting if present
                content = content.replace('```json', '').replace('```', '').strip()
                self.data = json.loads(content)

            logger.info(f"Successfully loaded data from {file_path}")
            logger.info(f"State: {self.data['state']}")
            logger.info(f"Districts: {len(self.data['districts'])}")
            logger.info(f"Total villages in sample: {sum(len(d['villages']) for d in self.data['districts'])}")

            return True

        except FileNotFoundError:
            logger.error(f"File not found: {file_path}")
            return False
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error: {e}")
            return False
        except Exception as e:
            logger.error(f"Error loading data: {e}")
            return False

    def validate_data_integrity(self) -> Tuple[bool, List[str]]:
        """
        Validate data integrity and administrative linkages.

        Returns:
            Tuple of (is_valid, list_of_issues)
        """
        issues = []

        if not self.data:
            issues.append("No data loaded")
            return False, issues

        # Validate state-level data
        required_state_fields = ['state', 'state_code', 'capital', 'districts']
        for field in required_state_fields:
            if field not in self.data:
                issues.append(f"Missing required state field: {field}")

        # Validate district-level data
        for district in self.data.get('districts', []):
            required_district_fields = ['name', 'district_code', 'headquarters', 'villages']
            for field in required_district_fields:
                if field not in district:
                    issues.append(f"District {district.get('name', 'Unknown')}: Missing field {field}")

            # Validate village-level data
            for village in district.get('villages', []):
                required_village_fields = [
                    'village_code', 'name', 'population_total',
                    'tehsil', 'block', 'gram_panchayat'
                ]
                for field in required_village_fields:
                    if field not in village:
                        issues.append(f"Village {village.get('name', 'Unknown')}: Missing field {field}")

                # Validate population data
                if village.get('population_total', 0) <= 0:
                    issues.append(f"Village {village.get('name', 'Unknown')}: Invalid population")

                # Validate caste composition adds up to 100%
                caste_comp = village.get('caste_composition', {})
                if caste_comp:
                    total_caste = sum(caste_comp.values())
                    if not 95 <= total_caste <= 105:  # Allow some tolerance
                        issues.append(f"Village {village.get('name', 'Unknown')}: Caste composition doesn't add to 100%")

        # Validate administrative linkages
        linkages_issues = self._validate_administrative_linkages()
        issues.extend(linkages_issues)

        is_valid = len(issues) == 0
        if is_valid:
            logger.info("✅ Data integrity validation passed")
        else:
            logger.warning(f"❌ Data integrity validation failed with {len(issues)} issues")

        return is_valid, issues

    def _validate_administrative_linkages(self) -> List[str]:
        """Validate administrative linkages between entities."""
        issues = []

        district_codes = set()
        village_codes = set()

        for district in self.data.get('districts', []):
            district_code = district.get('district_code')
            if district_code in district_codes:
                issues.append(f"Duplicate district code: {district_code}")
            district_codes.add(district_code)

            for village in district.get('villages', []):
                village_code = village.get('village_code')
                if village_code in village_codes:
                    issues.append(f"Duplicate village code: {village_code}")
                village_codes.add(village_code)

                # Validate district-village linkage
                if not village_code.startswith(district_code):
                    issues.append(f"Village {village_code} doesn't match district {district_code}")

        return issues

    def get_statistics(self, district_filter: Optional[str] = None) -> Dict[str, Any]:
        """
        Generate comprehensive statistics.

        Args:
            district_filter: Optional district name filter

        Returns:
            Dictionary with statistics
        """
        if not self.data:
            return {}

        stats = {
            'total_districts': len(self.data['districts']),
            'total_villages': 0,
            'total_population': 0,
            'districts': [],
            'population_distribution': {},
            'infrastructure_summary': {},
            'caste_distribution': {}
        }

        for district in self.data['districts']:
            if district_filter and district['name'] != district_filter:
                continue

            district_stats = {
                'name': district['name'],
                'code': district['district_code'],
                'villages': len(district['villages']),
                'population': district['population'],
                'area_km2': district['area_km2']
            }

            stats['total_villages'] += len(district['villages'])
            stats['total_population'] += district['population']
            stats['districts'].append(district_stats)

            # Population distribution
            for village in district['villages']:
                pop_range = self._get_population_range(village['population_total'])
                stats['population_distribution'][pop_range] = stats['population_distribution'].get(pop_range, 0) + 1

                # Infrastructure summary
                infra = village.get('infrastructure', {})
                for key, value in infra.items():
                    if key not in stats['infrastructure_summary']:
                        stats['infrastructure_summary'][key] = {}
                    stats['infrastructure_summary'][key][value] = stats['infrastructure_summary'][key].get(value, 0) + 1

                # Caste distribution
                caste_comp = village.get('caste_composition', {})
                for caste, percentage in caste_comp.items():
                    if caste not in stats['caste_distribution']:
                        stats['caste_distribution'][caste] = []
                    stats['caste_distribution'][caste].append(percentage)

        # Calculate averages for caste distribution
        for caste, percentages in stats['caste_distribution'].items():
            stats['caste_distribution'][caste] = {
                'average': sum(percentages) / len(percentages),
                'min': min(percentages),
                'max': max(percentages)
            }

        return stats

    def _get_population_range(self, population: int) -> str:
        """Categorize population into ranges."""
        if population < 500:
            return '< 500'
        elif population < 1000:
            return '500-999'
        elif population < 2000:
            return '1000-1999'
        elif population < 5000:
            return '2000-4999'
        else:
            return '5000+'

    def load_to_database(self, batch_size: int = 100) -> bool:
        """
        Load data into PostgreSQL database.

        Args:
            batch_size: Number of records to insert in each batch

        Returns:
            True if successful, False otherwise
        """
        if not self.data:
            logger.error("No data loaded")
            return False

        try:
            conn = psycopg2.connect(**self.db_config)
            cursor = conn.cursor()

            logger.info("Starting database load process...")

            # Clear existing data (optional - comment out for incremental updates)
            logger.info("Clearing existing Chhattisgarh data...")
            cursor.execute("DELETE FROM dims.dim_geography WHERE state = 'छत्तीसगढ़'")

            total_villages = 0

            # Process each district
            for district in self.data['districts']:
                district_name = district['name']
                logger.info(f"Processing district: {district_name}")

                # Prepare village data for batch insert
                village_records = []
                for village in district['villages']:
                    record = (
                        'छत्तीसगढ़',  # state
                        district_name,  # district
                        village.get('assembly_constituency', district_name),  # ac
                        village.get('block', district_name),  # block
                        village.get('gram_panchayat', village['name']),  # gp
                        village['name'],  # village
                        village.get('pincode', ''),  # pincode
                        village.get('latitude'),  # lat
                        village.get('longitude'),  # lon
                        json.dumps({
                            'village_code': village['village_code'],
                            'name_english': village.get('name_english', ''),
                            'population_total': village['population_total'],
                            'population_male': village.get('population_male', 0),
                            'population_female': village.get('population_female', 0),
                            'area_hectares': village.get('area_hectares', 0),
                            'tehsil': village.get('tehsil', ''),
                            'parliamentary_constituency': village.get('parliamentary_constituency', ''),
                            'development_block': village.get('development_block', ''),
                            'revenue_circle': village.get('revenue_circle', ''),
                            'police_station': village.get('police_station', ''),
                            'post_office': village.get('post_office', ''),
                            'bank_branches': village.get('bank_branches', []),
                            'health_centers': village.get('health_centers', []),
                            'schools': village.get('schools', []),
                            'electricity_coverage': village.get('electricity_coverage', 0),
                            'water_supply': village.get('water_supply', ''),
                            'sanitation_coverage': village.get('sanitation_coverage', 0),
                            'literacy_rate': village.get('literacy_rate', 0),
                            'main_occupation': village.get('main_occupation', ''),
                            'caste_composition': village.get('caste_composition', {}),
                            'infrastructure': village.get('infrastructure', {})
                        })  # additional_data as JSONB
                    )
                    village_records.append(record)

                # Batch insert villages
                if village_records:
                    execute_values(
                        cursor,
                        """
                        INSERT INTO dims.dim_geography (
                            state, district, ac, block, gp, village, pincode,
                            lat, lon, additional_data
                        ) VALUES %s
                        ON CONFLICT (state, district, village) DO UPDATE SET
                            additional_data = EXCLUDED.additional_data,
                            updated_at = CURRENT_TIMESTAMP
                        """,
                        village_records,
                        page_size=batch_size
                    )

                    total_villages += len(village_records)
                    logger.info(f"Inserted {len(village_records)} villages for {district_name}")

            conn.commit()
            cursor.close()
            conn.close()

            logger.info(f"✅ Successfully loaded {total_villages} villages to database")
            return True

        except psycopg2.Error as e:
            logger.error(f"Database error: {e}")
            return False
        except Exception as e:
            logger.error(f"Error loading to database: {e}")
            return False

    def print_statistics_report(self, stats: Dict[str, Any]):
        """Print a formatted statistics report."""
        print("\n" + "="*60)
        print("CHHATTISGARH VILLAGE DATA STATISTICS REPORT")
        print("="*60)

        print(f"📊 Total Districts: {stats['total_districts']}")
        print(f"🏘️  Total Villages: {stats['total_villages']}")
        print(f"👥 Total Population: {stats['total_population']:,}")

        print(f"\n🏛️  DISTRICT BREAKDOWN:")
        for district in stats['districts']:
            print(f"  • {district['name']} ({district['code']}): {district['villages']} villages, {district['population']:,} population")

        print(f"\n👥 POPULATION DISTRIBUTION:")
        for pop_range, count in stats['population_distribution'].items():
            print(f"  • {pop_range}: {count} villages")

        print(f"\n🏗️  INFRASTRUCTURE SUMMARY:")
        for infra_type, values in stats['infrastructure_summary'].items():
            print(f"  • {infra_type.title()}:")
            for value, count in values.items():
                print(f"    - {value}: {count} villages")

        print(f"\n🏛️  CASTE DISTRIBUTION:")
        for caste, data in stats['caste_distribution'].items():
            print(f"  • {caste.title()}: {data['average']:.1f}% (range: {data['min']:.1f}% - {data['max']:.1f}%)")

        print("="*60)

def main():
    """Main function."""
    parser = argparse.ArgumentParser(description="Load Chhattisgarh village data")
    parser.add_argument("--input", required=True, help="Input JSON file path")
    parser.add_argument("--validate", action="store_true", help="Validate data integrity")
    parser.add_argument("--load-to-db", action="store_true", help="Load data to database")
    parser.add_argument("--stats", action="store_true", help="Generate statistics report")
    parser.add_argument("--district", help="Filter statistics by district name")
    parser.add_argument("--batch-size", type=int, default=100, help="Database batch size")

    args = parser.parse_args()

    loader = ChhattisgarhDataLoader()

    # Load data
    if not loader.load_json_data(args.input):
        sys.exit(1)

    # Validate data
    if args.validate:
        is_valid, issues = loader.validate_data_integrity()
        if not is_valid:
            print("❌ Data validation failed:")
            for issue in issues:
                print(f"  • {issue}")
            sys.exit(1)
        else:
            print("✅ Data validation passed")

    # Load to database
    if args.load_to_db:
        if loader.load_to_database(args.batch_size):
            print("✅ Data successfully loaded to database")
        else:
            print("❌ Failed to load data to database")
            sys.exit(1)

    # Generate statistics
    if args.stats:
        stats = loader.get_statistics(args.district)
        loader.print_statistics_report(stats)

if __name__ == "__main__":
    main()
