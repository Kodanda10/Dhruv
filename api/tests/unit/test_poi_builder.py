import json
from api.src.sota.dataset_builders.poi_builder import build_poi_dataset

def test_build_poi_dataset():
    # Collect yielded JSON strings
    lines = list(build_poi_dataset())
    assert len(lines) == 3  # Three POIs

    # Parse and check first POI
    data = json.loads(lines[0])
    assert data['name'] == 'राम मंदिर, रायगढ़'
    assert data['type'] == 'temple'
    assert data['lat'] == 21.9167
    assert data['lon'] == 83.4000
    assert 'osm_id' in data
    assert data['description'] == 'प्राचीन राम मंदिर'

    # Check second
    data2 = json.loads(lines[1])
    assert data2['name'] == 'स्वर्ण जयंती भवन'
    assert data2['type'] == 'venue'
    assert data2['lat'] == 21.2500
    assert data2['lon'] == 81.6333

    # Check third
    data3 = json.loads(lines[2])
    assert data3['name'] == 'दुर्गा मंदिर, बिलासपुर'
    assert data3['type'] == 'temple'
    assert data3['lat'] == 21.2000
    assert data3['lon'] == 82.1500
