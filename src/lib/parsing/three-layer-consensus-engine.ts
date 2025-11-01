/**
 * Three-Layer Parsing Consensus Engine
 * 
 * Implements a robust parsing system using:
 * 1. Gemini API (Primary)
 * 2. Ollama Local Model (Secondary) 
 * 3. Custom Parsing Engine (Fallback)
 * 
 * Uses 2/3 voting consensus algorithm with confidence scoring
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GeoHierarchyResolver } from '@/lib/geo-extraction/hierarchy-resolver';

// Types for parsing results
export interface ParsingResult {
  locations: string[];
  event_type: string | null;
  schemes_mentioned: string[];
  hashtags: string[];
  people_mentioned: string[];
  geo_hierarchy: any[];
  confidence: number;
  parser_source: 'gemini' | 'ollama' | 'custom';
  raw_response?: any;
}

export interface ConsensusResult {
  final_result: ParsingResult;
  layer_results: {
    gemini: ParsingResult | null;
    ollama: ParsingResult | null;
    custom: ParsingResult | null;
  };
  consensus_score: number;
  agreement_level: 'high' | 'medium' | 'low';
  conflicts: string[];
  geo_hierarchy_resolved: boolean;
  geo_hierarchy?: any[];
  gram_panchayats?: string[];
  ulb_wards?: Array<{ulb: string, ward_no: number}>;
  blocks?: string[];
  assemblies?: string[];
  districts?: string[];
}

export interface TweetData {
  tweet_id: string;
  tweet_text: string;
  created_at: string;
  author_handle: string;
}

export class ThreeLayerConsensusEngine {
  private gemini: GoogleGenerativeAI | null = null;
  private geoResolver: GeoHierarchyResolver | null = null;
  private ollamaBaseUrl: string;

  constructor() {
    this.ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  }

  async initialize(): Promise<void> {
    // Initialize Gemini
    if (process.env.GOOGLE_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    }

    // Initialize Geo Resolver
    this.geoResolver = new GeoHierarchyResolver();
    await this.geoResolver.initialize();
  }

  async cleanup(): Promise<void> {
    if (this.geoResolver) {
      await this.geoResolver.cleanup();
    }
  }

  /**
   * Main parsing method - orchestrates all three layers
   */
  async parseTweet(tweet: TweetData): Promise<ConsensusResult> {
    const layerResults = {
      gemini: null as ParsingResult | null,
      ollama: null as ParsingResult | null,
      custom: null as ParsingResult | null,
    };

    const errors: string[] = [];

    // Layer 1: Gemini API
    try {
      layerResults.gemini = await this.parseWithGemini(tweet);
    } catch (error) {
      errors.push(`Gemini failed: ${error}`);
    }

    // Layer 2: Ollama Local Model
    try {
      layerResults.ollama = await this.parseWithOllama(tweet);
    } catch (error) {
      errors.push(`Ollama failed: ${error}`);
    }

    // Layer 3: Custom Parsing Engine
    try {
      layerResults.custom = await this.parseWithCustomEngine(tweet);
    } catch (error) {
      errors.push(`Custom engine failed: ${error}`);
    }

    // Apply consensus algorithm (synchronous)
    const consensusResult = this.applyConsensusAlgorithm(layerResults, tweet);

    // Resolve geo-hierarchy deterministically after consensus (Phase 1: Strict Mode)
    try {
      if (consensusResult.final_result.locations.length > 0) {
        const resolver = await this.ensureGeoResolver();
        if (resolver) {
          const allHierarchies: any[] = [];
          const allCandidates: any[] = [];
          let needsReview = false;
          const explanations: string[] = [];

          // Extract disambiguation hints from tweet text and other locations
          const districtsSet = new Set<string>();
          const blocksSet = new Set<string>();
          
          // Extract city/district names from tweet text
          // Check for common district names in the tweet
          const districtNames = ['रायपुर', 'बिलासपुर', 'दुर्ग', 'रायगढ़', 'कोरबा', 'जगदलपुर', 'नवा रायपुर'];
          districtNames.forEach(district => {
            if (tweet.tweet_text.includes(district)) {
              districtsSet.add(district);
            }
          });

          // Resolve each location deterministically
          for (const loc of consensusResult.final_result.locations) {
            try {
              // Extract hints from tweet context
              const hints = {
                districts: districtsSet.size > 0 ? Array.from(districtsSet) : undefined,
                blocks: blocksSet.size > 0 ? Array.from(blocksSet) : undefined,
                context: tweet.tweet_text
              };

              const deterministicResult = await resolver.resolveDeterministic(loc, hints);

              // Collect hierarchies and candidates
              if (deterministicResult.hierarchy) {
                allHierarchies.push(deterministicResult.hierarchy);
              }
              if (deterministicResult.candidates.length > 0) {
                allCandidates.push(...deterministicResult.candidates);
              }

              // Track if any location needs review
              if (deterministicResult.needs_review) {
                needsReview = true;
              }

              // Collect explanations
              if (deterministicResult.explanations.length > 0) {
                explanations.push(...deterministicResult.explanations);
              }

              // Update hints based on resolved hierarchy
              if (deterministicResult.hierarchy) {
                districtsSet.add(deterministicResult.hierarchy.district);
                blocksSet.add(deterministicResult.hierarchy.block);
              }
            } catch (e) {
              // In strict mode, errors are thrown; in non-strict, log warning
              const errorMessage = e instanceof Error ? e.message : String(e);
              console.warn(`Geo resolve failed for "${loc}":`, errorMessage);
              explanations.push(`Failed to resolve location "${loc}": ${errorMessage}`);
              needsReview = true;
            }
          }

          // Update consensus result with geo-hierarchy data
          if (allHierarchies.length > 0) {
            consensusResult.final_result.geo_hierarchy = allHierarchies;
            consensusResult.geo_hierarchy_resolved = true;
          }

          // Set needs_review flag if any location needs review
          if (needsReview && !consensusResult.final_result.hasOwnProperty('needs_review')) {
            (consensusResult.final_result as any).needs_review = true;
          }

          // Add explanations to final result if any
          if (explanations.length > 0) {
            if (!consensusResult.final_result.hasOwnProperty('explanations')) {
              (consensusResult.final_result as any).explanations = [];
            }
            (consensusResult.final_result as any).explanations.push(...explanations);
          }
        }
      }
    } catch (error) {
      console.warn('Geo-hierarchy resolution failed:', error);
      // Set needs_review if resolution completely fails
      if (!consensusResult.final_result.hasOwnProperty('needs_review')) {
        (consensusResult.final_result as any).needs_review = true;
      }
      if (!consensusResult.final_result.hasOwnProperty('explanations')) {
        (consensusResult.final_result as any).explanations = [];
      }
      (consensusResult.final_result as any).explanations.push(
        `Geo-hierarchy resolution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return {
      final_result: consensusResult.final_result,
      layer_results: layerResults,
      consensus_score: consensusResult.consensus_score,
      agreement_level: consensusResult.agreement_level,
      conflicts: consensusResult.conflicts,
      geo_hierarchy_resolved: consensusResult.geo_hierarchy_resolved,
    };
  }

  /**
   * Layer 1: Gemini API Parsing
   */
  private async parseWithGemini(tweet: TweetData): Promise<ParsingResult> {
    if (!this.gemini) {
      throw new Error('Gemini API not initialized');
    }

    const model = this.gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `
Parse this Hindi tweet and extract structured information:

Tweet: "${tweet.tweet_text}"

Extract:
1. Locations (स्थान) - List all places mentioned
2. Event Type (दौरा/कार्यक्रम) - What type of event/visit
3. Schemes Mentioned (योजनाएं) - Government schemes referenced
4. Hashtags (हैशटैग) - All hashtags
5. People Mentioned (लोग) - Names of people mentioned

Respond in JSON format:
{
  "locations": ["location1", "location2"],
  "event_type": "event type in Hindi",
  "schemes_mentioned": ["scheme1", "scheme2"],
  "hashtags": ["#hashtag1", "#hashtag2"],
  "people_mentioned": ["person1", "person2"]
}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON response
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, ''));

    return {
      locations: parsed.locations || [],
      event_type: parsed.event_type || null,
      schemes_mentioned: parsed.schemes_mentioned || [],
      hashtags: parsed.hashtags || [],
      people_mentioned: parsed.people_mentioned || [],
      geo_hierarchy: [],
      confidence: 0.9,
      parser_source: 'gemini',
      raw_response: text,
    };
  }

  /**
   * Layer 2: Ollama Local Model Parsing
   */
  private async parseWithOllama(tweet: TweetData): Promise<ParsingResult> {
    const response = await fetch(`${this.ollamaBaseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemma2:2b',
        prompt: `Parse this Hindi tweet: "${tweet.tweet_text}"\n\nExtract locations, event type, schemes, hashtags, and people mentioned. Respond in JSON format.`,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.response;

    // Parse JSON response
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, ''));

    return {
      locations: parsed.locations || [],
      event_type: parsed.event_type || null,
      schemes_mentioned: parsed.schemes_mentioned || [],
      hashtags: parsed.hashtags || [],
      people_mentioned: parsed.people_mentioned || [],
      geo_hierarchy: [],
      confidence: 0.7,
      parser_source: 'ollama',
      raw_response: text,
    };
  }

  /**
   * Layer 3: Custom Parsing Engine
   */
  private async parseWithCustomEngine(tweet: TweetData): Promise<ParsingResult> {
    const text = tweet.tweet_text;

    // Custom regex-based parsing
    const locations = this.extractLocations(text);
    const eventType = this.extractEventType(text);
    const schemes = this.extractSchemes(text);
    const hashtags = this.extractHashtags(text);
    const people = this.extractPeople(text);

    return {
      locations,
      event_type: eventType,
      schemes_mentioned: schemes,
      hashtags,
      people_mentioned: people,
      geo_hierarchy: [],
      confidence: 0.6,
      parser_source: 'custom',
      raw_response: 'Custom regex parsing',
    };
  }

  /**
   * Custom regex-based location extraction
   */
  private extractLocations(text: string): string[] {
    const locationNames = [
      'रायपुर', 'बिलासपुर', 'राजनांदगांव', 'दुर्ग', 'कोरबा', 'सरगुजा', 'जशपुर', 'कांकेर', 'बस्तर', 'सुकमा',
      'नारायणपुर', 'कोंडागांव', 'बीजापुर', 'दंतेवाड़ा', 'मुंगेली', 'बलरामपुर', 'सूरजपुर', 'गरियाबंद',
      'बलौदाबाजार', 'महासमुंद', 'कबीरधाम', 'जांजगीर-चंपा', 'कोरिया', 'सिमगा', 'अंबिकापुर',
      'पंडरी', 'अरंग', 'तखतपुर', 'कोटा'
    ];

    const locations: string[] = [];
    
    for (const locationName of locationNames) {
      const pattern = new RegExp(locationName, 'gi');
      const matches = text.match(pattern);
      if (matches) {
        locations.push(...matches.map(m => m.trim()));
      }
    }

    return [...new Set(locations)]; // Remove duplicates
  }

  /**
   * Custom regex-based event type extraction
   */
  private extractEventType(text: string): string | null {
    const eventPatterns = [
      /(बैठक|कार्यक्रम|दौरा|यात्रा|भेंट|मुलाकात|सम्मेलन|सभा|रैली|जनसभा|प्रोग्राम|इवेंट)/gi,
    ];

    for (const pattern of eventPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  /**
   * Custom regex-based scheme extraction
   */
  private extractSchemes(text: string): string[] {
    const schemePatterns = [
      /(PM-Kisan|PM-KISAN|पीएम-किसान|पीएम किसान|PM Kisan)/gi,
      /(Ayushman|आयुष्मान|Ayushman Bharat)/gi,
      /(Ujjwala|उज्ज्वला|PM Ujjwala)/gi,
      /(Jan Dhan|जन धन|Pradhan Mantri Jan Dhan)/gi,
      /(Mudra|मुद्रा|PM Mudra)/gi,
      /(Sukanya|सुकन्या|Sukanya Samriddhi)/gi,
    ];

    const schemes: string[] = [];
    
    for (const pattern of schemePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        schemes.push(...matches.map(m => m.trim()));
      }
    }

    return [...new Set(schemes)]; // Remove duplicates
  }

  /**
   * Custom regex-based hashtag extraction
   */
  private extractHashtags(text: string): string[] {
    const hashtagPattern = /#[\w\u0900-\u097F]+/g;
    const matches = text.match(hashtagPattern);
    return matches || [];
  }

  /**
   * Custom regex-based people extraction
   */
  private extractPeople(text: string): string[] {
    const peoplePatterns = [
      /(श्री|श्रीमती|डॉ\.|प्रोफेसर|सर|मैडम)\s+([A-Za-z\u0900-\u097F\s]+)/gi,
    ];

    const people: string[] = [];
    
    for (const pattern of peoplePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        people.push(...matches.map(m => m.trim()));
      }
    }

    return [...new Set(people)]; // Remove duplicates
  }

  /**
   * Apply 2/3 voting consensus algorithm
   */
  private async ensureGeoResolver(): Promise<GeoHierarchyResolver | null> {
    if (this.geoResolver) return this.geoResolver;
    try {
      const resolver = new GeoHierarchyResolver();
      await resolver.initialize();
      this.geoResolver = resolver;
      return resolver;
    } catch (error) {
      console.warn('Geo resolver initialization failed:', error);
      return null;
    }
  }

  private applyConsensusAlgorithm(
    layerResults: {
      gemini: ParsingResult | null;
      ollama: ParsingResult | null;
      custom: ParsingResult | null;
    },
    tweet: TweetData
  ): {
    final_result: ParsingResult;
    consensus_score: number;
    agreement_level: 'high' | 'medium' | 'low';
    conflicts: string[];
    geo_hierarchy_resolved: boolean;
  } {
    const results = Object.values(layerResults).filter(r => r !== null) as ParsingResult[];
    
    if (results.length === 0) {
      throw new Error('All parsing layers failed');
    }

    // Calculate consensus for each field
    const consensusFields = {
      locations: this.consensusVote(results.map(r => r.locations)),
      event_type: this.consensusVote(results.map(r => r.event_type)),
      schemes_mentioned: this.consensusVote(results.map(r => r.schemes_mentioned)),
      hashtags: this.consensusVote(results.map(r => r.hashtags)),
      people_mentioned: this.consensusVote(results.map(r => r.people_mentioned)),
    };

    // Calculate overall consensus score
    const consensusScore = this.calculateConsensusScore(results, consensusFields);
    
    // Determine agreement level
    const agreementLevel = consensusScore >= 0.8 ? 'high' : consensusScore >= 0.6 ? 'medium' : 'low';

    // Identify conflicts
    const conflicts = this.identifyConflicts(results, consensusFields);

    // Use the highest confidence result as base, then apply consensus
    const baseResult = results.reduce((prev, current) => 
      prev.confidence > current.confidence ? prev : current
    );

    const finalResult: ParsingResult = {
      ...baseResult,
      locations: consensusFields.locations,
      event_type: consensusFields.event_type,
      schemes_mentioned: consensusFields.schemes_mentioned,
      hashtags: consensusFields.hashtags,
      people_mentioned: consensusFields.people_mentioned,
      confidence: consensusScore,
    };

    // Geo resolution happens after consensus in parseTweet
    const geoHierarchyResolved = false;

    return {
      final_result: finalResult,
      consensus_score: consensusScore,
      agreement_level: agreementLevel,
      conflicts,
      geo_hierarchy_resolved: geoHierarchyResolved,
    };
  }

  /**
   * Apply voting consensus to a field
   */
  private consensusVote(values: any[]): any {
    if (values.length === 0) return null;
    if (values.length === 1) return values[0];

    // For arrays, find common elements
    if (Array.isArray(values[0])) {
      const allItems = values.flat();
      const itemCounts = new Map<string, number>();
      
      allItems.forEach(item => {
        itemCounts.set(item, (itemCounts.get(item) || 0) + 1);
      });

      // Return items that appear in at least 2/3 of results
      const threshold = Math.ceil(values.length * 2 / 3);
      return Array.from(itemCounts.entries())
        .filter(([_, count]) => count >= threshold)
        .map(([item, _]) => item);
    }

    // For strings, return the most common value
    const stringCounts = new Map<string, number>();
    values.forEach(value => {
      if (value !== null && value !== undefined) {
        stringCounts.set(value, (stringCounts.get(value) || 0) + 1);
      }
    });

    const threshold = Math.ceil(values.length * 2 / 3);
    const mostCommon = Array.from(stringCounts.entries())
      .filter(([_, count]) => count >= threshold)
      .sort((a, b) => b[1] - a[1])[0];

    return mostCommon ? mostCommon[0] : values[0];
  }

  /**
   * Calculate overall consensus score
   */
  private calculateConsensusScore(
    results: ParsingResult[],
    consensusFields: any
  ): number {
    const fields = ['locations', 'event_type', 'schemes_mentioned', 'hashtags', 'people_mentioned'];
    let totalScore = 0;
    let fieldCount = 0;

    fields.forEach(field => {
      const fieldValues = results.map(r => r[field as keyof ParsingResult]);
      const consensusValue = consensusFields[field as keyof typeof consensusFields];
      
      let fieldScore = 0;
      fieldValues.forEach(value => {
        if (this.valuesMatch(value, consensusValue)) {
          fieldScore += 1;
        }
      });
      
      totalScore += fieldScore / fieldValues.length;
      fieldCount++;
    });

    return totalScore / fieldCount;
  }

  /**
   * Check if two values match (handles arrays and strings)
   */
  private valuesMatch(value1: any, value2: any): boolean {
    if (Array.isArray(value1) && Array.isArray(value2)) {
      return value1.length === value2.length && 
             value1.every(item => value2.includes(item));
    }
    return value1 === value2;
  }

  /**
   * Identify conflicts between results
   */
  private identifyConflicts(results: ParsingResult[], consensusFields: any): string[] {
    const conflicts: string[] = [];
    const fields = ['locations', 'event_type', 'schemes_mentioned', 'hashtags', 'people_mentioned'];

    fields.forEach(field => {
      const fieldValues = results.map(r => r[field as keyof ParsingResult]);
      const uniqueValues = new Set(fieldValues.map(v => JSON.stringify(v)));
      
      if (uniqueValues.size > 1) {
        conflicts.push(`Field '${field}' has conflicting values: ${Array.from(uniqueValues).join(', ')}`);
      }
    });

    return conflicts;
  }
}

// Export singleton instance
export const consensusEngine = new ThreeLayerConsensusEngine();
