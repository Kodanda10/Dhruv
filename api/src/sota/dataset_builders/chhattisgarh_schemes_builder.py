import json
import sys

def build_chhattisgarh_schemes_dataset():
    """
    Builds Chhattisgarh Govt Schemes dataset in NDJSON format.
    Outputs schemes with eligibility, benefits, and application process.
    """
    # Mock data for Chhattisgarh government schemes (can be replaced with real data source)
    schemes = [
        {
            "name": "मुख्यमंत्री ग्रामीण आवास योजना",
            "type": "state",
            "department": "ग्रामीण विकास विभाग",
            "eligibility": {
                "category": "अनुसूचित जाति/जनजाति परिवार",
                "income_limit": "वार्षिक आय 1.5 लाख से कम",
                "residence": "ग्रामीण क्षेत्र में निवासी",
                "house_condition": "पक्का घर नहीं होना चाहिए"
            },
            "benefits": {
                "financial_assistance": "1.5 लाख रुपए तक",
                "construction_support": "घर निर्माण के लिए तकनीकी सहायता",
                "additional_benefits": "शौचालय निर्माण के लिए अलग से सहायता"
            },
            "application_process": {
                "application_form": "ग्राम पंचायत से उपलब्ध",
                "documents_required": ["आधार कार्ड", "आय प्रमाण पत्र", "जाति प्रमाण पत्र", "भूमि दस्तावेज"],
                "submission": "ग्राम पंचायत कार्यालय में जमा करें",
                "approval_time": "30-45 दिन"
            },
            "contact": {
                "department": "ग्रामीण विकास विभाग",
                "helpline": "1800-XXX-XXXX"
            }
        },
        {
            "name": "गोधन न्याय योजना",
            "type": "state",
            "department": "पशुधन विकास विभाग",
            "eligibility": {
                "category": "गौ पालक किसान",
                "ownership": "कम से कम 2 गायों का स्वामित्व",
                "residence": "छत्तीसगढ़ राज्य का निवासी"
            },
            "benefits": {
                "monthly_payment": "प्रति गाय 6,000 रुपए प्रतिवर्ष",
                "additional_support": "गौठान निर्माण के लिए सहायता",
                "training": "गौ पालन प्रशिक्षण"
            },
            "application_process": {
                "application_form": "पंचायत सचिवालय से प्राप्त",
                "documents_required": ["आधार कार्ड", "गायों का प्रमाण पत्र", "खाता संख्या"],
                "submission": "ग्राम पंचायत कार्यालय",
                "verification": "पशुधन अधिकारी द्वारा सत्यापन"
            },
            "contact": {
                "department": "पशुधन विकास विभाग",
                "helpline": "1800-XXX-XXXX"
            }
        },
        {
            "name": "मुख्यमंत्री स्वास्थ्य बीमा योजना",
            "type": "state",
            "department": "स्वास्थ्य विभाग",
            "eligibility": {
                "category": "आर्थिक रूप से कमजोर परिवार",
                "income_limit": "वार्षिक आय 3 लाख से कम",
                "family_size": "परिवार के सभी सदस्य"
            },
            "benefits": {
                "coverage": "5 लाख रुपए तक का स्वास्थ्य बीमा",
                "hospitalization": "निजी अस्पतालों में उपचार",
                "diseases_covered": ["कैंसर", "हृदय रोग", "किडनी", "मस्तिष्क"],
                "family_members": "परिवार के सभी सदस्य कवर"
            },
            "application_process": {
                "application_form": "ऑनलाइन पोर्टल या सामान्य अस्पताल से",
                "documents_required": ["आधार कार्ड", "आय प्रमाण पत्र", "परिवार प्रमाण पत्र"],
                "submission": "निकटतम अस्पताल या ऑनलाइन",
                "card_issuance": "स्वीकृति के बाद 15 दिन में"
            },
            "contact": {
                "department": "स्वास्थ्य विभाग",
                "helpline": "1800-XXX-XXXX"
            }
        }
    ]

    # Generate NDJSON
    for scheme in schemes:
        yield json.dumps(scheme, ensure_ascii=False)

if __name__ == "__main__":
    for line in build_chhattisgarh_schemes_dataset():
        print(line)
