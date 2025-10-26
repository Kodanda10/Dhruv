import { GoogleGenerativeAI } from '@google/generative-ai';
import { Pool } from 'pg';

// Initialize Gemini AI
const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// SOTA Context for Chhattisgarh
const CHHATTISGARH_CONTEXT = `
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
`;

interface ReferenceData {
  schemes: Array<{
    id: number;
    code: string;
    name_hi: string;
    name_en: string;
    category: string;
    ministry: string;
    description_hi: string;
  }>;
  eventTypes: Array<{
    id: number;
    code: string;
    name_hi: string;
    name_en: string;
    aliases_hi: string[];
    aliases_en: string[];
    category: string;
  }>;
}

class ReferenceDataLoader {
  private schemesCache: ReferenceData['schemes'] = [];
  private eventTypesCache: ReferenceData['eventTypes'] = [];
  private lastLoadTime = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  async loadReferenceData(): Promise<ReferenceData> {
    const now = Date.now();
    
    // Return cached data if still fresh
    if (now - this.lastLoadTime < this.CACHE_DURATION && this.schemesCache.length > 0) {
      return {
        schemes: this.schemesCache,
        eventTypes: this.eventTypesCache
      };
    }

    try {
      // Load schemes
      const schemesResult = await pool.query(`
        SELECT id, scheme_code, name_hi, name_en, category, 
               ministry, description_hi
        FROM ref_schemes
        WHERE is_active = true
        ORDER BY usage_count DESC
      `);
      this.schemesCache = schemesResult.rows;

      // Load event types with aliases
      const eventTypesResult = await pool.query(`
        SELECT id, event_code, name_hi, name_en, 
               aliases_hi, aliases_en, category
        FROM ref_event_types
        WHERE is_active = true
        ORDER BY usage_count DESC
      `);
      this.eventTypesCache = eventTypesResult.rows;

      this.lastLoadTime = now;
      
      return {
        schemes: this.schemesCache,
        eventTypes: this.eventTypesCache
      };
    } catch (error) {
      console.error('Error loading reference data:', error);
      return {
        schemes: [],
        eventTypes: []
      };
    }
  }

  getSchemesContext(schemes: ReferenceData['schemes']): string {
    if (!schemes.length) return '';

    const central = schemes.filter(s => s.category === 'central');
    const state = schemes.filter(s => s.category === 'state');

    let context = 'GOVERNMENT SCHEMES:\n';
    context += 'Central Schemes:\n';
    for (const scheme of central.slice(0, 10)) {
      context += `- ${scheme.name_hi} (${scheme.name_en})\n`;
    }

    context += '\nChhattisgarh State Schemes:\n';
    for (const scheme of state.slice(0, 10)) {
      context += `- ${scheme.name_hi} (${scheme.name_en})\n`;
    }

    return context;
  }

  getEventTypesContext(eventTypes: ReferenceData['eventTypes']): string {
    if (!eventTypes.length) return '';

    let context = 'EVENT TYPES (with Hindi aliases):\n';
    for (const evt of eventTypes) {
      const aliasesStr = (evt.aliases_hi || []).join(', ');
      context += `- ${evt.name_hi} (${evt.name_en})`;
      if (aliasesStr) {
        context += ` | Aliases: ${aliasesStr}`;
      }
      context += '\n';
    }

    return context;
  }

  matchSchemes(text: string, schemes: ReferenceData['schemes']): Array<{ id: number; code: string; name_hi: string; name_en: string; category: string }> {
    const matched: Array<{ id: number; code: string; name_hi: string; name_en: string; category: string }> = [];
    
    for (const scheme of schemes) {
      // Check direct match
      if (text.includes(scheme.name_hi) || text.includes(scheme.name_en)) {
        matched.push({
          id: scheme.id,
          code: scheme.code,
          name_hi: scheme.name_hi,
          name_en: scheme.name_en,
          category: scheme.category
        });
        continue;
      }

      // Check partial match (key terms)
      if (scheme.name_hi.includes('किसान') && text.includes('किसान')) {
        matched.push({
          id: scheme.id,
          code: scheme.code,
          name_hi: scheme.name_hi,
          name_en: scheme.name_en,
          category: scheme.category
        });
      }
    }

    return matched;
  }

  matchEventType(text: string, eventTypes: ReferenceData['eventTypes']): { id: number; code: string; name_hi: string; name_en: string; category: string; matched_via?: string } | null {
    for (const evt of eventTypes) {
      // Check main names
      if (text.includes(evt.name_hi) || text.includes(evt.name_en)) {
        return {
          id: evt.id,
          code: evt.code,
          name_hi: evt.name_hi,
          name_en: evt.name_en,
          category: evt.category
        };
      }

      // Check aliases
      if (evt.aliases_hi) {
        for (const alias of evt.aliases_hi) {
          if (text.includes(alias)) {
            return {
              id: evt.id,
              code: evt.code,
              name_hi: evt.name_hi,
              name_en: evt.name_en,
              category: evt.category,
              matched_via: alias
            };
          }
        }
      }
    }

    return null;
  }
}

// Global reference data loader
const refLoader = new ReferenceDataLoader();

