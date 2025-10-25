<file_path>
Project_Dhruv/scripts/geocode_villages.py
</file_path>

<edit_description>
Create a geocoding utility script for MapmyIndia API
</edit_description>

#!/usr/bin/env python3
"""
Geocoding utility for MapmyIndia API.
Authenticates, geocodes village names, handles rate limits, and saves results.
Supports four variants; prioritizes English for API.
"""

import os
import requests
import json
import time
from typing import List, Dict, Any
from dotenv import load_dotenv

# Load env vars
load_dotenv()
CLIENT_ID = os.getenv("MAPMYINDIA_CLIENT_ID")
CLIENT_SECRET = os.getenv("MAPMYINDIA_CLIENT_SECRET")
BASE_URL = "https://atlas.mapmyindia.com/api/places"

class MapmyIndiaGeocoder:
    def __init__(self):
        self.access_token = None
        self.session = requests.Session()

    def authenticate(self) -> str:
        """Get OAuth access token."""
        url = f"{BASE_URL}/oauth/token"
        data = {
            "grant_type": "client_credentials",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET
        }
        response = self.session.post(url, data=data)
        response.raise_for_status()
        self.access_token = response.json()["access_token"]
        return self.access_token

    def geocode(self, address: str, item_count: int = 1) -> Dict[str, Any]:
        """Geocode an address."""
        if not self.access_token:
            self.authenticate()

        url = f"{BASE_URL}/geocode"
        params = {"address": address, "itemCount": item_count}
        headers = {"Authorization": f"Bearer {self.access_token}"}
        response = self.session.get(url, params=params, headers=headers)

        if response.status_code == 429:
            print("Rate limit hit; sleeping 60s...")
            time.sleep(60)
            return self.geocode(address, item_count)
        response.raise_for_status()
        return response.json()

    def geocode_villages(self, villages: List[Dict[str, Any]], delay: float = 1.0) -> List[Dict[str, Any]]:
        """Geocode list of villages with delay."""
        results = []
        for village in villages:
            address = village.get("english", village.get("hindi", ""))
            if not address:
                continue

            try:
                geo_data = self.geocode(address)
                village["geo"] = geo_data.get("copResults", {})
                results.append(village)
            except Exception as e:
                print(f"Error geocoding {address}: {e}")
                village["geo"] = {"error": str(e)}
                results.append(village)

            time.sleep(delay)  # Rate limit
        return results

def load_villages(file_path: str) -> List[Dict[str, Any]]:
    """Load villages from JSON."""
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data.get("sample_data", [])

def save_results(results: List[Dict[str, Any]], output_file: str):
    """Save geocoded results."""
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

def main():
    input_file = "data/draft_cg_data.json"
    output_file = "data/geocoded_villages.json"

    villages = load_villages(input_file)
    if not villages:
        print("No villages to geocode.")
        return

    geocoder = MapmyIndiaGeocoder()
    geocoded = geocoder.geocode_villages(villages[:5])  # Limited for testing

    save_results(geocoded, output_file)
    print(f"Geocoded {len(geocoded)} villages; saved to {output_file}")

if __name__ == "__main__":
    main()
