import json
import sys

def build_central_schemes_dataset():
    """
    Builds Central Govt Schemes dataset in NDJSON format.
    Outputs schemes with eligibility, benefits, and application process.
    """
    # Mock data for Central government schemes (can be replaced with real data source)
    schemes = [
        {
            "name": "प्रधानमंत्री आवास योजना (PMAY)",
            "type": "central",
            "department": "आवास और शहरी मामलों का मंत्रालय",
            "eligibility": {
                "category": "आर्थिक रूप से कमजोर वर्ग (EWS) और निम्न आय वर्ग (LIG)",
                "income_limit": "वार्षिक आय 3-6 लाख रुपए",
                "residence": "शहरी क्षेत्र में निवासी",
                "house_condition": "पक्का घर नहीं होना चाहिए"
            },
            "benefits": {
                "financial_assistance": "2.67 लाख रुपए तक (EWS के लिए)",
                "interest_subsidy": "6.5% ब्याज सब्सिडी",
                "additional_benefits": "कारपोरेशन पानी और बिजली कनेक्शन"
            },
            "application_process": {
                "application_form": "ऑनलाइन PMAY पोर्टल या राज्य सरकार के माध्यम से",
                "documents_required": ["आधार कार्ड", "आय प्रमाण पत्र", "संपत्ति दस्तावेज", "बैंक खाता"],
                "submission": "निकटतम नगर निगम कार्यालय या ऑनलाइन",
                "approval_time": "45-60 दिन"
            },
            "contact": {
                "department": "आवास और शहरी मामलों का मंत्रालय",
                "helpline": "1800-XXX-XXXX",
                "website": "pmaymis.gov.in"
            }
        },
        {
            "name": "आयुष्मान भारत योजना (PM-JAY)",
            "type": "central",
            "department": "स्वास्थ्य और परिवार कल्याण मंत्रालय",
            "eligibility": {
                "category": "सामाजिक-आर्थिक जाति जनगणना (SECC) सूची में शामिल परिवार",
                "income_limit": "वार्षिक आय निर्धारित सीमा से कम",
                "family_size": "परिवार के सभी सदस्य"
            },
            "benefits": {
                "coverage": "5 लाख रुपए तक का स्वास्थ्य बीमा",
                "hospitalization": "सभी सरकारी और निजी अस्पतालों में",
                "diseases_covered": ["कैंसर", "हृदय रोग", "किडनी", "मस्तिष्क", "बर्न्स"],
                "cashless_treatment": "पूरी तरह कैशलेस उपचार",
                "family_members": "परिवार के 5 सदस्य कवर"
            },
            "application_process": {
                "application_form": "स्वचालित रूप से SECC डेटा के आधार पर",
                "documents_required": ["आधार कार्ड", "परिवार पहचान पत्र"],
                "verification": "राज्य सरकार द्वारा सत्यापन",
                "card_issuance": "स्वीकृति के बाद 30 दिन में"
            },
            "contact": {
                "department": "स्वास्थ्य और परिवार कल्याण मंत्रालय",
                "helpline": "14555",
                "website": "pmjay.gov.in"
            }
        },
        {
            "name": "प्रधानमंत्री किसान सम्मान निधि (PM-KISAN)",
            "type": "central",
            "department": "कृषि और किसान कल्याण मंत्रालय",
            "eligibility": {
                "category": "सभी किसान परिवार",
                "land_holding": "2 हेक्टेयर तक की कृषि योग्य भूमि",
                "exclusions": "पेंशनभोगी, डॉक्टर, इंजीनियर, वकील"
            },
            "benefits": {
                "financial_assistance": "प्रति वर्ष 6,000 रुपए (तीन किस्तों में)",
                "payment_frequency": "हर 4 महीने में एक किस्त",
                "additional_benefits": "कृषि विकास के लिए सहायता"
            },
            "application_process": {
                "application_form": "ऑनलाइन PM-KISAN पोर्टल या CSC केंद्र से",
                "documents_required": ["आधार कार्ड", "खाता संख्या", "भूमि दस्तावेज"],
                "submission": "निकटतम CSC केंद्र या ऑनलाइन",
                "verification": "राज्य सरकार द्वारा भूमि रिकॉर्ड सत्यापन"
            },
            "contact": {
                "department": "कृषि और किसान कल्याण मंत्रालय",
                "helpline": "155261",
                "website": "pmkisan.gov.in"
            }
        },
        {
            "name": "स्वच्छ भारत मिशन (SBM)",
            "type": "central",
            "department": "जल शक्ति मंत्रालय",
            "eligibility": {
                "category": "सभी ग्रामीण और शहरी परिवार",
                "focus_area": "शौचालय निर्माण और स्वच्छता"
            },
            "benefits": {
                "financial_assistance": "शौचालय निर्माण के लिए 12,000 रुपए तक",
                "additional_support": "स्वच्छता शिक्षा और जागरूकता",
                "community_benefits": "ग्राम पंचायत स्तर पर अतिरिक्त सहायता"
            },
            "application_process": {
                "application_form": "ग्राम पंचायत या नगर निगम से",
                "documents_required": ["आधार कार्ड", "आय प्रमाण पत्र"],
                "submission": "स्थानीय प्रशासन कार्यालय",
                "monitoring": "ग्राम रोजगार सेवक द्वारा निरीक्षण"
            },
            "contact": {
                "department": "जल शक्ति मंत्रालय",
                "helpline": "1800-XXX-XXXX",
                "website": "swachhbharatmission.gov.in"
            }
        }
    ]

    # Generate NDJSON
    for scheme in schemes:
        yield json.dumps(scheme, ensure_ascii=False)

if __name__ == "__main__":
    for line in build_central_schemes_dataset():
        print(line)
