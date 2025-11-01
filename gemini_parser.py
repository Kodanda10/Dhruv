import google.generativeai as genai
import psycopg2
import os
import json
from typing import Dict, List, Optional

genai.configure(api_key=os.getenv('GEMINI_API_KEY'))

# SOTA Context for Chhattisgarh
CHHATTISGARH_CONTEXT = """
You are an expert parser for political tweets from Chhattisgarh, India. Your task is to extract structured information from Hindi/English tweets about political activities, government schemes, and public events.

CONTEXT:
- Chhattisgarh is a state in central India
- Capital: Raipur
- Major districts: Raigarh, Bilaspur, Durg, Rajnandgaon, Bastar, Surguja
- Language: Hindi (Devanagari script), some English
- Political context: State government activities, central government schemes, local governance

GEOGRAPHY HIERARCHY:
State → District → Assembly Constituency → Block → Gram Panchayat → Village
- Raigarh district includes: Raigarh AC, Sarangarh AC
- Bilaspur district includes: Bilaspur AC, Kota AC, Takhatpur AC
- Durg district includes: Durg AC, Bhilai AC, Patan AC

COMMON ENTITIES:
- People: Chief Minister, Ministers, MLAs, MPs, local leaders
- Organizations: Government departments, political parties, NGOs
- Schemes: Central and state government welfare programs
- Events: Meetings, rallies, inaugurations, inspections, distributions
"""

class ReferenceDataLoader:
    """Load and cache reference datasets for parsing"""
    
    def __init__(self):
        self.schemes_cache = None
        self.event_types_cache = None
        self._load_reference_data()
    
    def _load_reference_data(self):
        """Load reference data from database"""
        try:
            conn = psycopg2.connect(
                host=os.getenv('DB_HOST', 'localhost'),
                database=os.getenv('DB_NAME', 'dhruv_db'),
                user=os.getenv('DB_USER', 'dhruv_user'),
                password=os.getenv('DB_PASSWORD', 'dhruv_pass')
            )
            cursor = conn.cursor()
            
            # Load schemes
            cursor.execute("""
                SELECT id, scheme_code, name_hi, name_en, category, 
                       ministry, description_hi
                FROM ref_schemes
                WHERE is_active = true
                ORDER BY usage_count DESC
            """)
            self.schemes_cache = cursor.fetchall()
            
            # Load event types with aliases
            cursor.execute("""
                SELECT id, event_code, name_hi, name_en, 
                       aliases_hi, aliases_en, category
                FROM ref_event_types
                WHERE is_active = true
                ORDER BY usage_count DESC
            """)
            self.event_types_cache = cursor.fetchall()
            
            cursor.close()
            conn.close()
        except Exception as e:
            print(f"Error loading reference data: {e}")
            self.schemes_cache = []
            self.event_types_cache = []
    
    def get_schemes_context(self) -> str:
        """Format schemes for Gemini prompt"""
        if not self.schemes_cache:
            return ""
        
        central = [s for s in self.schemes_cache if s[4] == 'central']
        state = [s for s in self.schemes_cache if s[4] == 'state']
        
        context = "GOVERNMENT SCHEMES:\n"
        context += "Central Schemes:\n"
        for scheme in central[:10]:  # Top 10 by usage
            context += f"- {scheme[2]} ({scheme[3]})\n"
        
        context += "\nChhattisgarh State Schemes:\n"
        for scheme in state[:10]:
            context += f"- {scheme[2]} ({scheme[3]})\n"
        
        return context
    
    def get_event_types_context(self) -> str:
        """Format event types for Gemini prompt"""
        if not self.event_types_cache:
            return ""
        
        context = "EVENT TYPES (with Hindi aliases):\n"
        for evt in self.event_types_cache:
            evt_id, code, name_hi, name_en, aliases_hi, aliases_en, category = evt
            aliases_str = ", ".join(aliases_hi or [])
            context += f"- {name_hi} ({name_en})"
            if aliases_str:
                context += f" | Aliases: {aliases_str}"
            context += "\n"
        
        return context
    
    def match_scheme(self, text: str) -> List[Dict]:
        """Match schemes in text using fuzzy matching"""
        matched = []
        if not self.schemes_cache:
            return matched
        
        for scheme in self.schemes_cache:
            scheme_id, code, name_hi, name_en, category, ministry, desc = scheme
            
            # Check direct match
            if name_hi in text or name_en in text:
                matched.append({
                    'id': scheme_id,
                    'code': code,
                    'name_hi': name_hi,
                    'name_en': name_en,
                    'category': category
                })
                continue
            
            # Check partial match (key terms)
            if 'किसान' in name_hi and 'किसान' in text:
                matched.append({
                    'id': scheme_id,
                    'code': code,
                    'name_hi': name_hi,
                    'name_en': name_en,
                    'category': category
                })
        
        return matched
    
    def match_event_type(self, text: str) -> Optional[Dict]:
        """Match event type including aliases"""
        if not self.event_types_cache:
            return None
        
        for evt in self.event_types_cache:
            evt_id, code, name_hi, name_en, aliases_hi, aliases_en, category = evt
            
            # Check main names
            if name_hi in text or name_en in text:
                return {
                    'id': evt_id,
                    'code': code,
                    'name_hi': name_hi,
                    'name_en': name_en,
                    'category': category
                }
            
            # Check aliases
            if aliases_hi:
                for alias in aliases_hi:
                    if alias in text:
                        return {
                            'id': evt_id,
                            'code': code,
                            'name_hi': name_hi,
                            'name_en': name_en,
                            'category': category,
                            'matched_via': alias
                        }
        
        return None

