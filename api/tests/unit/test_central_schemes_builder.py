import json
from api.src.sota.dataset_builders.central_schemes_builder import build_central_schemes_dataset

def test_build_central_schemes_dataset():
    # Collect yielded JSON strings
    lines = list(build_central_schemes_dataset())
    assert len(lines) == 4  # Four schemes

    # Parse and check first scheme
    data = json.loads(lines[0])
    assert data['name'] == 'प्रधानमंत्री आवास योजना (PMAY)'
    assert data['type'] == 'central'
    assert 'eligibility' in data
    assert 'benefits' in data
    assert 'application_process' in data
    assert data['benefits']['financial_assistance'] == '2.67 लाख रुपए तक (EWS के लिए)'

    # Check second scheme
    data2 = json.loads(lines[1])
    assert data2['name'] == 'आयुष्मान भारत योजना (PM-JAY)'
    assert data2['benefits']['coverage'] == '5 लाख रुपए तक का स्वास्थ्य बीमा'
    assert data2['contact']['helpline'] == '14555'

    # Check third scheme
    data3 = json.loads(lines[2])
    assert data3['name'] == 'प्रधानमंत्री किसान सम्मान निधि (PM-KISAN)'
    assert data3['benefits']['financial_assistance'] == 'प्रति वर्ष 6,000 रुपए (तीन किस्तों में)'

    # Check fourth scheme
    data4 = json.loads(lines[3])
    assert data4['name'] == 'स्वच्छ भारत मिशन (SBM)'
    assert data4['benefits']['financial_assistance'] == 'शौचालय निर्माण के लिए 12,000 रुपए तक'
