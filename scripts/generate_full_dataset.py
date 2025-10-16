#!/usr/bin/env python3
"""
Script to generate a full synthetic dataset of 20,000 villages for Chhattisgarh.
Includes four language variants, hierarchical geo (district, state), and constituencies.
Outputs to data/full_villages.json.
"""

import json
import random
from indic_transliteration import sanscript
from indic_transliteration.sanscript import transliterate

# Constants
NUM_VILLAGES = 20000
STATE = "छत्तीसगढ़"
STATE_CODE = "CG"
DISTRICTS = [
    "रायपुर", "बिलासपुर", "दुर्ग", "कोरबा", "रायगढ़", "राजनांदगांव", "कबीरधाम", "जांजगीर-चांपा",
    "रायगढ़", "कोरिया", "सूरजपुर", "बलरामपुर", "जशपुर", "बस्तर", "कोंडागांव", "नारायणपुर",
    "दंतेवाड़ा", "बीजापुर", "सुकमा", "महासमुंद", "धमतरी", "उत्तर बस्तर कांकेर", "गरियाबंद",
    "बलौदाबाजार-भाटापारा", "मुंगेली", "रायपुर ग्रामीण", "अम्बिकापुर", "सरगुजा", "बलरामपुर-रामानुजगंज",
    "मनेंद्रगढ़-चिरमिरी-भरतपुर", "कोरबा", "गौरेला-पेंड्रा-मरवाही"
]  # 33 districts

CONSTITUENCIES = {
    "रायपुर": {"assembly": "रायपुर शहर उत्तर", "parliamentary": "रायपुर"},
    "बिलासपुर": {"assembly": "बिलासपुर", "parliamentary": "बिलासपुर"},
    "दुर्ग": {"assembly": "दुर्ग", "parliamentary": "दुर्ग-चांपा"},
    "कोरबा": {"assembly": "कोरबा", "parliamentary": "कोरबा"},
    "रायगढ़": {"assembly": "रायगढ़", "parliamentary": "रायगढ़"},
    # Add more as needed; default for others
}

def generate_village_name():
    """Generate a random Hindi village name."""
    prefixes = ["बड़ा", "छोटा", "नया", "पुराना", "कृष्ण", "राम", "शिव", "गणेश"]
    suffixes = ["पुर", "गढ़", "नगर", "वास", "टोला", "डीह", "खेड़ा"]
    return random.choice(prefixes) + random.choice(suffixes)

def generate_variants(name):
    """Generate four variants."""
    hindi = name
    nukta_hindi = hindi  # Placeholder
    english = transliterate(hindi, sanscript.DEVANAGARI, sanscript.ITRANS)
    transliteration = english
    return {
        "hindi": hindi,
        "nukta_hindi": nukta_hindi,
        "english": english,
        "transliteration": transliteration
    }

def generate_geo(district):
    """Generate random lat/lng within Chhattisgarh bounds."""
    # Approximate bounds: 17-24°N, 80-85°E
    lat = round(random.uniform(17.0, 24.0), 6)
    lng = round(random.uniform(80.0, 85.0), 6)
    return lat, lng

def generate_village(district):
    """Generate a single village entry."""
    name = generate_village_name()
    variants = generate_variants(name)
    lat, lng = generate_geo(district)
    constituency = CONSTITUENCIES.get(district, {"assembly": f"{district} विधानसभा", "parliamentary": f"{district} लोकसभा"})
    return {
        "village_code": f"CG{random.randint(1000, 9999)}",
        "name": name,
        **variants,
        "type": "village",
        "population_total": random.randint(500, 5000),
        "population_male": random.randint(250, 2500),
        "population_female": random.randint(250, 2500),
        "area_hectares": round(random.uniform(50, 500), 2),
        "pincode": random.randint(490000, 499999),
        "latitude": lat,
        "longitude": lng,
        "district": district,
        "state": STATE,
        "assembly_constituency": constituency["assembly"],
        "parliamentary_constituency": constituency["parliamentary"],
        "tehsil": district,  # Simplified
        "block": district,
        "gram_panchayat": name,
        "development_block": district,
        "revenue_circle": district,
        "police_station": district,
        "post_office": f"{name} SO",
        "electricity_coverage": round(random.uniform(70, 100), 1),
        "water_supply": random.choice(["piped", "handpump", "well"]),
        "sanitation_coverage": round(random.uniform(50, 90), 1),
        "literacy_rate": round(random.uniform(60, 90), 1),
        "main_occupation": random.choice(["agriculture", "service", "industrial"]),
        "caste_composition": {
            "scheduled_caste": round(random.uniform(10, 25), 1),
            "scheduled_tribe": round(random.uniform(20, 40), 1),
            "other_backward_class": round(random.uniform(20, 30), 1),
            "general": round(random.uniform(25, 50), 1)
        },
        "infrastructure": {
            "roads": random.choice(["paved", "kaccha"]),
            "transport": random.choice(["bus_stand", "none"]),
            "market": random.choice(["weekly_market", "none"]),
            "internet": random.choice(["broadband_available", "mobile_data", "none"])
        }
    }

def main():
    villages = []
    for _ in range(NUM_VILLAGES):
        district = random.choice(DISTRICTS)
        village = generate_village(district)
        villages.append(village)

    data = {
        "state": STATE,
        "state_code": STATE_CODE,
        "total_villages": len(villages),
        "villages": villages
    }

    with open("data/full_villages.json", 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Generated {len(villages)} villages; saved to data/full_villages.json")

if __name__ == "__main__":
    main()
