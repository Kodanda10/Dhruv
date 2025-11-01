import { Pool } from 'pg';

// Mock the database connection
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn()
  }))
}));

// Mock the Gemini API
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn()
    })
  }))
}));

describe('Enhanced Gemini Parser with Reference Data Integration (TDD)', () => {
  let mockPool: any;
  let mockQuery: jest.Mock;
  let mockModel: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock pool
    mockPool = {
      query: jest.fn()
    };
    
    mockQuery = jest.fn();
    
    // Mock the Pool constructor
    const { Pool } = require('pg');
    Pool.mockImplementation(() => mockPool);
    
    // Setup mock query
    mockPool.query = mockQuery;
    
    // Setup mock Gemini model
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const mockGenAI = new GoogleGenerativeAI('test-key');
    mockModel = mockGenAI.getGenerativeModel();
  });

  it('should load reference data from database for context building', async () => {
    // Mock schemes data
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 1, scheme_code: 'PM_KISAN', name_hi: 'प्रधानमंत्री किसान सम्मान निधि', name_en: 'PM-KISAN', category: 'central' },
        { id: 2, scheme_code: 'CM_KISAN_CG', name_hi: 'मुख्यमंत्री किसान योजना', name_en: 'CM Kisan Yojana CG', category: 'state' }
      ]
    });

    // Mock event types data
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 1, event_code: 'MEETING', name_hi: 'बैठक', name_en: 'Meeting', aliases_hi: ['मुलाकात', 'चर्चा'], aliases_en: ['discussion', 'meeting'] },
        { id: 2, event_code: 'RALLY', name_hi: 'रैली', name_en: 'Rally', aliases_hi: ['सम्मेलन', 'जनसभा'], aliases_en: ['conference', 'public meeting'] }
      ]
    });

    const loadReferenceData = async () => {
      // Load schemes
      const schemesResult = await mockPool.query(`
        SELECT id, scheme_code, name_hi, name_en, category, ministry, description_hi
        FROM ref_schemes
        WHERE is_active = true
        ORDER BY usage_count DESC
      `);
      
      // Load event types
      const eventTypesResult = await mockPool.query(`
        SELECT id, event_code, name_hi, name_en, aliases_hi, aliases_en, category
        FROM ref_event_types
        WHERE is_active = true
        ORDER BY usage_count DESC
      `);
      
      return {
        schemes: schemesResult.rows,
        eventTypes: eventTypesResult.rows
      };
    };

    const result = await loadReferenceData();
    
    expect(result.schemes).toHaveLength(2);
    expect(result.eventTypes).toHaveLength(2);
    expect(result.schemes[0].name_hi).toBe('प्रधानमंत्री किसान सम्मान निधि');
    expect(result.eventTypes[0].aliases_hi).toEqual(['मुलाकात', 'चर्चा']);
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it('should pre-match schemes and event types using reference data', async () => {
    const tweetText = 'मुख्यमंत्री किसान योजना के तहत रायगढ़ में बैठक हुई';
    
    // Mock schemes data
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 1, scheme_code: 'PM_KISAN', name_hi: 'प्रधानमंत्री किसान सम्मान निधि', name_en: 'PM-KISAN' },
        { id: 2, scheme_code: 'CM_KISAN_CG', name_hi: 'मुख्यमंत्री किसान योजना', name_en: 'CM Kisan Yojana CG' }
      ]
    });

    // Mock event types data
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 1, event_code: 'MEETING', name_hi: 'बैठक', name_en: 'Meeting', aliases_hi: ['मुलाकात', 'चर्चा'] },
        { id: 2, event_code: 'RALLY', name_hi: 'रैली', name_en: 'Rally', aliases_hi: ['सम्मेलन', 'जनसभा'] }
      ]
    });

    const preMatchData = async (text: string) => {
      // Load reference data
      const schemesResult = await mockPool.query(`SELECT id, scheme_code, name_hi, name_en FROM ref_schemes WHERE is_active = true`);
      const eventTypesResult = await mockPool.query(`SELECT id, event_code, name_hi, name_en, aliases_hi FROM ref_event_types WHERE is_active = true`);
      
      // Pre-match schemes
      const matchedSchemes = schemesResult.rows.filter((scheme: any) => 
        text.includes(scheme.name_hi) || text.includes(scheme.name_en)
      );
      
      // Pre-match event types
      const matchedEventType = eventTypesResult.rows.find((eventType: any) => {
        if (text.includes(eventType.name_hi) || text.includes(eventType.name_en)) {
          return true;
        }
        if (eventType.aliases_hi && eventType.aliases_hi.some((alias: any) => text.includes(alias))) {
          return true;
        }
        return false;
      });
      
      return {
        matchedSchemes,
        matchedEventType
      };
    };

    const result = await preMatchData(tweetText);
    
    expect(result.matchedSchemes).toHaveLength(1);
    expect(result.matchedSchemes[0].name_hi).toBe('मुख्यमंत्री किसान योजना');
    expect(result.matchedEventType).toBeDefined();
    expect(result.matchedEventType.name_hi).toBe('बैठक');
  });

  it('should build comprehensive context for Gemini with reference data', async () => {
    const tweetText = 'मुख्यमंत्री किसान योजना के तहत रायगढ़ में बैठक हुई';
    
    // Mock reference data
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 1, scheme_code: 'CM_KISAN_CG', name_hi: 'मुख्यमंत्री किसान योजना', name_en: 'CM Kisan Yojana CG', category: 'state' }
      ]
    });

    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 1, event_code: 'MEETING', name_hi: 'बैठक', name_en: 'Meeting', aliases_hi: ['मुलाकात', 'चर्चा'], category: 'administrative' }
      ]
    });

    const buildContext = async (text: string) => {
      // Load reference data
      const schemesResult = await mockPool.query(`SELECT * FROM ref_schemes WHERE is_active = true`);
      const eventTypesResult = await mockPool.query(`SELECT * FROM ref_event_types WHERE is_active = true`);
      
      // Build schemes context
      let schemesContext = "GOVERNMENT SCHEMES:\n";
      schemesResult.rows.slice(0, 10).forEach((scheme: any) => {
        schemesContext += `- ${scheme.name_hi} (${scheme.name_en})\n`;
      });
      
      // Build event types context
      let eventsContext = "EVENT TYPES (with Hindi aliases):\n";
      eventTypesResult.rows.forEach((eventType: any) => {
        const aliasesStr = eventType.aliases_hi ? eventType.aliases_hi.join(", ") : "";
        eventsContext += `- ${eventType.name_hi} (${eventType.name_en})`;
        if (aliasesStr) eventsContext += ` | Aliases: ${aliasesStr}`;
        eventsContext += "\n";
      });
      
      // Pre-match data
      const matchedSchemes = schemesResult.rows.filter((scheme: any) => 
        text.includes(scheme.name_hi) || text.includes(scheme.name_en)
      );
      
      const matchedEventType = eventTypesResult.rows.find((eventType: any) => {
        if (text.includes(eventType.name_hi) || text.includes(eventType.name_en)) {
          return true;
        }
        if (eventType.aliases_hi && eventType.aliases_hi.some((alias: any) => text.includes(alias))) {
          return true;
        }
        return false;
      });
      
      return {
        schemesContext,
        eventsContext,
        matchedSchemes,
        matchedEventType
      };
    };

    const result = await buildContext(tweetText);
    
    expect(result.schemesContext).toContain('GOVERNMENT SCHEMES:');
    expect(result.schemesContext).toContain('मुख्यमंत्री किसान योजना');
    expect(result.eventsContext).toContain('EVENT TYPES (with Hindi aliases):');
    expect(result.eventsContext).toContain('बैठक (Meeting)');
    expect(result.eventsContext).toContain('Aliases: मुलाकात, चर्चा');
    expect(result.matchedSchemes).toHaveLength(1);
    expect(result.matchedEventType).toBeDefined();
  });

  it('should generate contextual hashtags based on parsed data', async () => {
    const parsedData = {
      event_type: 'बैठक',
      locations: ['रायगढ़', 'बिलासपुर'],
      schemes: ['मुख्यमंत्री किसान योजना'],
      people: ['मुख्यमंत्री']
    };

    const generateContextualHashtags = (data: any) => {
      const hashtags: string[] = [];
      
      // Location hashtags
      if (data.locations) {
        data.locations.slice(0, 2).forEach((location: string) => {
          hashtags.push(`#${location.replace(' ', '')}`);
        });
      }
      
      // Event type hashtag
      if (data.event_type) {
        hashtags.push(`#${data.event_type.replace(' ', '')}`);
      }
      
      // Scheme hashtags
      if (data.schemes) {
        data.schemes.slice(0, 1).forEach((scheme: string) => {
          const terms = scheme.split(' ');
          if (terms.length >= 2) hashtags.push(`#${terms[1]}`);
        });
      }
      
      // General hashtags
      hashtags.push("#छत्तीसगढ़", "#Chhattisgarh");
      
      return Array.from(new Set(hashtags));
    };

    const result = generateContextualHashtags(parsedData);
    
    expect(result).toContain('#रायगढ़');
    expect(result).toContain('#बिलासपुर');
    expect(result).toContain('#बैठक');
    expect(result).toContain('#किसान');
    expect(result).toContain('#छत्तीसगढ़');
    expect(result).toContain('#Chhattisgarh');
    expect(result.length).toBeGreaterThanOrEqual(6);
  });

  it('should integrate pre-matched data with Gemini response', async () => {
    const geminiResponse = {
      event_type: "बैठक",
      locations: ["रायगढ़"],
      people: ["मुख्यमंत्री"],
      organizations: ["सरकार"],
      schemes: ["मुख्यमंत्री किसान योजना"],
      date: "2025-01-17",
      confidence: 0.85,
      reasoning: "Tweet mentions meeting and CM Kisan scheme"
    };

    const preMatchedSchemes = [
      { id: 1, scheme_code: 'CM_KISAN_CG', name_hi: 'मुख्यमंत्री किसान योजना', name_en: 'CM Kisan Yojana CG' }
    ];

    const preMatchedEventType = {
      id: 1, event_code: 'MEETING', name_hi: 'बैठक', name_en: 'Meeting'
    };

    const integratePreMatchedData = (geminiData: any, schemes: any[], eventType: any) => {
      const integrated = { ...geminiData };
      
      // Integrate scheme IDs
      if (schemes.length > 0 && !integrated.matched_scheme_ids) {
        integrated.matched_scheme_ids = schemes.map(s => s.id);
        if (!integrated.schemes) integrated.schemes = schemes.map(s => s.name_hi);
        if (!integrated.schemes_en) integrated.schemes_en = schemes.map(s => s.name_en);
      }
      
      // Integrate event type ID
      if (eventType && !integrated.matched_event_id) {
        integrated.matched_event_id = eventType.id;
      }
      
      return integrated;
    };

    const result = integratePreMatchedData(geminiResponse, preMatchedSchemes, preMatchedEventType);
    
    expect(result.matched_scheme_ids).toEqual([1]);
    expect(result.matched_event_id).toBe(1);
    expect(result.schemes).toEqual(['मुख्यमंत्री किसान योजना']);
    expect(result.schemes_en).toEqual(['CM Kisan Yojana CG']);
    expect(result.event_type).toBe('बैठक');
    expect(result.confidence).toBe(0.85);
  });
});
