Project_Dhruv/scripts/mock_electoral_enhancement.py
#!/usr/bin/env python3
"""
Mock Electoral Data Enhancement for Chhattisgarh Villages

This script simulates the integration of electoral constituency data into the
Chhattisgarh village dataset. It uses predefined constituency mappings based on
geographic regions rather than API calls.

This is a MOCK implementation for demonstration purposes only.
For production use, implement the real Mapbox API integration.

Usage:
    python mock_electoral_enhancement.py

Output:
    Enhanced dataset with simulated electoral linkages
"""

import json
import logging
import random
from typing import Dict, List
import time

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MockElectoralEnhancer:
    """
    Mock implementation that simulates electoral data enhancement.
    """

    def __init__(self):
        # Predefined constituency mappings based on geographic regions
        self.assembly_constituencies = {
            'north': ['रायपुर शहर उत्तर', 'रायपुर शहर दक्षिण', 'रायपुर ग्रामीण', 'धमतरी', 'कुरूद'],
            'south': ['रायगढ़', 'कोरबा', 'कटघोरा', 'पाली-तानाखार', 'धरमजयगढ़'],
            'east': ['जगदलपुर', 'कोण्डागांव', 'नारायणपुर', 'बीजापुर', 'अंतागढ़'],
            'west': ['अंबिकापुर', 'प्रतापपुर', 'लुण्ड्रा', 'मनेंद्रगढ़', 'खरसिया'],
            'central': ['बिलासपुर', 'मस्तूरी', 'अकaltara', 'जांजगीर-चांपा', 'साक्ती']
        }

        self.parliamentary_constituencies = [
            'रायपुर', 'बिलासपुर', 'दुर्ग-चांपा', 'राजनंदगांव', 'कोरबा',
            'रायगढ़', 'सरगुजा', 'रायगढ़', 'महासमुंद', 'कांकेर'
        ]

    def determine_region(self, lat: float, lon: float) -> str:
        """
        Determine geographic region based on coordinates.
        This is a simplified mock implementation.
        """
        if lat > 22.0:
            return 'north'
        elif lat < 20.0:
            return 'south'
        elif lon > 82.5:
            return 'east'
        elif lon < 81.0:
            return 'west'
        else:
            return 'central'

    def get_mock_constituency(self, lat: float, lon: float) -> Dict[str, str]:
        """
        Generate mock electoral constituency data based on coordinates.

        Args:
            lat: Latitude
            lon: Longitude

        Returns:
            Dict with assembly and parliamentary constituency
        """
        region = self.determine_region(lat, lon)

        assembly_options = self.assembly_constituencies.get(region, ['अज्ञात'])
        assembly = random.choice(assembly_options)

        parliamentary = random.choice(self.parliamentary_constituencies)

        return {
            'assembly_constituency': assembly,
            'parliamentary_constituency': parliamentary
        }

    def enhance_village(self, village: Dict) -> Dict:
        """
        Enhance a single village with mock electoral data.

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

        # Simulate API delay
        time.sleep(0.01)

        constituency_data = self.get_mock_constituency(lat, lon)
        village.update(constituency_data)

        logger.info(f"Enhanced {village['name']} with mock electoral data")
        return village

    def enhance_dataset(self, input_file: str, output_file: str):
        """
        Enhance entire dataset with mock electoral information.

        Args:
            input_file: Path to input NDJSON file
            output_file: Path to output NDJSON file
        """
        logger.info(f"Loading dataset from {input_file}")

        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        total_villages = 0
        enhanced_villages = []

        for district in data.get('districts', []):
            for village in district.get('villages', []):
                enhanced_village = self.enhance_village(village)
                enhanced_villages.append(enhanced_village)
                total_villages += 1

        # Update the data structure
        data['districts'] = [{'name': 'Unknown', 'villages': enhanced_villages}]
        data['metadata']['electoral_enhanced'] = True
        data['metadata']['enhancement_type'] = 'mock'
        data['metadata']['last_updated'] = time.strftime('%Y-%m-%dT%H:%M:%SZ')
        data['metadata']['note'] = 'Mock electoral enhancement - replace with real API integration'

        logger.info(f"Saving enhanced dataset to {output_file}")

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        logger.info(f"Mock enhancement complete! Processed {total_villages} villages")

def main():
    """Main function."""
    input_file = 'scripts/test.ndjson'
    output_file = 'data/chhattisgarh_villages_mock_electoral.ndjson'

    logger.info("🚀 Starting MOCK electoral data enhancement...")
    logger.info("⚠️  This is a simulation - not using real API calls")

    enhancer = MockElectoralEnhancer()
    enhancer.enhance_dataset(input_file, output_file)

    logger.info("✅ Mock enhancement completed!")
    logger.info(f"📁 Output saved to: {output_file}")

if __name__ == "__main__":
    main()
