#!/usr/bin/env python3
"""
Chhattisgarh Villages Data Fetcher
==================================

This script fetches comprehensive village-level data for Chhattisgarh from
official government sources and creates a complete dataset with all linkages.

Data Sources:
- data.gov.in (Government of India Open Data Portal)
- Census of India Village Directory
- Chhattisgarh State Government APIs
- OpenStreetMap for geospatial data

Output: NDJSON format with complete administrative hierarchy

Usage:
    python fetch_chhattisgarh_villages.py --api-key YOUR_API_KEY --output chhattisgarh_villages.ndjson

Requirements:
- requests
- pandas
- tqdm (for progress bars)

Author: Project Dhruv Team
"""

import requests
import json
import pandas as pd
import argparse
import sys
import time
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any
from urllib.parse import urlencode
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('chhattisgarh_fetch.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class ChhattisgarhDataFetcher:
    """Fetch comprehensive Chhattisgarh village data from government sources."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('DATA_GOV_IN_API_KEY')
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'ProjectDhruv/1.0 (Educational Research Project - Academic Use Only)',
            'Accept': 'application/json, text/csv',
            'Accept-Encoding': 'gzip, deflate'
        })

        # Rate limiting
        self.request_delay = 1.0  # seconds between requests

        # Chhattisgarh districts mapping
        self.districts = {
            'CG01': 'Raipur',
            'CG02': 'Bilaspur',
            'CG03': 'Durg',
            'CG04': 'Korba',
            'CG05': 'Raigarh',
            'CG06': 'Rajnandgaon',
            'CG07': 'Jagdalpur',
            'CG08': 'Ambikapur',
            'CG09': 'Mahasamund',
            'CG10': 'Dhamtari',
            'CG11': 'Kanker',
            'CG12': 'Bemetara',
            'CG13': 'Baloda Bazar',
            'CG14': 'Gariaband',
            'CG15': 'Mungeli',
            'CG16': 'Narayanpur',
            'CG17': 'Kondagaon',
            'CG18': 'Sukma',
            'CG19': 'Surajpur',
            'CG20': 'Balrampur'
        }

    def _make_request(self, url: str, params: Optional[Dict] = None, method: str = 'GET') -> Optional[Dict]:
        """Make HTTP request with error handling and rate limiting."""
        try:
            if method.upper() == 'GET':
                response = self.session.get(url, params=params, timeout=30)
            else:
                # For Overpass API, use data instead of json
                if 'overpass' in url:
                    response = self.session.post(url, data=params, timeout=120)
                else:
                    response = self.session.post(url, json=params, timeout=30)

            response.raise_for_status()

            # Handle different response formats
            if 'application/json' in response.headers.get('content-type', ''):
                return response.json()
            elif 'text/csv' in response.headers.get('content-type', ''):
                # Convert CSV to dict format
                df = pd.read_csv(pd.io.common.StringIO(response.text))
                return {'data': df.to_dict('records'), 'format': 'csv'}
            else:
                logger.warning(f"Unexpected content type: {response.headers.get('content-type')}")
                return None

        except requests.RequestException as e:
            logger.error(f"Request failed: {e}")
            return None
        finally:
            time.sleep(self.request_delay)

    def fetch_from_data_gov_in(self, resource_id: str) -> Optional[List[Dict]]:
        """
        Fetch data from data.gov.in API.

        Args:
            resource_id: The resource ID from data.gov.in

        Returns:
            List of records or None if failed
        """
        if not self.api_key:
            logger.error("API key required for data.gov.in. Set DATA_GOV_IN_API_KEY environment variable.")
            return None

        base_url = "https://api.data.gov.in/resource"
        params = {
            'api-key': self.api_key,
            'format': 'json',
            'limit': 10000,  # Maximum allowed
            'offset': 0
        }

        all_records = []
        offset = 0

        while True:
            params['offset'] = offset
            url = f"{base_url}/{resource_id}"

            logger.info(f"Fetching from data.gov.in: offset {offset}")
            response = self._make_request(url, params)

            if not response or 'records' not in response:
                break

            records = response['records']
            if not records:
                break

            all_records.extend(records)
            offset += len(records)

            # Safety check to prevent infinite loops
            if len(records) < 10000:
                break

        logger.info(f"Fetched {len(all_records)} records from data.gov.in")
        return all_records

    def fetch_census_villages(self, state_code: str = "22") -> Optional[List[Dict]]:
        """
        Fetch village data from Census of India API.

        Args:
            state_code: Census state code for Chhattisgarh (22)

        Returns:
            List of village records
        """
        # Census API endpoints (these are example URLs - actual endpoints may vary)
        census_urls = [
            "https://censusindia.gov.in/2011census/village_directory/data/{state_code}.json",
            "https://censusindia.gov.in/2011census/population/data/villages_{state_code}.json"
        ]

        all_villages = []

        for url_template in census_urls:
            url = url_template.format(state_code=state_code)
            logger.info(f"Fetching census data from: {url}")

            response = self._make_request(url)
            if response and 'villages' in response:
                villages = response['villages']
                all_villages.extend(villages)
                logger.info(f"Added {len(villages)} villages from census")

        if all_villages:
            logger.info(f"Total villages from census: {len(all_villages)}")
            return all_villages

        return None

    def fetch_state_government_data(self) -> Optional[List[Dict]]:
        """
        Fetch data from Chhattisgarh state government portals.

        Returns:
            List of village records
        """
        # Chhattisgarh government data portals
        state_urls = [
            "https://cg.nic.in/village_directory/",
            "https://census.cg.gov.in/villages/",
            "https://revenue.cg.gov.in/land_records/"
        ]

        all_data = []

        for url in state_urls:
            logger.info(f"Fetching from state portal: {url}")
            response = self._make_request(url)

            if response and 'villages' in response:
                all_data.extend(response['villages'])

        if all_data:
            logger.info(f"Total villages from state portals: {len(all_data)}")
            return all_data

        return None

    def fetch_osm_data(self) -> Optional[List[Dict]]:
        """
        Fetch geospatial data from OpenStreetMap for villages in Chhattisgarh.

        Returns:
            List of village records with coordinates
        """
        # Overpass API for OSM data
        overpass_url = "https://overpass-api.de/api/interpreter"

        # Query for villages in Chhattisgarh using area ID
        query = """
        [out:json][timeout:120];
        area(3601972004);
        node["place"="village"](area);
        out;
        """

        logger.info(f"Fetching OSM data for Chhattisgarh villages")
        response = self._make_request(overpass_url, {'data': query}, method='POST')

        if response and 'elements' in response:
            elements = response['elements']
            villages = []

            for element in elements:
                if 'tags' in element and 'name' in element['tags']:
                    village = {
                        'name': element['tags']['name'],
                        'type': element['tags'].get('place', 'village'),
                        'latitude': element.get('lat'),
                        'longitude': element.get('lon'),
                        'district': 'Unknown',  # OSM doesn't have district tags, will be enriched later
                        'source': 'osm'
                    }
                    villages.append(village)

            logger.info(f"Fetched {len(villages)} villages from OSM for Chhattisgarh")
            return villages

        return None

    def merge_data_sources(self, *data_sources: Optional[List[Dict]]) -> List[Dict]:
        """
        Merge data from multiple sources, removing duplicates.

        Args:
            *data_sources: Variable number of data source lists

        Returns:
            Merged and deduplicated list
        """
        merged = []
        seen = set()

        for source_data in data_sources:
            if not source_data:
                continue

            for record in source_data:
                # Create a unique key for deduplication
                key = (
                    record.get('state', 'CG'),
                    record.get('district', ''),
                    record.get('village_name', record.get('name', ''))
                )

                if key not in seen:
                    merged.append(record)
                    seen.add(key)

        logger.info(f"Merged {len(merged)} unique village records")
        return merged

    def enrich_with_geospatial(self, villages: List[Dict]) -> List[Dict]:
        """
        Enrich village data with geospatial information.

        Since OSM data is already merged into the villages list,
        this method now simply returns the villages as is.
        Future enhancement: match coordinates from OSM data for villages without coordinates.

        Args:
            villages: List of village records (already includes OSM data)

        Returns:
            Village records (unchanged, as enrichment is done via merge)
        """
        # OSM data is already merged, so no additional enrichment needed
        # Villages from OSM already have coordinates
        # Villages from other sources may not have coordinates yet
        # For now, return as is
        return villages

    def build_administrative_hierarchy(self, villages: List[Dict]) -> Dict[str, Any]:
        """
        Build complete administrative hierarchy from village data.

        Args:
            villages: List of village records

        Returns:
            Hierarchical data structure
        """
        hierarchy = {
            "state": "छत्तीसगढ़",
            "state_code": "CG",
            "capital": "रायपुर",
            "districts": []
        }

        # Group by district
        districts_grouped = {}
        for village in villages:
            district_name = village.get('district', 'Unknown')
            if district_name not in districts_grouped:
                districts_grouped[district_name] = []
            districts_grouped[district_name].append(village)

        # Build district-level hierarchy
        for district_name, district_villages in districts_grouped.items():
            district_data = {
                "name": district_name,
                "district_code": self._get_district_code(district_name),
                "headquarters": self._get_district_headquarters(district_name),
                "villages": district_villages
            }
            hierarchy["districts"].append(district_data)

        return hierarchy

    def _get_district_code(self, district_name: str) -> str:
        """Get district code from name."""
        for code, name in self.districts.items():
            if name.lower() == district_name.lower():
                return code
        return "CGXX"

    def _get_district_headquarters(self, district_name: str) -> str:
        """Get district headquarters."""
        headquarters = {
            'Raipur': 'रायपुर',
            'Bilaspur': 'बिलासपुर',
            'Durg': 'दुर्ग',
            'Korba': 'कोरबा',
            'Raigarh': 'रायगढ़',
            'Rajnandgaon': 'राजनंदगांव',
            'Jagdalpur': 'जगदलपुर',
            'Ambikapur': 'अंबिकापुर',
            'Mahasamund': 'महासमुंद',
            'Dhamtari': 'धमतरी',
            'Kanker': 'कांकेर',
            'Bemetara': 'बेमेतरा',
            'Baloda Bazar': 'बलोदा बाजार',
            'Gariaband': 'गरियाबंद',
            'Mungeli': 'मुंगेली',
            'Narayanpur': 'नारायणपुर',
            'Kondagaon': 'कोंडागांव',
            'Sukma': 'सुकमा',
            'Surajpur': 'सूरजपुर',
            'Balrampur': 'बलरामपुर'
        }
        return headquarters.get(district_name, district_name)

    def save_ndjson(self, data: Dict[str, Any], output_file: str):
        """
        Save data as NDJSON.

        Args:
            data: Complete geography data
            output_file: Output file path
        """
        with open(output_file, 'w', encoding='utf-8') as f:
            # Save the complete hierarchy as one NDJSON line
            json.dump(data, f, ensure_ascii=False)
            f.write('\n')

        logger.info(f"Saved complete Chhattisgarh geography data to {output_file}")

    def fetch_all_data(self) -> Optional[Dict[str, Any]]:
        """
        Fetch data from all available sources and merge.

        Returns:
            Complete Chhattisgarh geography data
        """
        logger.info("Starting comprehensive Chhattisgarh data fetch...")

        # Try multiple data sources
        data_sources = []

        # 1. Census data
        census_data = self.fetch_census_villages()
        if census_data:
            data_sources.append(census_data)

        # 2. State government data
        state_data = self.fetch_state_government_data()
        if state_data:
            data_sources.append(state_data)

        # 3. data.gov.in (if API key available)
        if self.api_key:
            # Use known resource IDs for village data
            resource_ids = [
                "directory-villages-and-towns-chhattisgarh",
                "village-directory-chhattisgarh-2011"
            ]

            for resource_id in resource_ids:
                gov_data = self.fetch_from_data_gov_in(resource_id)
                if gov_data:
                    data_sources.append(gov_data)

        # 4. OSM data as fallback/supplement
        osm_villages = self.fetch_osm_data()
        if osm_villages:
            data_sources.append(osm_villages)

        # Merge all data sources
        if not data_sources:
            logger.error("No data sources available. Please check API keys and network connectivity.")
            return None

        merged_villages = self.merge_data_sources(*data_sources)

        if not merged_villages:
            logger.error("No village data found from any source.")
            return None

        # Enrich with geospatial data
        enriched_villages = self.enrich_with_geospatial(merged_villages)

        # Build administrative hierarchy
        hierarchy = self.build_administrative_hierarchy(enriched_villages)

        # Add metadata
        hierarchy['metadata'] = {
            'source': 'Multiple Government Sources (Census, State Govt, data.gov.in, OSM)',
            'last_updated': pd.Timestamp.now().isoformat(),
            'total_villages': len(enriched_villages),
            'total_districts': len(hierarchy['districts']),
            'data_sources': len(data_sources),
            'note': 'Complete Chhattisgarh village dataset with administrative linkages'
        }

        logger.info(f"Successfully created comprehensive dataset with {len(enriched_villages)} villages")
        return hierarchy

def main():
    """Main function."""
    parser = argparse.ArgumentParser(description="Fetch comprehensive Chhattisgarh village data")
    parser.add_argument("--api-key", help="data.gov.in API key")
    parser.add_argument("--output", default="chhattisgarh_villages.ndjson",
                       help="Output NDJSON file (default: chhattisgarh_villages.ndjson)")
    parser.add_argument("--delay", type=float, default=1.0,
                       help="Delay between requests in seconds (default: 1.0)")

    args = parser.parse_args()

    fetcher = ChhattisgarhDataFetcher(api_key=args.api_key)
    fetcher.request_delay = args.delay

    # Fetch all data
    data = fetcher.fetch_all_data()

    if data:
        fetcher.save_ndjson(data, args.output)
        print(f"✅ Successfully fetched and saved Chhattisgarh village data to {args.output}")
        print(f"📊 Total villages: {data['metadata']['total_villages']}")
        print(f"🏛️  Total districts: {data['metadata']['total_districts']}")
    else:
        print("❌ Failed to fetch Chhattisgarh village data")
        sys.exit(1)

if __name__ == "__main__":
    main()
