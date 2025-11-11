/**
 * Three-Layer Consensus Parsing Engine
 * SOTA implementation with Gemini (Primary), Ollama (Secondary), Regex (Fallback)
 */

import { RateLimiter } from './rate-limiter';
import { getEventTypeInHindi } from '../i18n/event-types-hi';

interface ConsensusConfig {
  rateLimiter: RateLimiter;
  consensusThreshold: number;
  enableFallback: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  geminiModel?: string;
  ollamaModel?: string;
}

interface ParsingResult {
  tweet_id: string;
  event_type: string;
  event_type_hi: string; // Hindi translation of event_type
  event_type_confidence: number;
  event_date: string | null;
  date_confidence: number;
  locations: string[];
  people_mentioned: string[];
  organizations: string[];
  schemes_mentioned: string[];
  overall_confidence: number;
  needs_review: boolean;
  parsed_by: string;
  layers_used: string[];
  consensus_score: number;
  reasoning?: string;
  error_details?: string;
}

interface LayerResult {
  layer: 'gemini' | 'ollama' | 'regex';
  event_type: string;
  confidence: number;
  locations: string[];
  people_mentioned: string[];
  organizations: string[];
  schemes_mentioned: string[];
  error?: string;
}

export class ThreeLayerConsensusEngine {
  private config: ConsensusConfig;
  private geminiApiKey?: string;
  private ollamaBaseUrl: string;

  constructor(config: ConsensusConfig) {
    this.config = config;
    this.geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    this.ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  }

  /**
   * Parse a tweet using three-layer consensus
   */
  async parseTweet(
    tweetText: string,
    tweetId: string,
    tweetDate: Date
  ): Promise<ParsingResult> {
    const startTime = Date.now();
    console.log(`Starting three-layer parsing for tweet ${tweetId}`);

    if (!tweetText || !tweetText.trim()) {
      return this.createEmptyResult(tweetId);
    }

    // Execute layers sequentially to respect rate limits
    // Gemini first (most accurate), then Ollama, then regex fallback
    const layerResults: LayerResult[] = [];
    
    // Try Gemini first (with rate limiting)
    try {
      const geminiResult = await this.callGeminiLayer(tweetText, tweetId);
      layerResults.push({ ...geminiResult, layer: 'gemini' });
    } catch (err: any) {
      console.warn(`Gemini layer failed for ${tweetId}:`, err.message);
      // Do not add a fallback result; let other layers handle it.
    }
    
    // Small delay before Ollama to avoid hitting rate limits
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
    
    // Try Ollama second (with rate limiting)
    try {
      const ollamaResult = await this.callOllamaLayer(tweetText, tweetId);
      layerResults.push({ ...ollamaResult, layer: 'ollama' });
    } catch (err: any) {
      console.warn(`Ollama layer failed for ${tweetId}:`, err.message);
      // Do not add a fallback result; let other layers handle it.
    }
    
    // Regex is always available (no rate limits)
    layerResults.push({ ...this.parseWithRegex(tweetText), layer: 'regex' });
    
    // Use the layerResults directly (already have layer property set)
    const successfulResults: LayerResult[] = layerResults;

    // Apply consensus voting
    const consensusResult = this.applyConsensusVoting(successfulResults, tweetText, tweetDate);

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`Three-layer parsing completed for ${tweetId} in ${duration}ms: ${consensusResult.event_type} (confidence: ${(consensusResult.overall_confidence * 100).toFixed(1)}%)`);

