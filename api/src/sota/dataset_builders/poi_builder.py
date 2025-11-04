import json
import sys

def build_poi_dataset():
    """
    Builds POI dataset in NDJSON format.
    Outputs temples, venues with lat/lon, OSM integration.
    """
    # Mock data for POIs in Chhattisgarh (can be replaced with real OSM data)
    pois = [
        {
            "name": "राम मंदिर, रायगढ़",
            "type": "temple",
            "lat": 21.9167,
            "lon": 83.4000,
            "address": "रायगढ़, छत्तीसगढ़",
            "osm_id": "123456789",
            "description": "प्राचीन राम मंदिर"
        },
        {
            "name": "स्वर्ण जयंती भवन",
            "type": "venue",
            "lat": 21.2500,
            "lon": 81.6333,
            "address": "रायपुर, छत्तीसगढ़",
            "osm_id": "987654321",
            "description": "सार्वजनिक कार्यक्रम स्थल"
        },
        {
            "name": "दुर्गा मंदिर, बिलासपुर",
            "type": "temple",
            "lat": 21.2000,
            "lon": 82.1500,
            "address": "बिलासपुर, छत्तीसगढ़",
            "osm_id": "456789123",
            "description": "दुर्गा देवी का मंदिर"
        }
    ]

    # Generate NDJSON
    for poi in pois:
        yield json.dumps(poi, ensure_ascii=False)

if __name__ == "__main__":
    for line in build_poi_dataset():
        print(line)
