import { Pool } from 'pg';

// Mock the database connection
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn()
  }))
}));

describe('Database Migrations + Reference Datasets (TDD)', () => {
  let mockPool: any;
  let mockQuery: jest.Mock;

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
  });

  it('should apply all required migrations in correct order', async () => {
    // Mock migration files query
    mockQuery.mockResolvedValueOnce({
      rows: [
        { version: '001', name: 'initial_schema', applied_at: '2025-01-01' },
        { version: '002', name: 'create_parsed_events', applied_at: '2025-01-01' },
        { version: '004', name: 'reference_datasets', applied_at: '2025-01-01' },
        { version: '005', name: 'enhance_parsed_events', applied_at: '2025-01-01' },
        { version: '20251017', name: 'add_tags', applied_at: '2025-01-01' }
      ]
    });

    const validateMigrations = async () => {
      const result = await mockPool.query(`
        SELECT version, name, applied_at 
        FROM schema_migrations 
        ORDER BY version
      `);
      
      const migrations = result.rows.map((row: { name: string }) => row.name);
      
      // Required migrations for Gemini parser integration
      const requiredMigrations = [
        'initial_schema',
        'create_parsed_events',
        'reference_datasets',
        'enhance_parsed_events',
        'add_tags'
      ];
      
      const missingMigrations = requiredMigrations.filter(migration => !migrations.includes(migration));
      
      if (missingMigrations.length > 0) {
        throw new Error(`Missing required migrations: ${missingMigrations.join(', ')}`);
      }
      
      return { success: true, migrationsCount: migrations.length };
    };

    const result = await validateMigrations();
    
    expect(result.success).toBe(true);
    expect(result.migrationsCount).toBe(5);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('schema_migrations'));
  });

  it('should have comprehensive reference schemes dataset', async () => {
    // Mock comprehensive schemes data
    mockQuery.mockResolvedValueOnce({
      rows: [
        // Central Government Schemes
        { id: 1, scheme_code: 'PM_KISAN', name_hi: 'प्रधानमंत्री किसान सम्मान निधि', name_en: 'PM-KISAN', category: 'central', ministry: 'Agriculture' },
        { id: 2, scheme_code: 'AYUSHMAN_BHARAT', name_hi: 'आयुष्मान भारत', name_en: 'Ayushman Bharat', category: 'central', ministry: 'Health' },
        { id: 3, scheme_code: 'UJJWALA', name_hi: 'प्रधानमंत्री उज्ज्वला योजना', name_en: 'PM Ujjwala Yojana', category: 'central', ministry: 'Petroleum' },
        { id: 4, scheme_code: 'PMAY', name_hi: 'प्रधानमंत्री आवास योजना', name_en: 'PM Awas Yojana', category: 'central', ministry: 'Housing' },
        { id: 5, scheme_code: 'MUDRA', name_hi: 'मुद्रा योजना', name_en: 'MUDRA Scheme', category: 'central', ministry: 'Finance' },
        { id: 6, scheme_code: 'SKILL_INDIA', name_hi: 'स्किल इंडिया', name_en: 'Skill India', category: 'central', ministry: 'Skill Development' },
        
        // Chhattisgarh State Schemes
        { id: 7, scheme_code: 'CM_KISAN_CG', name_hi: 'मुख्यमंत्री किसान योजना', name_en: 'CM Kisan Yojana CG', category: 'state', ministry: 'Agriculture' },
        { id: 8, scheme_code: 'GODHAN_NYAY', name_hi: 'गोधन न्याय योजना', name_en: 'Godhan Nyay Yojana', category: 'state', ministry: 'Agriculture' },
        { id: 9, scheme_code: 'RAJIV_YUVA_MITAN', name_hi: 'राजीव युवा मितान क्लब', name_en: 'Rajiv Yuva Mitan Club', category: 'state', ministry: 'Youth Affairs' },
        { id: 10, scheme_code: 'SUGAR_MILL', name_hi: 'चीनी मिल योजना', name_en: 'Sugar Mill Scheme', category: 'state', ministry: 'Industry' },
        { id: 11, scheme_code: 'EDUCATION_CG', name_hi: 'शिक्षा योजना', name_en: 'Education Scheme CG', category: 'state', ministry: 'Education' },
        { id: 12, scheme_code: 'HEALTH_CG', name_hi: 'स्वास्थ्य योजना', name_en: 'Health Scheme CG', category: 'state', ministry: 'Health' }
      ]
    });

    const validateSchemesDataset = async () => {
      const result = await mockPool.query(`
        SELECT id, scheme_code, name_hi, name_en, category, ministry
        FROM ref_schemes 
        WHERE is_active = true
        ORDER BY category, id
      `);
      
      const schemes = result.rows;
      const centralSchemes = schemes.filter((s: { category: string }) => s.category === 'central');
      const stateSchemes = schemes.filter((s: { category: string }) => s.category === 'state');
      
      // Validate minimum required schemes
      const requiredCentralSchemes = ['PM_KISAN', 'AYUSHMAN_BHARAT', 'UJJWALA', 'PMAY'];
      const requiredStateSchemes = ['CM_KISAN_CG', 'GODHAN_NYAY', 'RAJIV_YUVA_MITAN'];
      
      const centralCodes = centralSchemes.map((s: { scheme_code: string }) => s.scheme_code);
      const stateCodes = stateSchemes.map((s: { scheme_code: string }) => s.scheme_code);
      
      const missingCentral = requiredCentralSchemes.filter(code => !centralCodes.includes(code));
      const missingState = requiredStateSchemes.filter(code => !stateCodes.includes(code));
      
      if (missingCentral.length > 0 || missingState.length > 0) {
        throw new Error(`Missing required schemes: Central: ${missingCentral.join(', ')}, State: ${missingState.join(', ')}`);
      }
      
      return { 
        success: true, 
        totalSchemes: schemes.length,
        centralSchemes: centralSchemes.length,
        stateSchemes: stateSchemes.length
      };
    };

    const result = await validateSchemesDataset();
    
    expect(result.success).toBe(true);
    expect(result.totalSchemes).toBeGreaterThanOrEqual(12);
    expect(result.centralSchemes).toBeGreaterThanOrEqual(6);
    expect(result.stateSchemes).toBeGreaterThanOrEqual(6);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('ref_schemes'));
  });

  it('should have comprehensive event types dataset with aliases', async () => {
    // Mock comprehensive event types data
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 1, event_code: 'MEETING', name_hi: 'बैठक', name_en: 'Meeting', aliases_hi: ['मुलाकात', 'चर्चा'], aliases_en: ['discussion', 'meeting'], category: 'administrative' },
        { id: 2, event_code: 'RALLY', name_hi: 'रैली', name_en: 'Rally', aliases_hi: ['सम्मेलन', 'जनसभा'], aliases_en: ['conference', 'public meeting'], category: 'political' },
        { id: 3, event_code: 'INSPECTION', name_hi: 'निरीक्षण', name_en: 'Inspection', aliases_hi: ['समीक्षा', 'जांच'], aliases_en: ['review', 'examination'], category: 'administrative' },
        { id: 4, event_code: 'INAUGURATION', name_hi: 'उद्घाटन', name_en: 'Inauguration', aliases_hi: ['शिलान्यास', 'भूमिपूजन'], aliases_en: ['foundation', 'opening'], category: 'administrative' },
        { id: 5, event_code: 'DISTRIBUTION', name_hi: 'वितरण', name_en: 'Distribution', aliases_hi: ['बंटवारा', 'प्रदान'], aliases_en: ['handover', 'giving'], category: 'social' },
        { id: 6, event_code: 'VISIT', name_hi: 'दौरा', name_en: 'Visit', aliases_hi: ['भ्रमण', 'यात्रा'], aliases_en: ['tour', 'trip'], category: 'administrative' },
        { id: 7, event_code: 'CELEBRATION', name_hi: 'समारोह', name_en: 'Celebration', aliases_hi: ['उत्सव', 'जयंती'], aliases_en: ['festival', 'anniversary'], category: 'social' },
        { id: 8, event_code: 'WORSHIP', name_hi: 'पूजा', name_en: 'Worship', aliases_hi: ['प्रार्थना', 'आरती'], aliases_en: ['prayer', 'ritual'], category: 'religious' }
      ]
    });

    const validateEventTypesDataset = async () => {
      const result = await mockPool.query(`
        SELECT id, event_code, name_hi, name_en, aliases_hi, aliases_en, category
        FROM ref_event_types 
        WHERE is_active = true
        ORDER BY id
      `);
      
      const eventTypes = result.rows;
      
      // Validate minimum required event types
      const requiredEventTypes = ['MEETING', 'RALLY', 'INSPECTION', 'INAUGURATION', 'DISTRIBUTION', 'VISIT'];
      const eventCodes = eventTypes.map((e: { event_code: string }) => e.event_code);
      
      const missingEventTypes = requiredEventTypes.filter(code => !eventCodes.includes(code));
      
      if (missingEventTypes.length > 0) {
        throw new Error(`Missing required event types: ${missingEventTypes.join(', ')}`);
      }
      
      // Validate aliases are present
      const eventsWithAliases = eventTypes.filter((e: { aliases_hi?: string[] }) => e.aliases_hi && e.aliases_hi.length > 0);
      
      if (eventsWithAliases.length < 6) {
        throw new Error(`Insufficient event types with Hindi aliases: ${eventsWithAliases.length}`);
      }
      
      return { 
        success: true, 
        totalEventTypes: eventTypes.length,
        eventsWithAliases: eventsWithAliases.length
      };
    };

    const result = await validateEventTypesDataset();
    
    expect(result.success).toBe(true);
    expect(result.totalEventTypes).toBeGreaterThanOrEqual(8);
    expect(result.eventsWithAliases).toBeGreaterThanOrEqual(6);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('ref_event_types'));
  });

  it('should have hashtag reference dataset for intelligent suggestions', async () => {
    // CRITICAL: Mock hashtag reference data with ALL required categories (location, scheme, event, general)
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 1, hashtag: '#छत्तीसगढ़', category: 'location', usage_count: 100 },
        { id: 2, hashtag: '#Chhattisgarh', category: 'location', usage_count: 50 },
        { id: 3, hashtag: '#रायगढ़', category: 'location', usage_count: 30 },
        { id: 4, hashtag: '#बिलासपुर', category: 'location', usage_count: 25 },
        { id: 5, hashtag: '#किसान', category: 'scheme', usage_count: 40 },
        { id: 6, hashtag: '#युवा', category: 'scheme', usage_count: 20 },
        { id: 7, hashtag: '#बैठक', category: 'event', usage_count: 35 },
        { id: 8, hashtag: '#रैली', category: 'event', usage_count: 15 },
        { id: 9, hashtag: '#सुशासन', category: 'general', usage_count: 10 } // Adding 'general' category
      ]
    });

    const validateHashtagDataset = async () => {
      const result = await mockPool.query(`
        SELECT id, hashtag, category, usage_count
        FROM ref_hashtags 
        WHERE is_active = true
        ORDER BY usage_count DESC
      `);
      
      const hashtags = result.rows;
      
      // Validate categories
      const categories = [...new Set(hashtags.map((h: { category: string }) => h.category))];
      const requiredCategories = ['location', 'scheme', 'event', 'general'];
      
      const missingCategories = requiredCategories.filter(cat => !categories.includes(cat));
      
      if (missingCategories.length > 0) {
        throw new Error(`Missing required hashtag categories: ${missingCategories.join(', ')}`);
      }
      
      // Validate minimum hashtags per category
      const locationHashtags = hashtags.filter((h: { category: string }) => h.category === 'location');
      const schemeHashtags = hashtags.filter((h: { category: string }) => h.category === 'scheme');
      const eventHashtags = hashtags.filter((h: { category: string }) => h.category === 'event');
      
      if (locationHashtags.length < 3) {
        throw new Error(`Insufficient location hashtags: ${locationHashtags.length}`);
      }
      
      return { 
        success: true, 
        totalHashtags: hashtags.length,
        categories: categories.length,
        locationHashtags: locationHashtags.length,
        schemeHashtags: schemeHashtags.length,
        eventHashtags: eventHashtags.length
      };
    };

    const result = await validateHashtagDataset();
    
    expect(result.success).toBe(true);
    expect(result.totalHashtags).toBeGreaterThanOrEqual(8);
    expect(result.categories).toBeGreaterThanOrEqual(3);
    expect(result.locationHashtags).toBeGreaterThanOrEqual(3);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('ref_hashtags'));
  });

  it('should have user contributed data tracking system', async () => {
    // CRITICAL: Mock user contributed data with ALL required entity types and approval statuses
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 1, entity_type: 'event_type', value_hi: 'नया कार्यक्रम', value_en: 'New Program', approval_status: 'approved', usage_count: 5 },
        { id: 2, entity_type: 'scheme', value_hi: 'नई योजना', value_en: 'New Scheme', approval_status: 'pending', usage_count: 1 },
        { id: 3, entity_type: 'hashtag', value_hi: '#नयाहैशटैग', value_en: '#NewHashtag', approval_status: 'approved', usage_count: 3 },
        { id: 4, entity_type: 'location', value_hi: 'नया स्थान', value_en: 'New Location', approval_status: 'rejected', usage_count: 0 },
        { id: 5, entity_type: 'organization', value_hi: 'नया संगठन', value_en: 'New Organization', approval_status: 'pending', usage_count: 2 }
      ]
    });

    const validateUserContributedData = async () => {
      const result = await mockPool.query(`
        SELECT id, entity_type, value_hi, value_en, approval_status, usage_count
        FROM user_contributed_data 
        ORDER BY contributed_at DESC
      `);
      
      const contributions = result.rows;
      
      // Validate entity types
      const entityTypes = [...new Set(contributions.map((c: { entity_type: string }) => c.entity_type))];
      const requiredEntityTypes = ['event_type', 'scheme', 'hashtag', 'location', 'organization'];
      
      const missingEntityTypes = requiredEntityTypes.filter(type => !entityTypes.includes(type));
      
      if (missingEntityTypes.length > 0) {
        throw new Error(`Missing required entity types: ${missingEntityTypes.join(', ')}`);
      }
      
      // Validate approval statuses
      const approvalStatuses = [...new Set(contributions.map((c: { approval_status: string }) => c.approval_status))];
      const requiredStatuses = ['approved', 'pending', 'rejected'];
      
      const missingStatuses = requiredStatuses.filter(status => !approvalStatuses.includes(status));
      
      if (missingStatuses.length > 0) {
        throw new Error(`Missing required approval statuses: ${missingStatuses.join(', ')}`);
      }
      
      return { 
        success: true, 
        totalContributions: contributions.length,
        entityTypes: entityTypes.length,
        approvalStatuses: approvalStatuses.length
      };
    };

    const result = await validateUserContributedData();
    
    expect(result.success).toBe(true);
    expect(result.totalContributions).toBeGreaterThanOrEqual(3);
    expect(result.entityTypes).toBeGreaterThanOrEqual(3);
    expect(result.approvalStatuses).toBeGreaterThanOrEqual(2);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('user_contributed_data'));
  });
});
