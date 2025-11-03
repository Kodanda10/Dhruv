import json
from api.src.sota.dataset_builders.festival_builder import build_festival_dataset

def test_build_festival_dataset():
    # Collect yielded JSON strings
    lines = list(build_festival_dataset())
    assert len(lines) == 3  # Three festivals

    # Parse and check first festival
    data = json.loads(lines[0])
    assert data['name'] == 'होली'
    assert data['type'] == 'lunar'
    assert data['month'] == 'फाल्गुन'
    assert data['day'] == 'पूर्णिमा'
    assert 'year_dates' in data
    assert data['year_dates']['2025'] == '2025-03-03'

    # Check second
    data2 = json.loads(lines[1])
    assert data2['name'] == 'दशहरा'
    assert data2['type'] == 'lunar'
    assert data2['year_dates']['2024'] == '2024-10-12'

    # Check third
    data3 = json.loads(lines[2])
    assert data3['name'] == 'दीवाली'
    assert data3['type'] == 'lunar'
    assert data3['year_dates']['2026'] == '2026-10-09'
