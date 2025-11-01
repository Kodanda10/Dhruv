import { Pool } from 'pg';
import { getDBPool } from '@/lib/db/pool';

interface HumanFeedback {
  tweetId: string;
  originalParsed: any;
  humanCorrection: any;
  reviewer: string;
}

interface LearningContext {
  tweetText: string;
  currentParsed: any;
}

interface LearningResult {
  success: boolean;
  learnedEntities: string[];
  error?: string;
}

interface SuggestionResult {
  eventTypes: Array<{ name_hi: string; name_en: string; usage_count: number }>;
  schemes: Array<{ name_hi: string; name_en: string; usage_count: number }>;
  locations: Array<{ value_hi: string; value_en: string; usage_count: number }>;
  hashtags: string[];
}

interface LearningInsights {
  totalLearnedEntities: number;
  eventTypesLearned: number;
  schemesLearned: number;
  hashtagsLearned: number;
  topLearnedEventTypes: Array<{ name_hi: string; usage_count: number }>;
}

export class DynamicLearningSystem {
  private pool: Pool;

  constructor(pool?: Pool) {
    // Use shared pool to prevent connection leaks
    this.pool = pool || getDBPool();
  }

  /**
   * Learn from human feedback and update reference datasets
   */
  async learnFromHumanFeedback(feedback: HumanFeedback): Promise<LearningResult> {
    try {
      const learnedEntities: string[] = [];

      // Learn event type if changed
      if (this.hasEventTypeChanged(feedback.originalParsed, feedback.humanCorrection)) {
        await this.learnEventType(feedback.humanCorrection, feedback.tweetId, feedback.reviewer);
        learnedEntities.push('event_type');
      }

      // Learn schemes if changed
      if (this.hasSchemesChanged(feedback.originalParsed, feedback.humanCorrection)) {
        await this.learnSchemes(feedback.humanCorrection, feedback.tweetId, feedback.reviewer);
        learnedEntities.push('scheme');
      }

      // Learn locations if changed
      if (this.hasLocationsChanged(feedback.originalParsed, feedback.humanCorrection)) {
        await this.learnLocations(feedback.humanCorrection, feedback.tweetId, feedback.reviewer);
        learnedEntities.push('location');
      }

      // Learn hashtags if changed
      if (this.hasHashtagsChanged(feedback.originalParsed, feedback.humanCorrection)) {
        await this.learnHashtags(feedback.humanCorrection, feedback.tweetId, feedback.reviewer);
        learnedEntities.push('hashtag');
      }

      return {
        success: true,
        learnedEntities
      };

    } catch (error) {
      console.error('Error learning from human feedback:', error);
      return {
        success: false,
        learnedEntities: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get intelligent suggestions based on learned patterns
   */
  async getIntelligentSuggestions(context: LearningContext): Promise<SuggestionResult> {
    try {
      const suggestions: SuggestionResult = {
        eventTypes: [],
        schemes: [],
        locations: [],
        hashtags: []
      };

      // Get event type suggestions based on tweet text and context
      const eventTypeSuggestions = await this.getEventTypeSuggestions(context);
      suggestions.eventTypes = eventTypeSuggestions;

      // Get scheme suggestions based on context
      const schemeSuggestions = await this.getSchemeSuggestions(context);
      suggestions.schemes = schemeSuggestions;

      // Get location suggestions
      const locationSuggestions = await this.getLocationSuggestions(context);
      suggestions.locations = locationSuggestions;

      // Get hashtag suggestions
      const hashtagSuggestions = await this.getHashtagSuggestions(context);
      suggestions.hashtags = hashtagSuggestions;

      return suggestions;

    } catch (error) {
      console.error('Error getting intelligent suggestions:', error);
      return {
        eventTypes: [],
        schemes: [],
        locations: [],
        hashtags: []
      };
    }
  }

  /**
   * Update reference datasets when entities are approved
   */
  async updateReferenceDatasets(approvedData: {
    entityType: string;
    entityId: number;
    tweetId: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { entityType, entityId, tweetId } = approvedData;

      switch (entityType) {
        case 'event_type':
          await this.pool.query(
            'UPDATE ref_event_types SET usage_count = usage_count + 1 WHERE id = $1',
            [entityId]
          );
          break;

        case 'scheme':
          await this.pool.query(
            'UPDATE ref_schemes SET usage_count = usage_count + 1 WHERE id = $1',
            [entityId]
          );
          break;

        case 'hashtag':
          await this.pool.query(
            'UPDATE ref_hashtags SET usage_count = usage_count + 1, last_used = NOW() WHERE id = $1',
            [entityId]
          );
          break;

        default:
          return {
            success: false,
            error: 'Invalid entity type'
          };
      }

      return { success: true };

    } catch (error) {
      console.error('Error updating reference datasets:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get learning insights and statistics
   */
  async getLearningInsights(): Promise<LearningInsights> {
    try {
      // Get total learned entities
      const totalResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM user_contributed_data WHERE approval_status = $1',
        ['approved']
      );
      const totalLearnedEntities = parseInt(totalResult.rows[0].count);

      // Get event types learned
      const eventTypesResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM user_contributed_data WHERE entity_type = $1 AND approval_status = $2',
        ['event_type', 'approved']
      );
      const eventTypesLearned = parseInt(eventTypesResult.rows[0].count);

      // Get schemes learned
      const schemesResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM user_contributed_data WHERE entity_type = $1 AND approval_status = $2',
        ['scheme', 'approved']
      );
      const schemesLearned = parseInt(schemesResult.rows[0].count);

      // Get hashtags learned
      const hashtagsResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM user_contributed_data WHERE entity_type = $1 AND approval_status = $2',
        ['hashtag', 'approved']
      );
      const hashtagsLearned = parseInt(hashtagsResult.rows[0].count);

      // Get top learned event types
      const topEventTypesResult = await this.pool.query(`
        SELECT value_hi as name_hi, usage_count 
        FROM user_contributed_data 
        WHERE entity_type = 'event_type' AND approval_status = 'approved'
        ORDER BY usage_count DESC 
        LIMIT 5
      `);

      return {
        totalLearnedEntities,
        eventTypesLearned,
        schemesLearned,
        hashtagsLearned,
        topLearnedEventTypes: topEventTypesResult.rows
      };

    } catch (error) {
      console.error('Error getting learning insights:', error);
      return {
        totalLearnedEntities: 0,
        eventTypesLearned: 0,
        schemesLearned: 0,
        hashtagsLearned: 0,
        topLearnedEventTypes: []
      };
    }
  }

  // Private helper methods

  private hasEventTypeChanged(original: any, correction: any): boolean {
    return original.event_type !== correction.event_type ||
           original.event_type_en !== correction.event_type_en;
  }

  private hasSchemesChanged(original: any, correction: any): boolean {
    const originalSchemes = original.schemes || [];
    const correctionSchemes = correction.schemes || [];
    
    if (originalSchemes.length !== correctionSchemes.length) return true;
    
    return !originalSchemes.every((scheme: string) => 
      correctionSchemes.includes(scheme)
    );
  }

  private hasLocationsChanged(original: any, correction: any): boolean {
    const originalLocations = original.locations || [];
    const correctionLocations = correction.locations || [];
    
    if (originalLocations.length !== correctionLocations.length) return true;
    
    return !originalLocations.every((location: string) => 
      correctionLocations.includes(location)
    );
  }

  private hasHashtagsChanged(original: any, correction: any): boolean {
    const originalHashtags = original.generated_hashtags || [];
    const correctionHashtags = correction.generated_hashtags || [];
    
    if (originalHashtags.length !== correctionHashtags.length) return true;
    
    return !originalHashtags.every((hashtag: string) => 
      correctionHashtags.includes(hashtag)
    );
  }

  private async learnEventType(correction: any, tweetId: string, reviewer: string): Promise<void> {
    const { event_type, event_type_en, event_code } = correction;

    if (!event_type || !event_type_en) return;

    // Check if event type already exists in reference table
    const existingResult = await this.pool.query(
      'SELECT id FROM ref_event_types WHERE name_hi = $1 OR name_en = $2',
      [event_type, event_type_en]
    );

    if (existingResult.rows.length === 0) {
      // Insert new event type
      await this.pool.query(`
        INSERT INTO ref_event_types (event_code, name_hi, name_en, category, usage_count, is_active)
        VALUES ($1, $2, $3, $4, 1, true)
      `, [event_code || 'CUSTOM', event_type, event_type_en, 'custom']);
    }

    // Record user contribution
    await this.pool.query(`
      INSERT INTO user_contributed_data (entity_type, value_hi, value_en, source_tweet_id, contributed_at, approved_by, approval_status, usage_count)
      VALUES ($1, $2, $3, $4, NOW(), $5, 'approved', 1)
    `, ['event_type', event_type, event_type_en, tweetId, reviewer]);
  }

  private async learnSchemes(correction: any, tweetId: string, reviewer: string): Promise<void> {
    const { schemes, schemes_en } = correction;

    if (!schemes || !schemes_en || schemes.length === 0) return;

    for (let i = 0; i < schemes.length; i++) {
      const schemeHi = schemes[i];
      const schemeEn = schemes_en[i];

      // Check if scheme already exists
      const existingResult = await this.pool.query(
        'SELECT id FROM ref_schemes WHERE name_hi = $1 OR name_en = $2',
        [schemeHi, schemeEn]
      );

      if (existingResult.rows.length === 0) {
        // Insert new scheme
        await this.pool.query(`
          INSERT INTO ref_schemes (scheme_code, name_hi, name_en, category, description_hi, description_en, usage_count, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, 1, true)
        `, [
          `CUSTOM_${Date.now()}`,
          schemeHi,
          schemeEn,
          'custom',
          'User contributed scheme',
          'User contributed scheme'
        ]);
      }

      // Record user contribution
      await this.pool.query(`
        INSERT INTO user_contributed_data (entity_type, value_hi, value_en, source_tweet_id, contributed_at, approved_by, approval_status, usage_count)
        VALUES ($1, $2, $3, $4, NOW(), $5, 'approved', 1)
      `, ['scheme', schemeHi, schemeEn, tweetId, reviewer]);
    }
  }

  private async learnLocations(correction: any, tweetId: string, reviewer: string): Promise<void> {
    const { locations } = correction;

    if (!locations || locations.length === 0) return;

    for (const location of locations) {
      // Record user contribution for location
      await this.pool.query(`
        INSERT INTO user_contributed_data (entity_type, value_hi, value_en, source_tweet_id, contributed_at, approved_by, approval_status, usage_count)
        VALUES ($1, $2, $3, $4, NOW(), $5, 'approved', 1)
      `, ['location', location, location, tweetId, reviewer]);
    }
  }

  private async learnHashtags(correction: any, tweetId: string, reviewer: string): Promise<void> {
    const { generated_hashtags } = correction;

    if (!generated_hashtags || generated_hashtags.length === 0) return;

    for (const hashtag of generated_hashtags) {
      // Check if hashtag already exists
      const existingResult = await this.pool.query(
        'SELECT id FROM ref_hashtags WHERE hashtag = $1',
        [hashtag]
      );

      if (existingResult.rows.length === 0) {
        // Insert new hashtag
        await this.pool.query(`
          INSERT INTO ref_hashtags (hashtag, category, usage_count, first_seen, last_used, is_active)
          VALUES ($1, $2, 1, NOW(), NOW(), true)
        `, [hashtag, 'custom']);
      }

      // Record user contribution
      await this.pool.query(`
        INSERT INTO user_contributed_data (entity_type, value_hi, value_en, source_tweet_id, contributed_at, approved_by, approval_status, usage_count)
        VALUES ($1, $2, $3, $4, NOW(), $5, 'approved', 1)
      `, ['hashtag', hashtag, hashtag, tweetId, reviewer]);
    }
  }

  private async getEventTypeSuggestions(context: LearningContext): Promise<Array<{ name_hi: string; name_en: string; usage_count: number }>> {
    const result = await this.pool.query(`
      SELECT name_hi, name_en, usage_count 
      FROM ref_event_types 
      WHERE is_active = true 
      ORDER BY usage_count DESC 
      LIMIT 5
    `);
    return result.rows;
  }

  private async getSchemeSuggestions(context: LearningContext): Promise<Array<{ name_hi: string; name_en: string; usage_count: number }>> {
    const result = await this.pool.query(`
      SELECT name_hi, name_en, usage_count 
      FROM ref_schemes 
      WHERE is_active = true 
      ORDER BY usage_count DESC 
      LIMIT 5
    `);
    return result.rows;
  }

  private async getLocationSuggestions(context: LearningContext): Promise<Array<{ value_hi: string; value_en: string; usage_count: number }>> {
    const result = await this.pool.query(`
      SELECT value_hi, value_en, usage_count 
      FROM user_contributed_data 
      WHERE entity_type = 'location' AND approval_status = 'approved'
      ORDER BY usage_count DESC 
      LIMIT 5
    `);
    return result.rows;
  }

  private async getHashtagSuggestions(context: LearningContext): Promise<string[]> {
    const result = await this.pool.query(`
      SELECT hashtag 
      FROM ref_hashtags 
      WHERE is_active = true 
      ORDER BY usage_count DESC 
      LIMIT 5
    `);
    return result.rows.map(row => row.hashtag);
  }

  /**
   * Learn from geo-hierarchy correction (Phase 3)
   * 
   * Persists geo-hierarchy corrections to the geo_corrections table
   * and optionally updates geo_aliases.json for alias mappings.
   * 
   * @param original - Original location name and hierarchy (if any)
   * @param corrected - Corrected geo-hierarchy
   * @param reviewer - Reviewer who made the correction
   * @param tweetId - Tweet ID associated with the correction
   * @returns LearningResult indicating success/failure
   */
  async learnGeoCorrection(
    original: { location: string; hierarchy: any | null },
    corrected: any, // GeoHierarchy
    reviewer: string,
    tweetId: string
  ): Promise<LearningResult> {
    try {
      // Check if correction differs from original
      const isDifferent = !original.hierarchy || 
        JSON.stringify(original.hierarchy) !== JSON.stringify(corrected);

      if (!isDifferent) {
        // No change, but still return success
        return {
          success: true,
          learnedEntities: []
        };
      }

      // Build correction reason with details
      let correctionReason = `Geo-hierarchy correction: ${original.location} → ${corrected.village || corrected.ulb || 'unknown'}`;
      
      // Check if this is an alias correction (original location → corrected canonical)
      if (original.location !== corrected.village && corrected.village) {
        correctionReason += ` | Alias correction: "${original.location}" maps to canonical "${corrected.village}"`;
      }

      // Check if this is a ULB/ward correction
      if (corrected.is_urban && corrected.ulb && corrected.ward_no) {
        correctionReason += ` | ULB/Ward correction: ${corrected.ulb} Ward ${corrected.ward_no}`;
      }

      // Persist correction to geo_corrections table
      const insertResult = await this.pool.query(`
        INSERT INTO geo_corrections (
          tweet_id,
          field_name,
          original_value,
          corrected_value,
          corrected_by,
          correction_reason
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [
        tweetId,
        'geo_hierarchy',
        JSON.stringify(original.hierarchy),
        JSON.stringify(corrected),
        reviewer,
        correctionReason
      ]);

      // Note: Additional alias/ULB processing could be done here using insertResult.rows[0].id
      // For now, all information is captured in correction_reason during INSERT

      return {
        success: true,
        learnedEntities: ['geo_hierarchy']
      };

    } catch (error) {
      console.error('Error learning geo correction:', error);
      return {
        success: false,
        learnedEntities: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
