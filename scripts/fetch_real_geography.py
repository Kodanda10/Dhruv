#!/usr/bin/env python3
"""
Real Geography Data Fetcher for Chhattisgarh
===========================================

This script demonstrates how to fetch comprehensive geography data from
government APIs and transform it into the NDJSON format used by the
SOTA dataset builders.

Data Sources:
- data.gov.in (Government of India Open Data Portal)
- Census of India APIs
- State government portals
- OpenStreetMap for geospatial data

Usage:
    python fetch_real_geography.py --district raipur --output raipur_geography.ndjson
    python fetch_real_geography.py --state chhattisgarh --output cg_complete.ndjson
    python fetch_real_geography.py --all-districts --output cg_all.ndjson

Author: Project Dhruv Team
"""

import requests
import json
import argparse
import sys
import time
from typing import Dict, List, Optional, Any
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class GeographyDataFetcher:
    """Fetch real geography data from government APIs."""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'ProjectDhruv/1.0 (Educational Research Project)',
            'Accept': 'application/json'
        })

    def fetch_census_villages(self, state_code: str = "22", district_code: Optional[str] = None) -> List[Dict]:
        """
        Fetch village data from Census of India API.

        Args:
            state_code: Census state code (22 for Chhattisgarh)
            district_code: Census district code (optional, fetch all if None)

        Returns:
            List of village records
        """
        base_url = "https://api.censusindia.gov.in/v1/villages"

        params = {
            "state": state_code,
            "format": "json"
        }

        if district_code:
            params["district"] = district_code

        try:
            logger.info(f"Fetching census data for state {state_code}, district {district_code}")
            response = self.session.get(base_url, params=params, timeout=30)
            response.raise_for_status()

            data = response.json()
            villages = []

            for record in data.get('villages', []):
                village = {
                    "name": record.get('village_name', ''),
                    "pincode": record.get('pincode', ''),
                    "sub_district": record.get('sub_district_name', ''),
                    "block": record.get('block_name', ''),
                    "gp": record.get('gram_panchayat_name', ''),
                    "population": record.get('population', 0),
                    "latitude": record.get('latitude'),
                    "longitude": record.get('longitude')
                }
                villages.append(village)

            logger.info(f"Fetched {len(villages)} villages from census API")
            return villages

        except requests.RequestException as e:
            logger.error(f"Failed to fetch census data: {e}")
            return []

    def fetch_govt_villages(self, district_name: str) -> List[Dict]:
        """
        Fetch village data from data.gov.in API.

        Args:
            district_name: Name of the district

        Returns:
            List of village records
        """
        # Example API endpoint (replace with actual working endpoint)
        api_key = "YOUR_API_KEY"  # Get from data.gov.in
        base_url = "https://api.data.gov.in/resource/village-directory"

        params = {
            "api-key": api_key,
            "format": "json",
            "filters[state_name]": "CHHATTISGARH",
            "filters[district_name]": district_name.upper(),
            "limit": 1000
        }

        try:
            logger.info(f"Fetching govt data for district {district_name}")
            response = self.session.get(base_url, params=params, timeout=30)
            response.raise_for_status()

            data = response.json()
            villages = []

            for record in data.get('records', []):
                village = {
                    "name": record.get('village_name', ''),
                    "pincode": record.get('pincode', ''),
                    "sub_district": record.get('sub_district_name', ''),
                    "block": record.get('block_name', ''),
                    "gp": record.get('gram_panchayat_name', ''),
                    "population": record.get('population_total', 0),
                    "latitude": record.get('latitude'),
                    "longitude": record.get('longitude')
                }
                villages.append(village)

            logger.info(f"Fetched {len(villages)} villages from govt API")
            return villages

        except requests.RequestException as e:
            logger.error(f"Failed to fetch govt data: {e}")
            return []

    def fetch_osm_data(self, district_name: str) -> Dict[str, Any]:
        """
        Fetch geospatial data from OpenStreetMap.

        Args:
            district_name: Name of the district

        Returns:
            OSM data for the district
        """
        # Overpass API for OSM data
        overpass_url = "https://overpass-api.de/api/interpreter"

        # Query for villages in the district
        query = f"""
        [out:json][timeout:25];
        area["name"="{district_name}"]["admin_level"="6"]["boundary"="administrative"];
        node["place"~"^(village|hamlet)$"](area);
        out body;
        """

        try:
            logger.info(f"Fetching OSM data for district {district_name}")
            response = self.session.post(overpass_url, data=query, timeout=60)
            response.raise_for_status()

            data = response.json()
            logger.info(f"Fetched {len(data.get('elements', []))} OSM elements")
            return data

        except requests.RequestException as e:
            logger.error(f"Failed to fetch OSM data: {e}")
            return {"elements": []}

    def build_hierarchy(self, villages: List[Dict], district_name: str) -> Dict[str, Any]:
        """
        Build hierarchical geography structure from flat village data.

        Args:
            villages: List of village records
            district_name: Name of the district

        Returns:
            Hierarchical geography data
        """
        # Group villages by block/GP
        blocks = {}
        acs = {}

        for village in villages:
            block_name = village.get('block', village.get('sub_district', district_name))
            gp_name = village.get('gp', block_name)

            if block_name not in blocks:
                blocks[block_name] = {}

            if gp_name not in blocks[block_name]:
                blocks[block_name][gp_name] = []

            blocks[block_name][gp_name].append({
                "name": village['name'],
                "pincode": village.get('pincode', ''),
                "population": village.get('population', 0),
                "lat": village.get('latitude'),
                "lon": village.get('longitude')
            })

        # Build AC structure (simplified - in reality this needs constituency mapping)
        ac_name = district_name  # Simplified mapping
        acs[ac_name] = {
            "name": ac_name,
            "blocks": []
        }

        for block_name, gps in blocks.items():
            block_data = {
                "name": block_name,
                "gps": []
            }

            for gp_name, villages_list in gps.items():
                block_data["gps"].append({
                    "name": gp_name,
                    "villages": villages_list
                })

            acs[ac_name]["blocks"].append(block_data)

        return {
            "state": "छत्तीसगढ़",
            "districts": [{
                "name": district_name,
                "acs": list(acs.values())
            }]
        }

    def fetch_district_data(self, district_name: str) -> Optional[Dict[str, Any]]:
        """
        Fetch comprehensive data for a district.

        Args:
            district_name: Name of the district

        Returns:
            Complete district geography data
        """
        logger.info(f"Fetching data for district: {district_name}")

        # Try multiple data sources
        villages = []

        # 1. Try Census API
        census_villages = self.fetch_census_villages()
        if census_villages:
            villages.extend(census_villages)

        # 2. Try Govt API
        govt_villages = self.fetch_govt_villages(district_name)
        if govt_villages:
            villages.extend(govt_villages)

        # 3. Try OSM as fallback
        if not villages:
            osm_data = self.fetch_osm_data(district_name)
            # Process OSM data (simplified)
            for element in osm_data.get('elements', []):
                if 'tags' in element and 'name' in element['tags']:
                    villages.append({
                        "name": element['tags']['name'],
                        "latitude": element.get('lat'),
                        "longitude": element.get('lon'),
                        "block": district_name,
                        "gp": district_name
                    })

        if not villages:
            logger.warning(f"No data found for district {district_name}")
            return None

        # Build hierarchy
        hierarchy = self.build_hierarchy(villages, district_name)
        logger.info(f"Built hierarchy with {len(villages)} villages for {district_name}")

        return hierarchy

    def save_ndjson(self, data: Dict[str, Any], output_file: str):
        """
        Save data as NDJSON.

        Args:
            data: Geography data
            output_file: Output file path
        """
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)
            f.write('\n')

        logger.info(f"Saved data to {output_file}")

