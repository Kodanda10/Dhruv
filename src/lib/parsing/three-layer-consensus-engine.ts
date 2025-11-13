/**
 * Three-Layer Consensus Parsing Engine
 * SOTA implementation with Gemini (Primary), Ollama (Secondary), Regex (Fallback)
 */

import { RateLimiter } from './rate-limiter';
import { getEventTypeInHindi } from '../i18n/event-types-hi';
import {
  collectFaissCandidates,
  formatHierarchyForContext,
  NormalizedLocationHierarchy,
} from './location-normalizer';
import { searchMilvusLocations, MilvusSearchResult } from '@/labs/milvus/milvus_fallback';

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
  geo_verified?: boolean; // New field for FAISS geo validation
}

interface LayerResult {
  layer: 'gemini' | 'ollama' | 'regex' | 'faiss';
  event_type: string;
  confidence: number;
  locations: string[];
  people_mentioned: string[];
  organizations: string[];
  schemes_mentioned: string[];
  error?: string;
  geo_verified?: boolean;
  geo_backend?: 'faiss' | 'milvus' | 'none';
}

type VectorBackend = 'faiss' | 'milvus';

interface VectorMatch {
  score: number;
  match_type?: string;
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
   * Parse a tweet using three-layer consensus with strict requirements
   * ALL layers must succeed for the tweet to be accepted
   */
  async parseTweet(
    tweetText: string,
    tweetId: string,
    tweetDate: Date
  ): Promise<ParsingResult> {
    const startTime = Date.now();
    console.log(`Starting strict three-layer parsing for tweet ${tweetId}`);

    if (!tweetText || !tweetText.trim()) {
      throw new Error('Empty or invalid tweet text');
    }

    const layerResults: LayerResult[] = [];
    const errors: string[] = [];

    // Layer 1: Gemini AI (Primary) - MUST succeed
    try {
      console.log(`🔄 Executing Gemini layer for ${tweetId}`);
      const geminiResult = await this.callGeminiLayer(tweetText, tweetId);
      layerResults.push({ ...geminiResult, layer: 'gemini' });
      console.log(`✅ Gemini layer succeeded for ${tweetId}`);
    } catch (err: any) {
      const errorMsg = `gemini_timeout: ${err.message}`;
      console.error(`❌ Gemini layer failed for ${tweetId}:`, errorMsg);
      errors.push(errorMsg);
    }

    // Layer 2: Ollama AI (Secondary) - MUST succeed
    if (errors.length === 0) {
      try {
        console.log(`🔄 Executing Ollama layer for ${tweetId}`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limiting
        const ollamaResult = await this.callOllamaLayer(tweetText, tweetId);
        layerResults.push({ ...ollamaResult, layer: 'ollama' });
        console.log(`✅ Ollama layer succeeded for ${tweetId}`);
      } catch (err: any) {
        const errorMsg = `ollama_conflict: ${err.message}`;
        console.error(`❌ Ollama layer failed for ${tweetId}:`, errorMsg);
        errors.push(errorMsg);
      }
    }

    // Layer 3: Regex + FAISS validation - MUST succeed
    if (errors.length === 0) {
      try {
        console.log(`🔄 Executing Regex+FAISS layer for ${tweetId}`);
        const regexResult = this.parseWithRegex(tweetText);
        layerResults.push({ ...regexResult, layer: 'regex' });

        // Check if regex found locations - if so, FAISS validation is required
        const geminiLocations = layerResults.find(r => r.layer === 'gemini')?.locations ?? [];
        const ollamaLocations = layerResults.find(r => r.layer === 'ollama')?.locations ?? [];
        const faissCandidates = collectFaissCandidates([
          ...regexResult.locations,
          ...geminiLocations,
          ...ollamaLocations,
        ]);

        if (faissCandidates.length > 0) {
          console.log(`🔄 Executing FAISS geo validation for ${tweetId} with ${faissCandidates.length} candidate(s)`);
          const faissResult = await this.validateWithFAISS(faissCandidates, tweetId);
          layerResults.push(faissResult);

          if (!faissResult.geo_verified) {
            const contextStrings = faissCandidates.map(candidate =>
              formatHierarchyForContext(candidate.originalTokens)
            );
            throw new Error(`faiss_no_match: No valid geospatial matches found for normalized hierarchies: ${contextStrings.join('; ')}`);
          }
          console.log(`✅ FAISS geo validation succeeded for ${tweetId}`);
        } else {
          console.log(`⏭️ Skipping FAISS validation for ${tweetId} (no normalized candidates found)`);
        }

        console.log(`✅ Regex layer succeeded for ${tweetId}`);
      } catch (err: any) {
        const errorMsg = err.message.startsWith('faiss_no_match') ? err.message : `regex_mismatch: ${err.message}`;
        console.error(`❌ Regex/FAISS layer failed for ${tweetId}:`, errorMsg);
        errors.push(errorMsg);
      }
    }

    // If any layer failed, throw an error with all failure reasons
    if (errors.length > 0) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log(`❌ Strict three-layer parsing failed for ${tweetId} in ${duration}ms. Errors: ${errors.join('; ')}`);
      throw new Error(`PARSING_FAILED: ${errors.join('; ')}`);
    }

    // All layers succeeded - apply consensus voting
    const consensusResult = this.applyConsensusVoting(layerResults, tweetText, tweetDate);

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`✅ Strict three-layer parsing completed for ${tweetId} in ${duration}ms: ${consensusResult.event_type} (confidence: ${(consensusResult.overall_confidence * 100).toFixed(1)}%)`);

