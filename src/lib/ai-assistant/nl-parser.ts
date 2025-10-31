/**
 * Natural Language Parser for Hindi/English Mixed Requests
 * 
 * This module parses natural language requests in Hindi/English mixed format
 * and extracts intent, entities, and actions for the AI Assistant.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Parser interfaces
export interface ParsedRequest {
  intent: IntentType;
  entities: ExtractedEntities;
  actions: ActionType[];
  confidence: number;
  originalMessage: string;
  language: 'hindi' | 'english' | 'mixed';
  complexity: 'simple' | 'complex';
}

export interface ExtractedEntities {
  locations: EntityMatch[];
  eventTypes: EntityMatch[];
  schemes: EntityMatch[];
  people: EntityMatch[];
  hashtags: EntityMatch[];
  numbers: EntityMatch[];
  dates: EntityMatch[];
}

export interface EntityMatch {
  text: string;
  confidence: number;
  startIndex: number;
  endIndex: number;
  normalized?: string;
}

export type IntentType = 
  | 'add_location'
  | 'change_event'
  | 'add_scheme'
  | 'add_people'
  | 'generate_hashtags'
  | 'validate_data'
  | 'get_suggestions'
  | 'edit_field'
  | 'approve_changes'
  | 'reject_changes'
  | 'clear_data'
  | 'help'
  | 'unknown';

export type ActionType =
  | 'addLocation'
  | 'changeEventType'
  | 'addScheme'
  | 'addPeople'
  | 'generateHashtags'
  | 'validateData'
  | 'generateSuggestions'
  | 'editField'
  | 'approveChanges'
  | 'rejectChanges'
  | 'clearData'
  | 'showHelp';

// Natural Language Parser Class
export class NaturalLanguageParser {
  private gemini: GoogleGenerativeAI;
  private hindiKeywords!: { [key: string]: string[] }; // Initialized in initializeKeywords()
  private englishKeywords!: { [key: string]: string[] }; // Initialized in initializeKeywords()

  constructor() {
    this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    this.initializeKeywords();
  }

  /**
   * Parse natural language request
   */
  async parseRequest(message: string | null | undefined): Promise<ParsedRequest> {
    try {
      // Handle null/undefined/empty input with low confidence
      if (!message || (typeof message === 'string' && message.trim().length === 0)) {
        return {
          intent: 'get_suggestions',
          entities: { locations: [], eventTypes: [], schemes: [], people: [], hashtags: [], numbers: [], dates: [] },
          actions: ['generateSuggestions'],
          confidence: 0.2, // Very low confidence for empty/null input
          originalMessage: message || '',
          language: 'mixed',
          complexity: 'simple'
        };
      }
      
      // Detect language
      const language = this.detectLanguage(message);
      
      // Parse with Gemini for complex requests
      if (this.isComplexRequest(message)) {
        return await this.parseWithGemini(message, language);
      }
      
      // Use rule-based parsing for simple requests
      return this.parseWithRules(message, language);
    } catch (error) {
      console.error('NL Parser error:', error);
      return this.createFallbackParse(message || '');
    }
  }

  /**
   * Parse with Gemini AI for complex requests
   */
  private async parseWithGemini(message: string, language: string): Promise<ParsedRequest> {
    const prompt = `
    Parse this Hindi/English mixed message and extract structured information:
    
    Message: "${message}"
    
    Extract the following:
    1. Intent: What does the user want to do?
    2. Entities: Extract locations, event types, schemes, people, hashtags, numbers, dates
    3. Actions: What specific actions should be taken?
    4. Confidence: How confident are you in this parsing?
    
    Intent options: add_location, change_event, add_scheme, add_people, generate_hashtags, validate_data, get_suggestions, edit_field, approve_changes, reject_changes, clear_data, help, unknown
    
    Action options: addLocation, changeEventType, addScheme, addPeople, generateHashtags, validateData, generateSuggestions, editField, approveChanges, rejectChanges, clearData, showHelp
    
    Respond in JSON format:
    {
      "intent": "string",
      "entities": {
        "locations": [{"text": "string", "confidence": number, "startIndex": number, "endIndex": number, "normalized": "string"}],
        "eventTypes": [{"text": "string", "confidence": number, "startIndex": number, "endIndex": number, "normalized": "string"}],
        "schemes": [{"text": "string", "confidence": number, "startIndex": number, "endIndex": number, "normalized": "string"}],
        "people": [{"text": "string", "confidence": number, "startIndex": number, "endIndex": number, "normalized": "string"}],
        "hashtags": [{"text": "string", "confidence": number, "startIndex": number, "endIndex": number, "normalized": "string"}],
        "numbers": [{"text": "string", "confidence": number, "startIndex": number, "endIndex": number, "normalized": "string"}],
        "dates": [{"text": "string", "confidence": number, "startIndex": number, "endIndex": number, "normalized": "string"}]
      },
      "actions": ["string"],
      "confidence": number,
      "language": "string",
      "complexity": "string"
    }
    `;

    try {
      const model = this.gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Clean and parse JSON response
      const cleanedText = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanedText);
      
      return {
        intent: parsed.intent as IntentType,
        entities: parsed.entities,
        actions: parsed.actions as ActionType[],
        confidence: parsed.confidence || 0.7,
        originalMessage: message,
        language: parsed.language as 'hindi' | 'english' | 'mixed',
        complexity: parsed.complexity as 'simple' | 'complex'
      };
    } catch (error) {
      console.error('Gemini parsing failed:', error);
      return this.parseWithRules(message, language);
    }
  }

  /**
   * Parse with rule-based approach for simple requests
   */
  private parseWithRules(message: string, language: string): ParsedRequest {
    const lowerMessage = message.toLowerCase();
    const entities = this.extractEntitiesWithRules(message);
    
    // Determine intent based on keywords
    let intent: IntentType = 'unknown';
    let actions: ActionType[] = [];
    
    if (this.containsKeywords(lowerMessage, this.hindiKeywords.add_location) || 
        this.containsKeywords(lowerMessage, this.englishKeywords.add_location)) {
      intent = 'add_location';
      actions = ['addLocation'];
    } else if (this.containsKeywords(lowerMessage, this.hindiKeywords.change_event) || 
               this.containsKeywords(lowerMessage, this.englishKeywords.change_event)) {
      intent = 'change_event';
      actions = ['changeEventType'];
    } else if (this.containsKeywords(lowerMessage, this.hindiKeywords.add_scheme) || 
               this.containsKeywords(lowerMessage, this.englishKeywords.add_scheme)) {
      intent = 'add_scheme';
      actions = ['addScheme'];
    } else if (this.containsKeywords(lowerMessage, this.hindiKeywords.generate_hashtags) || 
               this.containsKeywords(lowerMessage, this.englishKeywords.generate_hashtags)) {
      intent = 'generate_hashtags';
      actions = ['generateHashtags'];
    } else if (this.containsKeywords(lowerMessage, this.hindiKeywords.validate_data) || 
               this.containsKeywords(lowerMessage, this.englishKeywords.validate_data)) {
      intent = 'validate_data';
      actions = ['validateData'];
    } else if (this.containsKeywords(lowerMessage, this.hindiKeywords.get_suggestions) || 
               this.containsKeywords(lowerMessage, this.englishKeywords.get_suggestions)) {
      intent = 'get_suggestions';
      actions = ['generateSuggestions'];
    } else if (this.containsKeywords(lowerMessage, this.hindiKeywords.help) || 
               this.containsKeywords(lowerMessage, this.englishKeywords.help)) {
      intent = 'help';
      actions = ['showHelp'];
    } else {
      intent = 'get_suggestions';
      actions = ['generateSuggestions'];
    }

    // Adjust confidence based on message clarity and length
    let baseConfidence = 0.6;
    if (entities.locations.length > 0 || entities.eventTypes.length > 0) {
      baseConfidence = 0.75; // Higher confidence if clear entities found
    }
    if (message.trim().length < 5) {
      baseConfidence = 0.4; // Lower confidence for very short messages
    }
    
    return {
      intent,
      entities,
      actions,
      confidence: baseConfidence,
      originalMessage: message,
      language: language as 'hindi' | 'english' | 'mixed',
      complexity: 'simple'
    };
  }

  /**
   * Extract entities using rule-based approach
   */
  private extractEntitiesWithRules(message: string): ExtractedEntities {
    const entities: ExtractedEntities = {
      locations: [],
      eventTypes: [],
      schemes: [],
      people: [],
      hashtags: [],
      numbers: [],
      dates: []
    };

    // Extract locations
    entities.locations = this.extractLocations(message);
    
    // Extract event types
    entities.eventTypes = this.extractEventTypes(message);
    
    // Extract schemes
    entities.schemes = this.extractSchemes(message);
    
    // Extract people (simple pattern matching)
    entities.people = this.extractPeople(message);
    
    // Extract hashtags
    entities.hashtags = this.extractHashtags(message);
    
    // Extract numbers
    entities.numbers = this.extractNumbers(message);
    
    // Extract dates
    entities.dates = this.extractDates(message);

    return entities;
  }

  /**
   * Extract locations from message
   */
  private extractLocations(message: string): EntityMatch[] {
    const locations: EntityMatch[] = [];
    const locationPatterns = [
      'रायपुर', 'बिलासपुर', 'रायगढ़', 'दुर्ग', 'कोरबा', 'सरगुजा', 'जशपुर', 'कोरिया',
      'कांकेर', 'बस्तर', 'नारायणपुर', 'बीजापुर', 'सुकमा', 'दंतेवाड़ा', 'कोंडागांव',
      'राजनांदगांव', 'महासमुंद', 'गरियाबंद', 'बलरामपुर', 'सूरजपुर', 'बलौदा बाजार',
      'मुंगेली', 'कबीरधाम', 'जांजगीर-चंपा', 'बेमेतरा', 'बलोदाबाजार', 'गौरेला-पेंड्रा-मरवाही',
      'raipur', 'bilaspur', 'raigarh', 'durg', 'korba', 'sarguja', 'jashpur', 'korea',
      'kanker', 'bastar', 'narayanpur', 'bijapur', 'sukma', 'dantewada', 'kondagaon',
      'rajanandgaon', 'mahasamund', 'gariyaband', 'balrampur', 'surajpur', 'baloda bazar',
      'mungeli', 'kabirdham', 'janjgir-champa', 'bemetara', 'balodabazar', 'gaurela-pendra-marwahi'
    ];

    for (const location of locationPatterns) {
      const regex = new RegExp(location, 'gi');
      let match;
      while ((match = regex.exec(message)) !== null) {
        locations.push({
          text: match[0],
          confidence: 0.8,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          normalized: location.toLowerCase()
        });
      }
    }

    return locations;
  }

  /**
   * Extract event types from message
   */
  private extractEventTypes(message: string): EntityMatch[] {
    const eventTypes: EntityMatch[] = [];
    const eventPatterns = [
      'बैठक', 'कार्यक्रम', 'यात्रा', 'घोषणा', 'उद्घाटन', 'सम्मेलन', 'गोष्ठी',
      'meeting', 'program', 'visit', 'announcement', 'inauguration', 'conference', 'gathering'
    ];

    for (const eventType of eventPatterns) {
      const regex = new RegExp(eventType, 'gi');
      let match;
      while ((match = regex.exec(message)) !== null) {
        eventTypes.push({
          text: match[0],
          confidence: 0.8,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          normalized: eventType.toLowerCase()
        });
      }
    }

    return eventTypes;
  }

  /**
   * Extract schemes from message
   */
  private extractSchemes(message: string): EntityMatch[] {
    const schemes: EntityMatch[] = [];
    const schemePatterns = [
      'PM Kisan', 'Ayushman Bharat', 'Ujjwala', 'Swachh Bharat', 'Digital India',
      'PM मुद्रा', 'PM आवास', 'PM किसान', 'आयुष्मान भारत', 'उज्ज्वला',
      'स्वच्छ भारत', 'डिजिटल इंडिया', 'मुद्रा', 'आवास', 'किसान'
    ];

    for (const scheme of schemePatterns) {
      const regex = new RegExp(scheme.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      let match;
      while ((match = regex.exec(message)) !== null) {
        schemes.push({
          text: match[0],
          confidence: 0.8,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          normalized: scheme.toLowerCase()
        });
      }
    }

    return schemes;
  }

  /**
   * Extract people from message (simple pattern)
   */
  private extractPeople(message: string): EntityMatch[] {
    const people: EntityMatch[] = [];
    // Simple pattern for names (capitalized words)
    const nameRegex = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
    let match;
    while ((match = nameRegex.exec(message)) !== null) {
      people.push({
        text: match[0],
        confidence: 0.5,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        normalized: match[0].toLowerCase()
      });
    }
    return people;
  }

  /**
   * Extract hashtags from message
   */
  private extractHashtags(message: string): EntityMatch[] {
    const hashtags: EntityMatch[] = [];
    const hashtagRegex = /#[\w\u0900-\u097F]+/g;
    let match;
    while ((match = hashtagRegex.exec(message)) !== null) {
      hashtags.push({
        text: match[0],
        confidence: 0.9,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        normalized: match[0].toLowerCase()
      });
    }
    return hashtags;
  }

  /**
   * Extract numbers from message
   */
  private extractNumbers(message: string): EntityMatch[] {
    const numbers: EntityMatch[] = [];
    const numberRegex = /\b\d+\b/g;
    let match;
    while ((match = numberRegex.exec(message)) !== null) {
      numbers.push({
        text: match[0],
        confidence: 0.9,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        normalized: match[0]
      });
    }
    return numbers;
  }

  /**
   * Extract dates from message
   */
  private extractDates(message: string): EntityMatch[] {
    const dates: EntityMatch[] = [];
    const datePatterns = [
      /\d{1,2}\/\d{1,2}\/\d{4}/g, // DD/MM/YYYY
      /\d{1,2}-\d{1,2}-\d{4}/g,   // DD-MM-YYYY
      /\d{4}-\d{1,2}-\d{1,2}/g    // YYYY-MM-DD
    ];

    for (const pattern of datePatterns) {
      let match;
      while ((match = pattern.exec(message)) !== null) {
        dates.push({
          text: match[0],
          confidence: 0.8,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          normalized: match[0]
        });
      }
    }
    return dates;
  }

  /**
   * Detect language of the message
   */
  private detectLanguage(message: string): string {
    const hindiRegex = /[\u0900-\u097F]/;
    const englishRegex = /[a-zA-Z]/;
    
    const hasHindi = hindiRegex.test(message);
    const hasEnglish = englishRegex.test(message);
    
    if (hasHindi && hasEnglish) return 'mixed';
    if (hasHindi) return 'hindi';
    if (hasEnglish) return 'english';
    return 'unknown';
  }

  /**
   * Check if request is complex
   */
  private isComplexRequest(message: string): boolean {
    const complexIndicators = [
      'multiple', 'several', 'many', 'all', 'कई', 'सभी', 'बहुत',
      'and', 'also', 'तथा', 'और', 'भी',
      'complex', 'complicated', 'जटिल', 'कठिन'
    ];
    
    const lowerMessage = message.toLowerCase();
    return complexIndicators.some(indicator => lowerMessage.includes(indicator)) ||
           message.length > 100 ||
           this.countEntities(message) > 3;
  }

  /**
   * Count entities in message
   */
  private countEntities(message: string): number {
    const entities = this.extractEntitiesWithRules(message);
    return Object.values(entities).reduce((total, entityList) => total + entityList.length, 0);
  }

  /**
   * Check if message contains keywords
   */
  private containsKeywords(message: string, keywords: string[]): boolean {
    return keywords.some(keyword => message.includes(keyword));
  }

  /**
   * Create fallback parse when all else fails
   */
  private createFallbackParse(message: string): ParsedRequest {
    return {
      intent: 'get_suggestions',
      entities: {
        locations: [],
        eventTypes: [],
        schemes: [],
        people: [],
        hashtags: [],
        numbers: [],
        dates: []
      },
      actions: ['generateSuggestions'],
      confidence: 0.3,
      originalMessage: message,
      language: 'mixed',
      complexity: 'simple'
    };
  }

  /**
   * Initialize keyword dictionaries
   */
  private initializeKeywords(): void {
    this.hindiKeywords = {
      add_location: ['जोड़', 'जोड़ें', 'स्थान', 'जगह', 'शहर', 'जिला'],
      change_event: ['बदल', 'बदलें', 'घटना', 'कार्यक्रम', 'इवेंट'],
      add_scheme: ['योजना', 'स्कीम', 'कार्यक्रम', 'पहल'],
      generate_hashtags: ['हैशटैग', 'टैग', 'लेबल'],
      validate_data: ['जांच', 'सत्यापन', 'वैधता'],
      get_suggestions: ['सुझाव', 'सलाह', 'मदद', 'सहायता'],
      help: ['मदद', 'सहायता', 'सहायक', 'help']
    };

    this.englishKeywords = {
      add_location: ['add', 'location', 'place', 'city', 'district'],
      change_event: ['change', 'event', 'program', 'meeting'],
      add_scheme: ['scheme', 'program', 'initiative', 'plan'],
      generate_hashtags: ['hashtag', 'tag', 'label'],
      validate_data: ['validate', 'check', 'verify'],
      get_suggestions: ['suggest', 'suggestion', 'help', 'assist'],
      help: ['help', 'assist', 'support']
    };
  }
}

// Export singleton instance
export const nlParser = new NaturalLanguageParser();

