import json
from api.src.sota.dataset_builders.chhattisgarh_schemes_builder import build_chhattisgarh_schemes_dataset

def test_build_chhattisgarh_schemes_dataset():
    # Collect yielded JSON strings
    lines = list(build_chhattisgarh_schemes_dataset())
    assert len(lines) == 3  # Three schemes

    # Parse and check first scheme
    data = json.loads(lines[0])
    assert data['name'] == 'मुख्यमंत्री ग्रामीण आवास योजना'
    assert data['type'] == 'state'
    assert 'eligibility' in data
    assert 'benefits' in data
    assert 'application_process' in data
    assert data['eligibility']['category'] == 'अनुसूचित जाति/जनजाति परिवार'

    # Check second scheme
    data2 = json.loads(lines[1])
    assert data2['name'] == 'गोधन न्याय योजना'
    assert data2['benefits']['monthly_payment'] == 'प्रति गाय 6,000 रुपए प्रतिवर्ष'

    # Check third scheme
    data3 = json.loads(lines[2])
    assert data3['name'] == 'मुख्यमंत्री स्वास्थ्य बीमा योजना'
    assert data3['benefits']['coverage'] == '5 लाख रुपए तक का स्वास्थ्य बीमा'
