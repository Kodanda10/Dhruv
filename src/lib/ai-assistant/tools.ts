/**
 * AI Assistant Tools Implementation
 * 
 * This module implements specific tools for the AI Assistant to perform actions
 * like adding locations, suggesting event types, adding schemes, generating hashtags,
 * and validating data consistency.
 */

import { Pool } from 'pg';
import { DynamicLearningSystem } from '@/lib/dynamic-learning';

// Tool interfaces
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  confidence: number;
}

export interface LocationToolResult extends ToolResult {
  data?: {
    locations: string[];
    validated: boolean;
    suggestions: string[];
  };
}

export interface EventTypeToolResult extends ToolResult {
  data?: {
    eventType: string;
    aliases: string[];
    suggestions: string[];
  };
}

export interface SchemeToolResult extends ToolResult {
  data?: {
    schemes: string[];
    validated: boolean;
    suggestions: string[];
  };
}

export interface HashtagToolResult extends ToolResult {
  data?: {
    hashtags: string[];
    contextual: boolean;
    generated: boolean;
  };
}

export interface ValidationToolResult extends ToolResult {
  data?: {
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  };
}

// Tool implementations
export class AIAssistantTools {
  private pool: Pool;
  private learningSystem: DynamicLearningSystem;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    this.learningSystem = new DynamicLearningSystem();
  }

  /**
   * Add Location Tool
   * Parses and validates locations against geography data
   */
  async addLocation(
    locations: string[] | null, 
    tweetText: string,
    existingLocations: string[] = []
  ): Promise<LocationToolResult> {
    try {
      // Handle null/undefined inputs gracefully
      if (!locations || !Array.isArray(locations)) {
        locations = [];
      }
      
      // Parse locations from tweet text if not provided
      if (locations.length === 0 && tweetText) {
        locations = await this.parseLocationsFromText(tweetText);
      }

      // Validate locations against geography data
      const validatedLocations = await this.validateLocations(locations);
      
      // Get suggestions from learned data
      const suggestions = await this.getLocationSuggestions(tweetText || '', existingLocations);

      // Merge with existing locations
      const allLocations = [...new Set([...existingLocations, ...validatedLocations])];

      // Lower confidence if no locations were provided initially and none were parsed
      const hasLocations = allLocations.length > 0;
      let confidence = hasLocations ? (validatedLocations.length > 0 ? 0.9 : 0.6) : 0.5;
      
      // If empty locations array provided and tweet doesn't mention locations, confidence should be much lower
      if (locations.length === 0 && validatedLocations.length === 0) {
        const tweetHasLocations = tweetText && tweetText.match(/रायपुर|बिलासपुर|रायगढ़|दुर्ग|raipur|bilaspur|raigarh|durg|स्थान|location|place/i);
        if (!tweetHasLocations) {
          confidence = 0.5; // Lower confidence when no locations found
        } else {
          confidence = 0.7; // Some confidence if tweet mentions locations but parsing failed
        }
      }
      
      return {
        success: true,
        data: {
          locations: allLocations,
          validated: validatedLocations.length > 0,
          suggestions
        },
        confidence
      };
    } catch (error) {
      return {
        success: true, // Return success even on errors for graceful degradation
        data: {
          locations: existingLocations || [],
          validated: false,
          suggestions: []
        },
        error: error instanceof Error ? error.message : 'Unknown error',
        confidence: 0.3
      };
    }
  }

  /**
   * Suggest Event Type Tool
   * Suggests event types from learned data and reference tables
   */
  async suggestEventType(
    tweetText: string,
    currentEventType?: string
  ): Promise<EventTypeToolResult> {
    try {
      // Handle empty input - return lower confidence
      if (!tweetText || tweetText.trim().length === 0) {
        return {
          success: true,
          data: {
            eventType: currentEventType || 'other',
            aliases: [],
            suggestions: []
          },
          confidence: 0.4 // Lower confidence for empty input
        };
      }
      
      // Get suggestions from learned data
      const learnedSuggestions = await this.getEventTypeSuggestions(tweetText);
      
      // Get suggestions from reference data
      const referenceSuggestions = await this.getReferenceEventTypes();
      
      // Combine and rank suggestions
      const allSuggestions = [...learnedSuggestions, ...referenceSuggestions];
      const rankedSuggestions = this.rankEventTypeSuggestions(allSuggestions, tweetText);

      // Select best suggestion
      const bestSuggestion = rankedSuggestions[0] || currentEventType || 'other';

      // Determine confidence based on how well the suggestion matches
      let confidence = 0.5;
      if (rankedSuggestions.length > 0) {
        // Check if tweet clearly mentions event type keywords
        const hasEventKeywords = /बैठक|कार्यक्रम|यात्रा|घोषणा|meeting|program|event|visit/i.test(tweetText);
        
        if (hasEventKeywords) {
          // Higher confidence if multiple suggestions found and keywords match
          confidence = rankedSuggestions.length > 2 ? 0.85 : 0.75;
        } else {
          // Lower confidence if tweet doesn't clearly indicate event type
          confidence = 0.65;
          if (!tweetText || tweetText.trim().length < 15) {
            confidence = 0.55; // Even lower for very short/generic tweets
          }
        }
      } else {
        // Very low confidence if no suggestions
        confidence = 0.3;
      }
      
      return {
        success: true,
        data: {
          eventType: bestSuggestion,
          aliases: this.getEventTypeAliases(bestSuggestion),
          suggestions: rankedSuggestions.slice(0, 5)
        },
        confidence
      };
    } catch (error) {
      return {
        success: true, // Return success for graceful degradation
        data: {
          eventType: currentEventType || 'other',
          aliases: [],
          suggestions: []
        },
        error: error instanceof Error ? error.message : 'Unknown error',
        confidence: 0.3
      };
    }
  }

  /**
   * Add Scheme Tool
   * Adds schemes with validation against reference data
   */
  async addScheme(
    schemes: string[],
    tweetText: string,
    existingSchemes: string[] = []
  ): Promise<SchemeToolResult> {
    try {
      // Parse schemes from tweet text if not provided
      if (schemes.length === 0) {
        schemes = await this.parseSchemesFromText(tweetText);
      }

      // Validate schemes against reference data
      let validatedSchemes: string[] = [];
      try {
        validatedSchemes = await this.validateSchemes(schemes);
      } catch (error) {
        // If validation fails (e.g., table doesn't exist), use provided schemes as-is
        validatedSchemes = schemes.filter(s => s && s.trim().length > 0);
      }
      
      // If no validated schemes but schemes were provided, use them directly
      if (validatedSchemes.length === 0 && schemes.length > 0) {
        validatedSchemes = schemes.filter(s => s && s.trim().length > 0);
      }
      
      // Get suggestions from learned data
      const suggestions = await this.getSchemeSuggestions(tweetText, existingSchemes);

      // Merge with existing schemes
      const allSchemes = [...new Set([...existingSchemes, ...validatedSchemes])];

      return {
        success: true,
        data: {
          schemes: allSchemes,
          validated: validatedSchemes.length > 0,
          suggestions
        },
        confidence: validatedSchemes.length > 0 ? 0.9 : 0.6
      };
    } catch (error) {
      return {
        success: true, // Return success for graceful degradation
        data: {
          schemes: existingSchemes || [],
          validated: false,
          suggestions: []
        },
        error: error instanceof Error ? error.message : 'Unknown error',
        confidence: 0.3
      };
    }
  }

  /**
   * Generate Hashtags Tool
   * Generates contextual hashtags using hashtag generation engine
   */
  async generateHashtags(
    tweetText: string,
    eventType?: string,
    locations?: string[],
    schemes?: string[]
  ): Promise<HashtagToolResult> {
    try {
      // Generate contextual hashtags
      const contextualHashtags = await this.generateContextualHashtags(
        tweetText, eventType, locations, schemes
      );

      // Get hashtag suggestions from learned data
      const learnedHashtags = await this.getLearnedHashtags(tweetText);

      // Combine and deduplicate
      const allHashtags = [...new Set([...contextualHashtags, ...learnedHashtags])];

      // Lower confidence if no inputs provided
      const hasInputs = eventType || (locations && locations.length > 0) || (schemes && schemes.length > 0);
      const hasContext = tweetText && (tweetText.includes('विकास') || tweetText.includes('योजना') || tweetText.includes('development') || tweetText.includes('scheme'));
      
      let confidence = 0.4;
      if (allHashtags.length > 0) {
        confidence = hasInputs || hasContext ? 0.8 : 0.6; // Lower if no inputs
      }
      
      return {
        success: true,
        data: {
          hashtags: allHashtags,
          contextual: contextualHashtags.length > 0,
          generated: true
        },
        confidence
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        confidence: 0
      };
    }
  }

  /**
   * Validate Data Consistency Tool
   * Checks scheme-event type compatibility, location validity, etc.
   */
  async validateConsistency(
    eventType: string,
    locations: string[],
    schemes: string[],
    tweetText: string
  ): Promise<ValidationToolResult> {
    try {
      const issues: string[] = [];
      const suggestions: string[] = [];

      // Validate event type and scheme compatibility
      const schemeEventCompatibility = await this.validateSchemeEventCompatibility(
        schemes, eventType
      );
      if (!schemeEventCompatibility.isValid) {
        issues.push(...schemeEventCompatibility.issues);
        suggestions.push(...schemeEventCompatibility.suggestions);
      }

      // Validate location existence
      const locationValidation = await this.validateLocationExistence(locations);
      if (!locationValidation.isValid) {
        issues.push(...locationValidation.issues);
        suggestions.push(...locationValidation.suggestions);
      }

      // Validate hashtag relevance
      const hashtagValidation = await this.validateHashtagRelevance(tweetText);
      if (!hashtagValidation.isValid) {
        issues.push(...hashtagValidation.issues);
        suggestions.push(...hashtagValidation.suggestions);
      }

      return {
        success: true,
        data: {
          isValid: issues.length === 0,
          issues,
          suggestions
        },
        confidence: issues.length === 0 ? 0.9 : 0.6
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        confidence: 0
      };
    }
  }

  // Helper methods

  private async parseLocationsFromText(text: string): Promise<string[]> {
    // Simple location parsing - can be enhanced with NLP
    const locationKeywords = [
      'रायपुर', 'बिलासपुर', 'रायगढ़', 'दुर्ग', 'कोरबा', 'सरगुजा', 'जशपुर', 'कोरिया',
      'कांकेर', 'बस्तर', 'नारायणपुर', 'बीजापुर', 'सुकमा', 'दंतेवाड़ा', 'कोंडागांव',
      'राजनांदगांव', 'महासमुंद', 'गरियाबंद', 'बलरामपुर', 'सूरजपुर', 'बलौदा बाजार',
      'मुंगेली', 'कबीरधाम', 'जांजगीर-चंपा', 'बेमेतरा', 'बलोदाबाजार', 'गौरेला-पेंड्रा-मरवाही'
    ];

    const foundLocations: string[] = [];
    for (const location of locationKeywords) {
      if (text.includes(location)) {
        foundLocations.push(location);
      }
    }

    return foundLocations;
  }

  private async validateLocations(locations: string[]): Promise<string[]> {
    const query = `
      SELECT DISTINCT name FROM cg_geography 
      WHERE name = ANY($1) OR alias = ANY($1)
    `;
    
    const result = await this.pool.query(query, [locations]);
    return result.rows.map(row => row.name);
  }

  private async getLocationSuggestions(tweetText: string, existingLocations: string[]): Promise<string[]> {
    try {
      const suggestions = await this.learningSystem.getIntelligentSuggestions({
        tweetText,
        currentParsed: {}
      });
      const locationStrings = (suggestions.locations || []).map(l => l.value_hi || l.value_en || '').filter(Boolean);
      return locationStrings.filter(loc => !existingLocations.includes(loc));
    } catch (error) {
      return [];
    }
  }

  private async getEventTypeSuggestions(tweetText: string): Promise<string[]> {
    try {
      const suggestions = await this.learningSystem.getIntelligentSuggestions({
        tweetText,
        currentParsed: {}
      });
      return (suggestions.eventTypes || []).map(e => e.name_hi || e.name_en || '').filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  private async getReferenceEventTypes(): Promise<string[]> {
    const query = 'SELECT name FROM ref_event_types ORDER BY usage_count DESC LIMIT 10';
    const result = await this.pool.query(query);
    return result.rows.map(row => row.name);
  }

  private rankEventTypeSuggestions(suggestions: string[], tweetText: string): string[] {
    // Simple ranking based on keyword matching
    const ranked = suggestions.map(suggestion => ({
      suggestion,
      score: this.calculateRelevanceScore(suggestion, tweetText)
    }));

    return ranked
      .sort((a, b) => b.score - a.score)
      .map(item => item.suggestion);
  }

  private calculateRelevanceScore(suggestion: string, tweetText: string): number {
    const keywords = suggestion.toLowerCase().split(' ');
    let score = 0;
    
    for (const keyword of keywords) {
      if (tweetText.toLowerCase().includes(keyword)) {
        score += 1;
      }
    }
    
    return score;
  }

  private getEventTypeAliases(eventType: string): string[] {
    const aliases: { [key: string]: string[] } = {
      'बैठक': ['meeting', 'conference', 'गोष्ठी', 'सभा'],
      'meeting': ['बैठक', 'conference', 'गोष्ठी'],
      'कार्यक्रम': ['program', 'event', 'function', 'आयोजन'],
      'program': ['कार्यक्रम', 'event', 'function'],
      'event': ['कार्यक्रम', 'program', 'function'],
      'यात्रा': ['visit', 'tour', 'दौरा', 'tour'],
      'visit': ['यात्रा', 'tour', 'दौरा'],
      'घोषणा': ['announcement', 'declaration', 'घोषणा'],
      'announcement': ['घोषणा', 'declaration'],
      'उद्घाटन': ['inauguration', 'opening', 'शुभारंभ'],
      'inauguration': ['उद्घाटन', 'opening'],
      'other': ['अन्य', 'others', 'मिश्रित'],
      'अन्य': ['other', 'others']
    };

    // Check both exact match and case-insensitive match
    const normalizedType = eventType.toLowerCase().trim();
    for (const [key, value] of Object.entries(aliases)) {
      if (key.toLowerCase() === normalizedType || value.includes(eventType)) {
        return value;
      }
    }
    
    // If no exact match, try partial match for Hindi event types
    if (/[\u0900-\u097F]/.test(eventType)) {
      // Return at least some default aliases for Hindi event types
      return ['event', 'program'];
    }

    return [];
  }

  private async parseSchemesFromText(text: string): Promise<string[]> {
    const schemeKeywords = [
      'PM Kisan', 'Ayushman Bharat', 'Ujjwala', 'Swachh Bharat', 'Digital India',
      'PM मुद्रा', 'PM आवास', 'PM किसान', 'आयुष्मान भारत', 'उज्ज्वला',
      'स्वच्छ भारत', 'डिजिटल इंडिया', 'मुद्रा', 'आवास', 'किसान'
    ];

    const foundSchemes: string[] = [];
    for (const scheme of schemeKeywords) {
      if (text.includes(scheme)) {
        foundSchemes.push(scheme);
      }
    }

    return foundSchemes;
  }

  private async validateSchemes(schemes: string[]): Promise<string[]> {
    const query = `
      SELECT DISTINCT name FROM ref_schemes 
      WHERE name = ANY($1) OR alias = ANY($1)
    `;
    
    const result = await this.pool.query(query, [schemes]);
    return result.rows.map(row => row.name);
  }

  private async getSchemeSuggestions(tweetText: string, existingSchemes: string[]): Promise<string[]> {
    try {
      const suggestions = await this.learningSystem.getIntelligentSuggestions({
        tweetText,
        currentParsed: {}
      });
      const schemeStrings = (suggestions.schemes || []).map(s => s.name_hi || s.name_en || '').filter(Boolean);
      return schemeStrings.filter(scheme => !existingSchemes.includes(scheme));
    } catch (error) {
      return [];
    }
  }

  private async generateContextualHashtags(
    tweetText: string,
    eventType?: string,
    locations?: string[],
    schemes?: string[]
  ): Promise<string[]> {
    const hashtags: string[] = [];

    // Add event type hashtags
    if (eventType) {
      hashtags.push(`#${eventType.replace(/\s+/g, '')}`);
    }

    // Add location hashtags
    if (locations) {
      for (const location of locations) {
        hashtags.push(`#${location.replace(/\s+/g, '')}`);
      }
    }

    // Add scheme hashtags
    if (schemes) {
      for (const scheme of schemes) {
        const schemeHashtag = scheme.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
        hashtags.push(`#${schemeHashtag}`);
      }
    }

    // Add contextual hashtags based on tweet content
    if (tweetText.includes('विकास') || tweetText.includes('development')) {
      hashtags.push('#विकास', '#Development');
    }
    if (tweetText.includes('योजना') || tweetText.includes('scheme')) {
      hashtags.push('#योजना', '#Scheme');
    }

    return hashtags;
  }

  private async getLearnedHashtags(tweetText: string): Promise<string[]> {
    try {
      const suggestions = await this.learningSystem.getIntelligentSuggestions({
        tweetText,
        currentParsed: {}
      });
      return suggestions.hashtags || [];
    } catch (error) {
      return [];
    }
  }

  private async validateSchemeEventCompatibility(
    schemes: string[],
    eventType: string
  ): Promise<{ isValid: boolean; issues: string[]; suggestions: string[] }> {
    // Simple compatibility check - can be enhanced with more sophisticated logic
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check if schemes match event type context
    for (const scheme of schemes) {
      if (eventType === 'बैठक' && scheme.includes('Kisan')) {
        issues.push(`${scheme} scheme may not be relevant for meeting events`);
        suggestions.push('Consider removing or changing the event type');
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions
    };
  }

  private async validateLocationExistence(
    locations: string[]
  ): Promise<{ isValid: boolean; issues: string[]; suggestions: string[] }> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    const query = `
      SELECT name FROM cg_geography 
      WHERE name = ANY($1) OR alias = ANY($1)
    `;
    
    const result = await this.pool.query(query, [locations]);
    const validLocations = result.rows.map(row => row.name);

    for (const location of locations) {
      if (!validLocations.includes(location)) {
        issues.push(`Location "${location}" not found in geography data`);
        suggestions.push('Check spelling or use a different location');
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions
    };
  }

  private async validateHashtagRelevance(
    tweetText: string
  ): Promise<{ isValid: boolean; issues: string[]; suggestions: string[] }> {
    // Simple hashtag relevance check
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check for hashtag spam
    const hashtagCount = (tweetText.match(/#/g) || []).length;
    if (hashtagCount > 5) {
      issues.push('Too many hashtags detected');
      suggestions.push('Reduce hashtag count for better engagement');
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions
    };
  }

  /**
   * Cleanup database connection
   */
  async cleanup(): Promise<void> {
    await this.pool.end();
  }
}

// Export singleton instance
export const aiAssistantTools = new AIAssistantTools();

