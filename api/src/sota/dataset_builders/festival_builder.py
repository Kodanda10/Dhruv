import json
import sys

def build_festival_dataset():
    """
    Builds festival dataset in NDJSON format.
    Outputs festivals with lunar/solar rules and year_dates resolution.
    """
    # Mock data for festivals in Chhattisgarh (can be replaced with real data source)
    festivals = [
        {
            "name": "होली",
            "type": "lunar",
            "month": "फाल्गुन",
            "day": "पूर्णिमा",
            "description": "रंगों का त्योहार",
            "year_dates": {
                "2024": "2024-03-14",
                "2025": "2025-03-03",
                "2026": "2026-03-23"
            }
        },
        {
            "name": "दशहरा",
            "type": "lunar",
            "month": "आश्विन",
            "day": "दशमी",
            "description": "शुभ विजय का पर्व",
            "year_dates": {
                "2024": "2024-10-12",
                "2025": "2025-10-02",
                "2026": "2025-09-21"
            }
        },
        {
            "name": "दीवाली",
            "type": "lunar",
            "month": "कार्तिक",
            "day": "अमावस्या",
            "description": "प्रकाश का त्योहार",
            "year_dates": {
                "2024": "2024-10-31",
                "2025": "2025-10-20",
                "2026": "2026-10-09"
            }
        }
    ]

    # Generate NDJSON
    for festival in festivals:
        yield json.dumps(festival, ensure_ascii=False)

if __name__ == "__main__":
    for line in build_festival_dataset():
        print(line)
