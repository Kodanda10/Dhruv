#!/usr/bin/env python3
"""
Enhance Chhattisgarh Village Dataset with Electoral Constituency Data

This script integrates electoral constituency information (Assembly and Parliamentary)
into the existing Chhattisgarh village dataset using the Mapbox Tilequery API
from the publicmap/electionmap repository.

Requirements:
- Mapbox access token (free developer account)
- Existing village dataset with coordinates (from OSM)

Usage:
    export MAPBOX_ACCESS_TOKEN=your_token_here
    python enhance_chhattisgarh_with_electoral_data.py

Output:
- Enhanced NDJSON file with electoral linkages

Note: This is a DRAFT implementation. Requires more authentic source validation.
"""

import os
import json
import logging
import requests
from typing import Dict, List, Optional
import time

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ElectoralDataEnhancer:
    """
    Enhances village data with electoral constituency information using Mapbox API.
    """

    def __init__(self, mapbox_token: str):
        self.mapbox_token = mapbox_token
        self.base_url = "https://api.mapbox.com/v4"
        self.tileset_id = "publicmap.electionmap"  # From electionmap repo
        self.session = requests.Session()
        self.rate_limit_delay = 1.0  # Respect API rate limits

    def query_constituency(self, lat: float, lon: float) -> Optional[Dict]:
        """
        Query Mapbox Tilequery API for constituency information at given coordinates.

        Args:
            lat: Latitude
            lon: Longitude

        Returns:
            Dict with assembly and parliamentary constituency info, or None if error
        """
        url = f"{self.base_url}/{self.tileset_id}/tilequery/{lon},{lat}.json"
        params = {
            'access_token': self.mapbox_token,
            'layers': 'assembly_constituencies,parliamentary_constituencies'
        }

        try:
            response = self.session.get(url, params=params, timeout=10)
            response.raise_for_status()

            data = response.json()
            result = {}

            # Extract assembly constituency
            if 'assembly_constituencies' in data.get('features', []):
                for feature in data['features']:
                    if feature.get('properties', {}).get('layer') == 'assembly_constituencies':
                        result['assembly_constituency'] = feature['properties'].get('name', 'Unknown')
                        break

            # Extract parliamentary constituency
            if 'parliamentary_constituencies' in data.get('features', []):
                for feature in data['features']:
                    if feature.get('properties', {}).get('layer') == 'parliamentary_constituencies':
                        result['parliamentary_constituency'] = feature['properties'].get('name', 'Unknown')
                        break

            return result if result else None

        except requests.RequestException as e:
            logger.error(f"API request failed for ({lat}, {lon}): {e}")
            return None
        finally:
            time.sleep(self.rate_limit_delay)

    def enhance_village(self, village: Dict) -> Dict:
        """
        Enhance a single village record with electoral data.

        Args:
            village: Village dict with coordinates

        Returns:
            Enhanced village dict
        """
        lat = village.get('latitude')
        lon = village.get('longitude')

        if lat is None or lon is None:
            logger.warning(f"No coordinates for village: {village.get('name', 'Unknown')}")
            return village

        constituency_data = self.query_constituency(lat, lon)

        if constituency_data:
            village.update(constituency_data)
            logger.info(f"Enhanced {village['name']} with electoral data")
        else:
            logger.warning(f"Could not get electoral data for {village['name']}")

        return village

    def enhance_dataset(self, input_file: str, output_file: str):
        """
        Enhance entire dataset with electoral information.

        Args:
            input_file: Path to input NDJSON file
            output_file: Path to output NDJSON file
        """
        logger.info(f"Loading dataset from {input_file}")

        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        villages = []
        for district in data.get('districts', []):
            for village in district.get('villages', []):
                enhanced_village = self.enhance_village(village)
                villages.append(enhanced_village)

        # Update the data structure
        data['districts'] = [{'name': 'Unknown', 'villages': villages}]  # Simplified for now
        data['metadata']['electoral_enhanced'] = True
        data['metadata']['last_updated'] = time.strftime('%Y-%m-%dT%H:%M:%SZ')

        logger.info(f"Saving enhanced dataset to {output_file}")

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        logger.info("Enhancement complete!")

def main():
    """Main function."""
    # Get Mapbox token from environment
    token = os.getenv('MAPBOX_ACCESS_TOKEN')
    if not token:
        logger.error("MAPBOX_ACCESS_TOKEN environment variable not set")
        logger.info("Get a free token from: https://account.mapbox.com/access-tokens/")
        return

    input_file = 'scripts/test.ndjson'  # Path to existing dataset
    output_file = 'data/chhattisgarh_villages_with_electoral.ndjson'

    enhancer = ElectoralDataEnhancer(token)
    enhancer.enhance_dataset(input_file, output_file)

if __name__ == "__main__":
    main()