    return {
      tweet_id: tweetId,
      ...consensusResult,
      parsed_by: 'three-layer-consensus',
      layers_used: successfulResults.map(r => r.layer)
    };
  }

  /**
   * Call Gemini AI layer (Primary)
   */
  private async callGeminiLayer(tweetText: string, tweetId: string): Promise<LayerResult> {
    if (!this.geminiApiKey) {
      throw new Error('Gemini API key not available');
    }

    // Rate limiting with free tier safety
    await this.config.rateLimiter.acquirePermit('gemini');

    try {
      // Dynamic import to avoid issues if not installed
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: this.geminiApiKey });

      const response = await ai.models.generateContent({
        model: this.config.geminiModel || 'gemini-2.5-flash',
        contents: this.buildGeminiPrompt(tweetText)
      });

      console.log(`Gemini response for ${tweetId}: ${response.text?.substring(0, 100)}...`);

      return this.parseGeminiResponse(response.text || '', tweetText);
    } catch (error: any) {
      console.error(`Gemini API error for ${tweetId}:`, error.message);
      throw error;
    }
  }

  /**
   * Call Ollama layer (Secondary)
   */
  private async callOllamaLayer(tweetText: string, tweetId: string): Promise<LayerResult> {
    // Rate limiting for Ollama
    await this.config.rateLimiter.acquirePermit('ollama');

    try {
      const response = await fetch(`${this.ollamaBaseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.ollamaModel || 'gemma2:2b',
          prompt: this.buildOllamaPrompt(tweetText),
          stream: false,
          options: {
            temperature: 0.1,
            top_p: 0.9,
            num_predict: 512
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API returned ${response.status}`);
      }

      const data = await response.json();
      console.log(`Ollama response for ${tweetId}: ${data.response?.substring(0, 100)}...`);

      return this.parseOllamaResponse(data.response, tweetText);
    } catch (error: any) {
      console.error(`Ollama API error for ${tweetId}:`, error.message);
      throw error;
    }
  }

  /**
   * Parse with regex patterns (current implementation)
   */
  private parseWithRegex(tweetText: string): LayerResult {
    const eventType = this.classifyEventType(tweetText);
    const locations = this.extractLocations(tweetText);
    const people = this.extractPeople(tweetText);
    const organizations = this.extractOrganizations(tweetText);
    const schemes = this.extractSchemes(tweetText);

    // Calculate confidence based on matches found
    let confidence = 0.3; // Base confidence
    if (locations.length > 0) confidence += 0.2;
    if (people.length > 0) confidence += 0.2;
    if (organizations.length > 0) confidence += 0.1;
    if (schemes.length > 0) confidence += 0.2;

    return {
      layer: 'regex',
      event_type: eventType,
      confidence: Math.min(1.0, confidence),
      locations,
      people_mentioned: people,
      organizations,
      schemes_mentioned: schemes
    };
  }

  /**
   * Apply consensus voting algorithm
   */
  private applyConsensusVoting(
    layerResults: LayerResult[],
    tweetText: string,
    tweetDate: Date
  ): Omit<ParsingResult, 'tweet_id' | 'parsed_by' | 'layers_used'> {
    // Group results by field for voting
    const eventTypeVotes = new Map<string, number>();
    const locationVotes = new Map<string, number>();
    const peopleVotes = new Map<string, number>();
    const orgVotes = new Map<string, number>();
    const schemeVotes = new Map<string, number>();

    let totalWeight = 0;
    let workingLayers = 0;

    // Weight layers (Gemini > Ollama > Regex) and count working layers
    const layerWeights = { gemini: 3, ollama: 2, regex: 1 };

    layerResults.forEach(result => {
      const weight = layerWeights[result.layer];
      totalWeight += weight;

      // Only count layers with reasonable confidence
      if (result.confidence > 0.3) {
        workingLayers++;
      }

      // Event type voting with confidence weighting
      const currentEventType = eventTypeVotes.get(result.event_type) || 0;
      eventTypeVotes.set(result.event_type, currentEventType + weight * result.confidence);

      // Location voting (multiple items)
      result.locations.forEach(loc => {
        if (loc.trim()) {
          const current = locationVotes.get(loc) || 0;
          locationVotes.set(loc, current + weight);
        }
      });

      // People voting
      result.people_mentioned.forEach(person => {
        if (person.trim()) {
          const current = peopleVotes.get(person) || 0;
          peopleVotes.set(person, current + weight);
        }
      });

      // Organization voting
      result.organizations.forEach(org => {
        if (org.trim()) {
          const current = orgVotes.get(org) || 0;
          orgVotes.set(org, current + weight);
        }
      });

      // Scheme voting
      result.schemes_mentioned.forEach(scheme => {
        if (scheme.trim()) {
          const current = schemeVotes.get(scheme) || 0;
          schemeVotes.set(scheme, current + weight);
        }
      });
    });

    // Determine winning values
    const winningEventType = this.getWinningVote(eventTypeVotes);
    const winningLocations = this.getWinningItems(locationVotes, Math.max(totalWeight * 0.4, 1));
    const winningPeople = this.getWinningItems(peopleVotes, Math.max(totalWeight * 0.5, 1));
    const winningOrgs = this.getWinningItems(orgVotes, Math.max(totalWeight * 0.5, 1));
    const winningSchemes = this.getWinningItems(schemeVotes, Math.max(totalWeight * 0.4, 1));

    // Calculate consensus score (how many layers agreed on event type)
    const eventTypeAgreement = layerResults.filter(r =>
      r.confidence > 0.4 && r.event_type === winningEventType
    ).length;

    // Calculate overall confidence based on consensus and individual scores
    const avgConfidence = layerResults.reduce((sum, r) => sum + r.confidence, 0) / layerResults.length;
    const consensusBonus = eventTypeAgreement >= this.config.consensusThreshold ? 0.15 : 0;
    const overallConfidence = Math.min(1.0, avgConfidence + consensusBonus);

    // Determine if review is needed
    const needsReview = overallConfidence < 0.65 ||
                       eventTypeAgreement < this.config.consensusThreshold ||
                       winningEventType === 'other';

    return {
      event_type: winningEventType,
      event_type_hi: getEventTypeInHindi(winningEventType), // Hindi translation
      event_type_confidence: avgConfidence,
      event_date: this.extractEventDate(tweetText, tweetDate),
      date_confidence: 0.8,
      locations: winningLocations,
      people_mentioned: winningPeople,
      organizations: winningOrgs,
      schemes_mentioned: winningSchemes,
      overall_confidence: overallConfidence,
      needs_review: needsReview,
      consensus_score: eventTypeAgreement,
      reasoning: `${eventTypeAgreement}/${workingLayers} layers agreed, confidence: ${(overallConfidence * 100).toFixed(1)}%`
    };
  }

  /**
   * Get winning vote from weighted votes
   */
  private getWinningVote(votes: Map<string, number>): string {
    let maxScore = 0;
    let winner = 'other';

    votes.forEach((score, item) => {
      if (score > maxScore) {
        maxScore = score;
        winner = item;
      }
    });

    return winner;
  }

  /**
   * Get winning items that meet threshold
   */
  private getWinningItems(votes: Map<string, number>, threshold: number): string[] {
    const winners: string[] = [];

    votes.forEach((score, item) => {
      if (score >= threshold) {
        winners.push(item);
      }
    });

    return winners;
  }

  /**
   * Build Gemini prompt
   */
  private buildGeminiPrompt(tweetText: string): string {
    return `Parse this Hindi political tweet and extract structured information. Be precise and factual.

Tweet: "${tweetText}"

Return ONLY a JSON object with these exact fields:
{
  "event_type": "inauguration|meeting|rally|inspection|scheme_announcement|condolence|ceremony|birthday_wishes|other",
  "confidence": 0.0-1.0,
  "locations": ["array", "of", "location", "names"],
  "people_mentioned": ["array", "of", "people", "names"],
  "organizations": ["array", "of", "organization", "names"],
  "schemes_mentioned": ["array", "of", "government", "schemes"]
}

Rules:
- event_type must be one of the listed options
- confidence should reflect how certain you are (0.0-1.0)
- locations should be city/district/state names mentioned
- people_mentioned should be politician/official names
- organizations should be political parties/government bodies
- schemes_mentioned should be government program names
- Return only valid JSON, no explanations`;
  }

  /**
   * Build Ollama prompt
   */
  private buildOllamaPrompt(tweetText: string): string {
    return `You are an expert at analyzing Hindi political tweets. Parse this tweet:

"${tweetText}"

Classify the event type and extract key information. Return JSON:

{
  "event_type": "inauguration|meeting|rally|inspection|scheme_announcement|condolence|ceremony|birthday_wishes|other",
  "confidence": 0.0-1.0,
  "locations": ["locations"],
  "people_mentioned": ["people"],
  "organizations": ["organizations"],
  "schemes_mentioned": ["schemes"]
}

Be accurate and specific.`;
  }

  /**
   * Parse Gemini response
   */
  private parseGeminiResponse(response: string, tweetText: string): LayerResult {
    try {
      // Clean markdown code blocks and extract JSON
      const cleanedResponse = response.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanedResponse);
      return {
        layer: 'gemini',
        event_type: parsed.event_type || 'other',
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0)),
        locations: Array.isArray(parsed.locations) ? parsed.locations : [],
        people_mentioned: Array.isArray(parsed.people_mentioned) ? parsed.people_mentioned : [],
        organizations: Array.isArray(parsed.organizations) ? parsed.organizations : [],
        schemes_mentioned: Array.isArray(parsed.schemes_mentioned) ? parsed.schemes_mentioned : []
      };
    } catch (error) {
      console.warn('Failed to parse Gemini response:', response);
      return this.fallbackRegexResult(tweetText, 'gemini');
    }
  }

  /**
   * Parse Ollama response
   */
  private parseOllamaResponse(response: string, tweetText: string): LayerResult {
    try {
      // Ollama sometimes returns extra text, try to extract JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in Ollama response');

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        layer: 'ollama',
        event_type: parsed.event_type || 'other',
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
        locations: Array.isArray(parsed.locations) ? parsed.locations : [],
        people_mentioned: Array.isArray(parsed.people_mentioned) ? parsed.people_mentioned : [],
        organizations: Array.isArray(parsed.organizations) ? parsed.organizations : [],
        schemes_mentioned: Array.isArray(parsed.schemes_mentioned) ? parsed.schemes_mentioned : []
      };
    } catch (error) {
      console.warn('Failed to parse Ollama response:', response);
      return this.fallbackRegexResult(tweetText, 'ollama');
    }
  }

  /**
   * Fallback regex result when AI parsing fails
   */
  private fallbackRegexResult(tweetText: string, layer: 'gemini' | 'ollama'): LayerResult {
    const regexResult = this.parseWithRegex(tweetText);
    return {
      ...regexResult,
      layer: layer,
      confidence: regexResult.confidence * 0.5, // Reduce confidence for fallback
      error: `AI layer ${layer} failed, used regex fallback.`
    };
  }

  /**
   * Simple event type classification using regex
   */
  private classifyEventType(tweetText: string): string {
    const text = tweetText.toLowerCase();

    const patterns = {
      inauguration: /(उद्घाटन|शिलान्यास|भूमिपूजन|लोकार्पण)/,
      meeting: /(बैठक|चर्चा|मुलाकात|सम्मिलित)/,
      rally: /(रैली|सभा|सम्मेलन)/,
      inspection: /(निरीक्षण|दौरा|आगाज)/,
      scheme_announcement: /(योजना|घोषणा|विस्तार)/,
      condolence: /(निधन|शोक|श्रद्धांजलि)/,
      ceremony: /(समारोह|वितरण|प्रमाण)/,
      birthday_wishes: /(जन्मदिन|शुभकामना)/
    };

    for (const [eventType, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) {
        return eventType;
      }
    }

    return 'other';
  }

  /**
   * Extract locations using regex
   */
  private extractLocations(tweetText: string): string[] {
    const locationPatterns = [
      /(रायपुर|दिल्ली|मुंबई|बिलासपुर|रायगढ़|छत्तीसगढ़|भारत)/gi
    ];

    const locations: string[] = [];
    locationPatterns.forEach(pattern => {
      const matches = tweetText.match(pattern);
      if (matches) {
        locations.push(...matches);
      }
    });

    return Array.from(new Set(locations));
  }

  /**
   * Extract people names
   */
  private extractPeople(tweetText: string): string[] {
    const peoplePatterns = [
      /श्री\s+([^\s,।]+(?:\s+[^\s,।]+){0,2})\s*जी?/gi,
      /@(\w+)/g
    ];

    const people: string[] = [];
    peoplePatterns.forEach(pattern => {
      const matches = tweetText.match(pattern);
      if (matches) {
        people.push(...matches.map(m => m.replace(/^श्री\s+|\s*जी?$/g, '').replace('@', '')));
      }
    });

    return Array.from(new Set(people));
  }

  /**
   * Extract organizations
   */
  private extractOrganizations(tweetText: string): string[] {
    const orgPatterns = [
      /(कांग्रेस|भाजपा|भारतीय जनता पार्टी|सरकार|मंत्रालय)/gi
    ];

    const orgs: string[] = [];
    orgPatterns.forEach(pattern => {
      const matches = tweetText.match(pattern);
      if (matches) {
        orgs.push(...matches);
      }
    });

    return Array.from(new Set(orgs));
  }

  /**
   * Extract government schemes
   */
  private extractSchemes(tweetText: string): string[] {
    const schemePatterns = [
      /(प्रधानमंत्री आवास|मनरेगा|आयुष्मान भारत|किसान सम्मान|स्वच्छ भारत)/gi
    ];

    const schemes: string[] = [];
    schemePatterns.forEach(pattern => {
      const matches = tweetText.match(pattern);
      if (matches) {
        schemes.push(...matches);
      }
    });

    return Array.from(new Set(schemes));
  }

  /**
   * Extract event date
   */
  private extractEventDate(tweetText: string, tweetDate: Date): string | null {
    return tweetDate.toISOString().split('T')[0];
  }

  /**
   * Create empty result for invalid tweets
   */
  private createEmptyResult(tweetId: string): ParsingResult {
    return {
      tweet_id: tweetId,
      event_type: 'other',
      event_type_hi: getEventTypeInHindi('other'), // Hindi translation
      event_type_confidence: 0,
      event_date: null,
      date_confidence: 0,
      locations: [],
      people_mentioned: [],
      organizations: [],
      schemes_mentioned: [],
      overall_confidence: 0,
      needs_review: true,
      parsed_by: 'three-layer-consensus',
      layers_used: [],
      consensus_score: 0,
      reasoning: 'Empty or invalid tweet text'
    };
  }
}