function generateContextualHashtags(parsedData: any): string[] {
  const hashtags: string[] = [];

  // From locations
  if (parsedData.locations && parsedData.locations.length > 0) {
    for (const loc of parsedData.locations.slice(0, 2)) {
      hashtags.push(`#${loc.replace(/\s+/g, '')}`);
    }
  }

  // From event type
  if (parsedData.event_type) {
    hashtags.push(`#${parsedData.event_type.replace(/\s+/g, '')}`);
  }

  // From schemes
  if (parsedData.schemes && parsedData.schemes.length > 0) {
    for (const scheme of parsedData.schemes.slice(0, 1)) {
      const terms = scheme.split(' ');
      if (terms.length >= 2) {
        const keyTerm = terms[1];
        hashtags.push(`#${keyTerm}`);
      }
    }
  }

  // General political hashtags
  hashtags.push('#छत्तीसगढ़');
  hashtags.push('#Chhattisgarh');

  // Deduplicate
  return [...new Set(hashtags)];
}

export async function parseTweetWithGemini(tweetText: string, tweetId: string): Promise<any> {
  try {
    // Load reference data
    const referenceData = await refLoader.loadReferenceData();

    // Pre-match using reference data
    const matchedSchemes = refLoader.matchSchemes(tweetText, referenceData.schemes);
    const matchedEvent = refLoader.matchEventType(tweetText, referenceData.eventTypes);

    // Build enhanced context
    const schemesContext = refLoader.getSchemesContext(referenceData.schemes);
    const eventsContext = refLoader.getEventTypesContext(referenceData.eventTypes);

    const model = genai.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
${CHHATTISGARH_CONTEXT}

${schemesContext}

${eventsContext}

PRE-MATCHED DATA (use as hints):
- Schemes detected: ${matchedSchemes.map(s => s.name_hi).join(', ')}
- Event type hint: ${matchedEvent?.name_hi || 'Unknown'}

TASK: Analyze this tweet and extract structured information.

TWEET TEXT:
${tweetText}

OUTPUT FORMAT (JSON):
{
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
  "matched_scheme_ids": [1, 2],
  "matched_event_id": 5
}

IMPORTANT:
- Use EXACT scheme names from the reference list
- Match event type to one from the EVENT TYPES list
- Include both Hindi and English names for schemes
- Return scheme/event IDs for tracking

Return ONLY valid JSON, no extra text.
`;

    const response = await model.generateContent(prompt);
    const resultText = response.response.text().trim();

    // Clean markdown
    let cleanedText = resultText;
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.split('```')[1];
      if (cleanedText.startsWith('json')) {
        cleanedText = cleanedText.slice(4);
      }
    }

    const parsed = JSON.parse(cleanedText);

    // Ensure confidence
    if (typeof parsed.confidence !== 'number') {
      parsed.confidence = 0.5;
    }

    // Add pre-matched data if Gemini missed it
    if (matchedSchemes.length > 0 && !parsed.matched_scheme_ids) {
      parsed.matched_scheme_ids = matchedSchemes.map(s => s.id);
      if (!parsed.schemes || parsed.schemes.length === 0) {
        parsed.schemes = matchedSchemes.map(s => s.name_hi);
        parsed.schemes_en = matchedSchemes.map(s => s.name_en);
      }
    }

    if (matchedEvent && !parsed.matched_event_id) {
      parsed.matched_event_id = matchedEvent.id;
    }

    // Generate hashtags
    parsed.generated_hashtags = generateContextualHashtags(parsed);

    return parsed;

  } catch (error) {
    console.error('Gemini parsing error:', error);
    return {
      event_type: 'Unknown',
      event_type_en: 'Unknown',
      event_code: 'UNKNOWN',
      locations: [],
      people: [],
      organizations: [],
      schemes: [],
      schemes_en: [],
      date: null,
      confidence: 0.0,
      error: error instanceof Error ? error.message : 'Unknown error',
      generated_hashtags: []
    };
  }
}

export async function saveParsedTweetToDatabase(tweetId: string, parsedData: any): Promise<any> {
  try {
    const {
      event_type,
      event_type_en,
      event_code,
      locations,
      people,
      organizations,
      schemes,
      schemes_en,
      date,
      confidence,
      reasoning,
      matched_scheme_ids,
      matched_event_id
    } = parsedData;

    // Determine if review is needed (confidence < 0.7)
    const needsReview = confidence < 0.7;

    // Insert into parsed_events table
    const insertQuery = `
      INSERT INTO parsed_events (
        tweet_id, event_type, event_date, locations, people_mentioned, 
        organizations, schemes_mentioned, overall_confidence, needs_review, 
        review_status, parsed_at, parsed_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), 'gemini')
      RETURNING id, tweet_id, event_type, event_date, locations, 
                people_mentioned, organizations, schemes_mentioned, 
                overall_confidence, needs_review, review_status, parsed_at
    `;

    const result = await pool.query(insertQuery, [
      tweetId,
      event_type,
      date,
      JSON.stringify(locations),
      people,
      organizations,
      schemes,
      confidence.toString(),
      needsReview,
      'pending'
    ]);

    return result.rows[0];

  } catch (error) {
    console.error('Database save error:', error);
    throw error;
  }
}