# Global reference data loader
ref_loader = ReferenceDataLoader()

def normalize_for_matching(text: str) -> str:
    """Normalize text for matching (simplified version)"""
    return text.lower().strip()

def transliterate_devanagari(text: str) -> str:
    """Simple transliteration (simplified version)"""
    # Basic transliteration mapping
    mapping = {
        'रायगढ़': 'Raigarh',
        'किसान': 'Kisan',
        'योजना': 'Yojana',
        'मुख्यमंत्री': 'CM',
        'प्रधानमंत्री': 'PM'
    }
    
    for hindi, english in mapping.items():
        text = text.replace(hindi, english)
    
    return text

def generate_contextual_hashtags(parsed_data: Dict) -> List[str]:
    """Generate intelligent hashtags based on parsed data"""
    hashtags = []
    
    # From locations
    if parsed_data.get('locations'):
        for loc in parsed_data['locations'][:2]:  # Max 2
            # Hindi version
            hashtags.append(f"#{loc.replace(' ', '')}")
            # Transliterated version
            hashtags.append(f"#{transliterate_devanagari(loc)}")
    
    # From event type
    if parsed_data.get('event_type'):
        evt = parsed_data['event_type']
        hashtags.append(f"#{evt.replace(' ', '')}")
    
    # From schemes
    if parsed_data.get('schemes'):
        for scheme in parsed_data['schemes'][:1]:  # Max 1
            # Extract key term (e.g., "किसान" from "मुख्यमंत्री किसान योजना")
            terms = scheme.split()
            if len(terms) >= 2:
                key_term = terms[1]  # Usually the category
                hashtags.append(f"#{key_term}")
    
    # General political hashtags
    hashtags.append("#छत्तीसगढ़")
    hashtags.append("#Chhattisgarh")
    
    # Deduplicate
    return list(set(hashtags))

def parse_tweet_with_gemini(tweet_text: str) -> dict:
    """Enhanced parser with reference datasets"""
    
    # Pre-match using reference data
    matched_schemes = ref_loader.match_scheme(tweet_text)
    matched_event = ref_loader.match_event_type(tweet_text)
    
    # Build enhanced context
    schemes_context = ref_loader.get_schemes_context()
    events_context = ref_loader.get_event_types_context()
    
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    prompt = f"""
{CHHATTISGARH_CONTEXT}

{schemes_context}

{events_context}

PRE-MATCHED DATA (use as hints):
- Schemes detected: {[s['name_hi'] for s in matched_schemes]}
- Event type hint: {matched_event['name_hi'] if matched_event else 'Unknown'}

TASK: Analyze this tweet and extract structured information.

TWEET TEXT:
{tweet_text}

OUTPUT FORMAT (JSON):
{{
  "event_type": "Use one from EVENT TYPES list above",
  "event_type_en": "English name",
  "event_code": "CODE from list",
  "locations": ["District/Block/Village names"],
  "people": ["Person names mentioned"],
  "organizations": ["Organization names"],
  "schemes": ["Use EXACT names from GOVERNMENT SCHEMES list"],
  "schemes_en": ["English names of schemes"],
  "date": "YYYY-MM-DD or null",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation",
  "matched_scheme_ids": [1, 2],  // IDs of matched schemes
  "matched_event_id": 5  // ID of matched event type
}}

IMPORTANT:
- Use EXACT scheme names from the reference list
- Match event type to one from the EVENT TYPES list
- Include both Hindi and English names for schemes
- Return scheme/event IDs for tracking

Return ONLY valid JSON, no extra text.
"""
    
    try:
        response = model.generate_content(prompt)
        result_text = response.text.strip()
        
        # Clean markdown
        if result_text.startswith('```'):
            result_text = result_text.split('```')[1]
            if result_text.startswith('json'):
                result_text = result_text[4:]
        
        parsed = json.loads(result_text)
        
        # Ensure confidence
        if 'confidence' not in parsed:
            parsed['confidence'] = 0.5
        
        # Add pre-matched data if Gemini missed it
        if matched_schemes and not parsed.get('matched_scheme_ids'):
            parsed['matched_scheme_ids'] = [s['id'] for s in matched_schemes]
            if not parsed.get('schemes'):
                parsed['schemes'] = [s['name_hi'] for s in matched_schemes]
                parsed['schemes_en'] = [s['name_en'] for s in matched_schemes]
        
        if matched_event and not parsed.get('matched_event_id'):
            parsed['matched_event_id'] = matched_event['id']
        
        # Generate hashtags
        parsed['generated_hashtags'] = generate_contextual_hashtags(parsed)
        
        return parsed

        except Exception as e:
        print(f"Gemini parsing error: {str(e)}")
        return {
            "event_type": "Unknown",
            "locations": [],
            "people": [],
            "organizations": [],
            "schemes": [],
            "schemes_en": [],
            "date": None,
            "confidence": 0.0,
            "error": str(e),
            "generated_hashtags": []
        }

# Test function for development
if __name__ == "__main__":
    test_tweet = "मुख्यमंत्री किसान योजना के तहत रायगढ़ में सहायता वितरित की"
    result = parse_tweet_with_gemini(test_tweet)
    print(json.dumps(result, indent=2, ensure_ascii=False))