def main():
    """Main function."""
    parser = argparse.ArgumentParser(description="Fetch real geography data for Chhattisgarh")
    parser.add_argument("--district", help="District name (e.g., raipur, bilaspur)")
    parser.add_argument("--state", help="State name (currently only chhattisgarh supported)")
    parser.add_argument("--all-districts", action="store_true", help="Fetch all districts")
    parser.add_argument("--output", required=True, help="Output NDJSON file")
    parser.add_argument("--api-key", help="data.gov.in API key")

    args = parser.parse_args()

    fetcher = GeographyDataFetcher()

    if args.api_key:
        # Update API key if provided
        pass

    if args.all_districts:
        # Chhattisgarh districts
        districts = [
            "Raipur", "Bilaspur", "Durg", "Korba", "Raigarh", "Rajnandgaon",
            "Jagdalpur", "Ambikapur", "Mahasamund", "Dhamtari", "Kanker",
            "Bemetara", "Baloda Bazar", "Gariaband", "Mungeli", "Narayanpur",
            "Kondagaon", "Sukma", "Surajpur", "Balrampur"
        ]

        all_data = {"state": "छत्तीसगढ़", "districts": []}

        for district in districts:
            logger.info(f"Processing district: {district}")
            district_data = fetcher.fetch_district_data(district)

            if district_data and district_data['districts']:
                all_data['districts'].extend(district_data['districts'])

            # Rate limiting
            time.sleep(1)

        fetcher.save_ndjson(all_data, args.output)

    elif args.district:
        data = fetcher.fetch_district_data(args.district)
        if data:
            fetcher.save_ndjson(data, args.output)
        else:
            logger.error(f"Could not fetch data for district {args.district}")
            sys.exit(1)

    else:
        logger.error("Specify --district, --state, or --all-districts")
        sys.exit(1)

if __name__ == "__main__":
    main()