    return {
      tweet_id: tweetId,
      ...consensusResult,
      parsed_by: 'three-layer-consensus-strict',
      layers_used: layerResults.map(r => r.layer),
      geo_verified: layerResults.some(r => r.layer === 'faiss' && r.geo_verified)
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

    // Weight layers (Gemini > Ollama > Regex > FAISS) and count working layers
    const layerWeights = { gemini: 3, ollama: 2, regex: 1, faiss: 1 };

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
    } catch (error: any) {
      console.warn('Failed to parse Gemini response:', response);
      throw new Error(`Gemini parsing failed: ${error.message}`);
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
    } catch (error: any) {
      console.warn('Failed to parse Ollama response:', response);
      throw new Error(`Ollama parsing failed: ${error.message}`);
    }
  }

  /**
   * Validate locations using FAISS geo embeddings
   * Only called when regex layer finds locations
   */
  private async validateWithFAISS(
    candidates: NormalizedLocationHierarchy[],
    tweetId: string
  ): Promise<LayerResult> {
    try {
      const faissResult = await this.validateCandidatesAgainstBackend('faiss', candidates, tweetId);
      if (faissResult.locations.length > 0) {
        return this.buildGeoValidationLayer(faissResult.locations, 'faiss');
      }

      const milvusEnabled = process.env.MILVUS_ENABLE === 'true';
      if (milvusEnabled) {
        const milvusResult = await this.validateCandidatesAgainstBackend('milvus', candidates, tweetId);
        if (milvusResult.locations.length > 0) {
          return this.buildGeoValidationLayer(milvusResult.locations, 'milvus');
        }

        if (milvusResult.error) {
          return this.buildGeoValidationLayer([], 'milvus', milvusResult.error);
        }
      }

      return this.buildGeoValidationLayer(faissResult.locations, 'none', faissResult.error);
    } catch (error: any) {
      console.error(`Vector validation failed for tweet ${tweetId}:`, error.message);
      return this.buildGeoValidationLayer([], 'none', `vector_validation_error: ${error.message}`);
    }
  }

  private async validateCandidatesAgainstBackend(
    backend: VectorBackend,
    candidates: NormalizedLocationHierarchy[],
    tweetId: string
  ): Promise<{ locations: string[]; error?: string }> {
    const validatedLocations: string[] = [];
    let lastError: string | undefined;

    for (const candidate of candidates) {
      const contextString = formatHierarchyForContext(candidate.originalTokens);

      try {
        const resultLabel = backend.toUpperCase();
        console.log(
          `  🔍 ${resultLabel} search for ${tweetId} candidate "${contextString}" (query="${candidate.query}")`
        );

        const searchResults =
          backend === 'faiss'
            ? await this.searchFAISS(candidate.query)
            : await this.searchMilvus(candidate.query);

        const validMatches = this.filterVectorMatches(searchResults, backend);

        if (validMatches.length > 0) {
          validatedLocations.push(contextString);
          console.log(`  ✅ ${resultLabel} validated hierarchy "${contextString}" for tweet ${tweetId}`);
        } else {
          console.warn(
            `  ⚠️ ${resultLabel} found no valid matches for "${contextString}" in tweet ${tweetId}`
          );
        }
      } catch (searchError: any) {
        const message = searchError?.message || 'unknown_error';
        lastError = message;
        console.warn(
          `  ⚠️ ${backend.toUpperCase()} search failed for "${contextString}" in tweet ${tweetId}:`,
          message
        );
      }
    }

    return { locations: validatedLocations, error: lastError };
  }

  private buildGeoValidationLayer(
    locations: string[],
    backend: VectorBackend | 'none',
    error?: string
  ): LayerResult {
    const geoVerified = locations.length > 0;
    return {
      layer: 'faiss',
      event_type: 'geo_validation',
      confidence: geoVerified ? 0.9 : 0.1,
      locations,
      people_mentioned: [],
      organizations: [],
      schemes_mentioned: [],
      geo_verified: geoVerified,
      geo_backend: backend,
      ...(error ? { error } : {})
    };
  }

  private filterVectorMatches(results: VectorMatch[], backend: VectorBackend): VectorMatch[] {
    const threshold = backend === 'milvus' ? 0.65 : 0.7;
    return results.filter(result => typeof result.score === 'number' && result.score >= threshold);
  }

  /**
   * Search FAISS for location validation
   */
  private async searchFAISS(query: string): Promise<any[]> {
    const apiUrl = process.env.API_BASE || 'http://localhost:3000';
    const response = await fetch(`${apiUrl}/api/labs/faiss/search?q=${encodeURIComponent(query)}&limit=3`);

    if (!response.ok) {
      throw new Error(`FAISS API returned ${response.status}`);
    }

    return await response.json();
  }

  private async searchMilvus(query: string): Promise<VectorMatch[]> {
    try {
      const results: MilvusSearchResult[] = await searchMilvusLocations(query, 3);
      return results;
    } catch (error: any) {
      throw new Error(error?.message || 'milvus_search_failed');
    }
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
    const matches = new Set<string>();
    const sanitizedText = tweetText.replace(/[“”"']/g, '').trim();

    const contextualPattern =
      /(?:ग्राम|गांव|गाँव|ward|वार्ड|ब्लॉक|नगर पंचायत|नगर पालिका|नगर निगम|तहसील|जिला|काशी|village|block)\s*(?:number|\s*संख्या)?\s*[:\-]?\s*([A-Za-z\u0900-\u097F0-9\- ]{2,40})/gi;
    let contextualMatch: RegExpExecArray | null;
    while ((contextualMatch = contextualPattern.exec(sanitizedText)) !== null) {
      const candidate = contextualMatch[1].trim();
      const normalized = this.normalizeLocationCandidate(candidate);
      if (normalized) {
        matches.add(normalized);
      }
    }

    const suffixPattern =
      /([A-Za-z\u0900-\u097F]{3,}(?:\s+[A-Za-z\u0900-\u097F]{2,})?)\s*(?:जिला|नगर निगम|नगर पालिका|नगर पंचायत|नगर|city|district|block)/gi;
    let suffixMatch: RegExpExecArray | null;
    while ((suffixMatch = suffixPattern.exec(sanitizedText)) !== null) {
      const candidate = suffixMatch[1].trim();
      const normalized = this.normalizeLocationCandidate(candidate);
      if (normalized) {
        matches.add(normalized);
      }
    }

    const coreLocations = ['रायपुर', 'रायगढ़', 'बिलासपुर', 'कोरबा', 'जांजगीर', 'chhattisgarh', 'raigarh', 'raipur'];
    coreLocations.forEach(location => {
      if (sanitizedText.toLowerCase().includes(location.toLowerCase())) {
        matches.add(location);
      }
    });

    return Array.from(matches);
  }

  private isMeaningfulLocation(candidate: string): boolean {
    if (!candidate) return false;
    if (candidate.length < 2) return false;
    if (candidate.toLowerCase().includes('specific village ward names')) {
      return false;
    }
    return true;
  }

  private normalizeLocationCandidate(candidate: string): string | null {
    if (!this.isMeaningfulLocation(candidate)) {
      return null;
    }

    const stopRegex = /(वार्ड|ward|जिला|district|नगर|city|ब्लॉक|block|nagar|nigam)/i;
    const [primary] = candidate.split(stopRegex);
    const normalized = primary.replace(/[\d\-]+$/, '').trim();

    if (!this.isMeaningfulLocation(normalized)) {
      return null;
    }

    return normalized;
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
