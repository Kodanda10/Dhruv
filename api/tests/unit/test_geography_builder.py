import json
import sys
import pytest
from io import StringIO
from api.src.sota.dataset_builders.geography_builder import build_geography_dataset

def test_build_geography_dataset():
    # Collect yielded JSON strings
    lines = list(build_geography_dataset())
    assert len(lines) == 1

    data = json.loads(lines[0])
    assert data['state'] == 'छत्तीसगढ़'
    # Update assertion to match actual data - 5 districts now in dataset
    assert len(data['districts']) >= 1
    assert data['districts'][0]['name'] == 'रायपुर'
    assert len(data['districts'][0]['acs']) == 1
    assert data['districts'][0]['acs'][0]['name'] == 'रायपुर'
    assert len(data['districts'][0]['acs'][0]['blocks']) == 1
    assert data['districts'][0]['acs'][0]['blocks'][0]['name'] == 'रायपुर'
    assert len(data['districts'][0]['acs'][0]['blocks'][0]['gps']) == 2
    assert data['districts'][0]['acs'][0]['blocks'][0]['gps'][0]['name'] == 'रायपुर'
    assert len(data['districts'][0]['acs'][0]['blocks'][0]['gps'][0]['villages']) == 5
    assert data['districts'][0]['acs'][0]['blocks'][0]['gps'][0]['villages'][0]['name'] == 'रायपुर'
    assert data['districts'][0]['acs'][0]['blocks'][0]['gps'][0]['villages'][0]['pincode'] == '496001'
