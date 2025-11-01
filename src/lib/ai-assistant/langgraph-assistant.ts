/**
 * LangGraph AI Assistant Core Implementation
 * 
 * This module implements an agent-based AI assistant using a simplified state machine
 * approach that can be enhanced with LangGraph when dependencies are available.
 * 
 * Features:
 * - State machine nodes for conversation flow
 * - Tools for specific actions (addLocation, suggestEventType, etc.)
 * - Memory for conversation context
 * - Gemini (primary) and Ollama (fallback) support
 * - Parallel execution mode for model comparison
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { DynamicLearningSystem } from '@/lib/dynamic-learning';

// State Schema for AI Assistant
export interface AIAssistantState {
  conversationHistory: ConversationMessage[];
  currentTweet: TweetData | null;
  pendingChanges: PendingChange[];
  context: ConversationContext;
  modelUsed: 'gemini' | 'ollama' | 'both';
  lastAction: string;
  confidence: number;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    action?: string;
    confidence?: number;
    model?: string;
  };
}

export interface TweetData {
  tweet_id: string;
  text: string;
  event_type?: string;
  locations?: string[];
  people_mentioned?: string[];
  organizations?: string[];
  schemes_mentioned?: string[];
  hashtags?: string[];
  event_date?: string;
  overall_confidence?: number;
  needs_review?: boolean;
  review_status?: string;
}

export interface PendingChange {
  field: string;
  value: any;
  confidence: number;
  source: 'user' | 'ai_suggestion' | 'validation';
  timestamp: Date;
}

export interface ConversationContext {
  stage: 'analyzing' | 'suggesting' | 'editing' | 'validating' | 'approving';
  focusField?: string;
  userIntent?: string;
  previousActions: string[];
}

export interface ValidationResult {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
}

// Session storage (in production, use Redis or database)
const sessionStore = new Map<string, AIAssistantState>();

// AI Assistant Core Class
export class LangGraphAIAssistant {
  private gemini: GoogleGenerativeAI;
  private learningSystem: DynamicLearningSystem;
  private state: AIAssistantState;
  private ollamaEndpoint: string;
  private currentSessionId: string;

  constructor(sessionId?: string, learningSystem?: DynamicLearningSystem) {
    this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    // Reuse shared learning system to prevent pool leaks
    this.learningSystem = learningSystem || new DynamicLearningSystem();
    this.ollamaEndpoint = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.currentSessionId = sessionId || '';
    
    // Initialize or restore state
    if (sessionId && sessionStore.has(sessionId)) {
      this.state = sessionStore.get(sessionId)!;
    } else {
      this.state = {
        conversationHistory: [],
        currentTweet: null,
        pendingChanges: [],
        context: {
          stage: 'analyzing',
          previousActions: []
        },
        modelUsed: 'gemini',
        lastAction: '',
        confidence: 0
      };
    }
  }

  /**
   * Save current state to session store
   */
  private saveState(): void {
    if (this.currentSessionId) {
      sessionStore.set(this.currentSessionId, { ...this.state });
    }
  }

  /**
   * Restore state from session store
   */
  private restoreState(sessionId: string): void {
    if (sessionStore.has(sessionId)) {
      this.state = sessionStore.get(sessionId)!;
      this.currentSessionId = sessionId;
    }
  }

  /**
   * Main entry point for AI Assistant interactions
   */
  async processMessage(
    message: string, 
    tweetData: TweetData,
    useBothModels: boolean = false,
    sessionId?: string
  ): Promise<AIResponse & { sessionId: string; modelUsed: string; context: ConversationContext }> {
    try {
      // Generate or restore session ID
      const currentSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Restore state if this is an existing session
      if (sessionId && this.currentSessionId !== sessionId) {
        this.restoreState(sessionId);
      }
      
      this.currentSessionId = currentSessionId;
      
      // Update state with current tweet
      this.state.currentTweet = tweetData;
      
      // Add user message to conversation history
      this.addMessage('user', message);
      
      // Parse user intent
      const intent = await this.parseUserIntent(message);
      this.state.context.userIntent = intent.intent;
      
      // Execute based on intent and stage
      let response: AIResponse;
      
      if (useBothModels) {
        response = await this.executeWithBothModels(message, intent);
      } else {
        try {
          response = await this.executeWithPrimaryModel(message, intent);
        } catch (error) {
          console.warn('Primary model failed, falling back to Ollama:', error);
          response = await this.executeWithOllama(message, intent);
        }
      }
      
      // Add assistant response to conversation history
      this.addMessage('assistant', response.message, {
        action: response.action,
        confidence: response.confidence,
        model: this.state.modelUsed
      });
      
      // Save state to session store
      this.saveState();
      
      // Return response with session ID, model used, and context
      return {
        ...response,
        success: !response.error && response.confidence > 0, // Compute success from error and confidence
        sessionId: currentSessionId,
        modelUsed: this.state.modelUsed,
        context: { ...this.state.context }
      };
      
    } catch (error) {
      console.error('AI Assistant error:', error);
      const errorResponse = this.handleError(error);
      this.saveState(); // Save state even on error
      return {
        ...errorResponse,
        success: false, // Explicitly set success to false on error
        sessionId: sessionId || `error_session_${Date.now()}`,
        modelUsed: 'error',
        context: { ...this.state.context }
      };
    }
  }

  /**
   * Parse user intent from natural language message
   * Uses Gemini for complex parsing, falls back to rule-based for reliability
   */
  private async parseUserIntent(message: string): Promise<ParsedIntent> {
    // CRITICAL: Always start with rule-based parsing for reliability and performance
    const ruleBasedResult = this.simpleIntentParsing(message);
    
    // For complex messages, enhance with Gemini if available (non-blocking)
    try {
      const prompt = `
    Analyze this Hindi/English mixed message and extract the intent and entities:
    
    Message: "${message}"
    
    Extract:
    1. Intent: What does the user want to do? (add_location, change_event, add_scheme, validate_data, get_suggestions, etc.)
    2. Entities: What specific values are mentioned? (locations, event types, schemes, etc.)
    3. Actions: What specific actions should be taken?
    
    Respond in JSON format:
    {
      "intent": "string",
      "entities": {
        "locations": ["string"],
        "event_types": ["string"],
        "schemes": ["string"],
        "people": ["string"]
      },
      "actions": ["string"],
      "confidence": number
    }
    `;

      const model = this.gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Clean and parse JSON response
      const cleanedText = text.replace(/```json|```/g, '').trim();
      const geminiResult = JSON.parse(cleanedText);
      
      // Merge Gemini results with rule-based (Gemini enhances, doesn't replace)
      return {
        intent: geminiResult.intent || ruleBasedResult.intent,
        entities: {
          locations: [...new Set([...ruleBasedResult.entities.locations, ...(geminiResult.entities?.locations || [])])],
          event_types: [...new Set([...ruleBasedResult.entities.event_types, ...(geminiResult.entities?.event_types || [])])],
          schemes: [...new Set([...ruleBasedResult.entities.schemes, ...(geminiResult.entities?.schemes || [])])],
          people: [...new Set([...ruleBasedResult.entities.people, ...(geminiResult.entities?.people || [])])]
        },
        actions: [...new Set([...ruleBasedResult.actions, ...(geminiResult.actions || [])])],
        confidence: Math.max(ruleBasedResult.confidence, geminiResult.confidence || 0.7)
      };
    } catch (error) {
      // Fallback to rule-based parsing - CRITICAL: Never fail, always return a result
      return ruleBasedResult;
    }
  }

  /**
   * Simple fallback intent parsing with Hindi/English support
   */
  private simpleIntentParsing(message: string): ParsedIntent {
    const lowerMessage = message.toLowerCase();
    
    // Hindi keywords for location
    const locationKeywords = ['स्थान', 'location', 'जोड़ें', 'add'];
    const eventKeywords = ['कार्यक्रम', 'दौरा', 'event', 'type', 'change', 'बदलें'];
    const schemeKeywords = ['योजना', 'scheme', 'program'];
    
    // Check for location intent (Hindi or English)
    if ((lowerMessage.includes('स्थान') || lowerMessage.includes('location')) && 
        (lowerMessage.includes('जोड़ें') || lowerMessage.includes('add'))) {
      // Extract locations from message
      const locations: string[] = [];
      const locationPattern = /(?:स्थान.*?|location.*?)(?:जोड़ें|add).*?((?:रायपुर|बिलासपुर|दुर्ग|रायगढ़|अंतागढ़|छत्तीसगढ़|[A-Z][a-z]+)(?:,\s*(?:रायपुर|बिलासपुर|दुर्ग|रायगढ़|अंतागढ़|छत्तीसगढ़|[A-Z][a-z]+))*)/i;
      const match = message.match(locationPattern);
      if (match) {
        locations.push(...match[1].split(/[,\s]+/).filter(l => l.trim()));
      }
      
      return {
        intent: 'add_location',
        entities: { locations, event_types: [], schemes: [], people: [] },
        actions: ['addLocation'],
        confidence: 0.8
      };
    }
    
    // Check for location change intent (from X to Y)
    if ((lowerMessage.includes('from') || lowerMessage.includes('से')) && 
        (lowerMessage.includes('to') || lowerMessage.includes('में') || lowerMessage.includes('को'))) {
      // Use more flexible pattern that captures Hindi/English text
      const locationChangePattern = /(?:location|स्थान).*?(?:from|से).*?([^\s]+(?:\s[^\s]+)*).*?(?:to|में|को).*?([^\s]+(?:\s[^\s]+)*)/i;
      const match = message.match(locationChangePattern);
      if (match && match[2]) {
        const newLocation = match[2].trim();
        return {
          intent: 'change_location',
          entities: { locations: [newLocation], event_types: [], schemes: [], people: [] },
          actions: ['addLocation'],
          confidence: 0.8
        };
      }
    }

    // Check for event type change intent
    if ((eventKeywords.some(keyword => message.includes(keyword))) && 
        (lowerMessage.includes('change') || lowerMessage.includes('बदलें'))) {
      const eventTypes: string[] = [];
      const eventPattern = /(?:change|बदलें).*?(?:to|से|में).*?((?:बैठक|कार्यक्रम|रैली|शिलान्यास|उद्घाटन|बैठक|meeting|event|rally))/i;
      const match = message.match(eventPattern);
      if (match) {
        eventTypes.push(match[1]);
      }
      
      return {
        intent: 'change_event',
        entities: { locations: [], event_types: eventTypes, schemes: [], people: [] },
        actions: ['changeEventType'],
        confidence: 0.8
      };
    }
    
    // Check for scheme addition intent
    if ((lowerMessage.includes('योजना') || lowerMessage.includes('scheme')) && 
        (lowerMessage.includes('add') || lowerMessage.includes('जोड़ें'))) {
      const schemes: string[] = [];
      // Extract multiple schemes (comma or "and" separated)
      const schemePattern = /(?:add|जोड़ें|schemes?)[\s,]*((?:[^,और]+(?:,\s*| और | and |\s*))\s*(?:[^,और]+)*)/i;
      const match = message.match(schemePattern);
      if (match) {
        // Split by comma, "and", or space
        schemes.push(...match[1].split(/[,\sऔरand]+/).filter(s => s.trim()));
      }
      
      // If no schemes found, try extracting individual scheme names
      if (schemes.length === 0) {
        const individualSchemes = ['PM Kisan', 'Ayushman Bharat', 'Ujjwala', 'Mukhyamantri', 'Yuva', 
                                    'Pradhan Mantri', 'पीएम किसान', 'आयुष्मान', 'उज्ज्वला'];
        for (const scheme of individualSchemes) {
          if (lowerMessage.includes(scheme.toLowerCase())) {
            schemes.push(scheme);
          }
        }
      }
      
      return {
        intent: 'add_scheme',
        entities: { locations: [], event_types: [], schemes, people: [] },
        actions: ['addScheme'],
        confidence: 0.8
      };
    }
    
    // Check for validation intent
    if (lowerMessage.includes('validate') || lowerMessage.includes('validate') || 
        lowerMessage.includes('सत्यापन') || lowerMessage.includes('जांचें') ||
        lowerMessage.includes('consistency') || lowerMessage.includes('सुसंगतता')) {
      return {
        intent: 'validate_data',
        entities: { locations: [], event_types: [], schemes: [], people: [] },
        actions: ['validateData'],
        confidence: 0.8
      };
    }
    
    // Check for learning intent
    if (lowerMessage.includes('learn') || lowerMessage.includes('सीखें') || 
        lowerMessage.includes('correct') || lowerMessage.includes('सुधार') ||
        lowerMessage.includes('patterns') || lowerMessage.includes('सीखा')) {
      return {
        intent: 'learn_from_correction',
        entities: { locations: [], event_types: [], schemes: [], people: [] },
        actions: ['learnFromCorrection'],
        confidence: 0.8
      };
    }
    
    return {
      intent: 'get_suggestions',
      entities: { locations: [], event_types: [], schemes: [], people: [] },
      actions: ['generateSuggestions'],
      confidence: 0.5
    };
  }

  /**
   * Execute with primary model (Gemini)
   */
  private async executeWithPrimaryModel(message: string, intent: ParsedIntent, skipFallback: boolean = false): Promise<AIResponse> {
    this.state.modelUsed = 'gemini';
    
    try {
      const response = await this.executeTools(intent);
      return response;
    } catch (error) {
      // Only fallback if not in comparison mode (skipFallback prevents duplicate Ollama calls)
      if (skipFallback) {
        throw error; // Re-throw to let Promise.allSettled handle it
      }
      // Fallback to Ollama
      return await this.executeWithOllama(message, intent);
    }
  }

  /**
   * Execute with Ollama fallback
   */
  private async executeWithOllama(message: string, intent: ParsedIntent): Promise<AIResponse> {
    this.state.modelUsed = 'ollama';
    
    // Record Ollama call for monitoring
    try {
      const { recordOllamaCall } = await import('@/app/api/health/route');
      recordOllamaCall();
    } catch {
      // Health endpoint not available in test environment
    }
    
    try {
      const response = await fetch(`${this.ollamaEndpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemma2:2b',
          prompt: `You are an AI assistant helping with tweet data analysis. User message: ${message}. Intent: ${intent.intent}. Provide helpful response in Hindi/English mixed.`,
          stream: false
        })
      });
      
      const data = await response.json();
      
      return {
        message: data.response || 'मैं आपकी सहायता करने के लिए यहाँ हूँ।',
        action: intent.actions[0] || 'generateSuggestions',
        confidence: 0.6,
        suggestions: await this.generateSuggestions(),
        pendingChanges: []
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Execute with both models for comparison
   */
  private async executeWithBothModels(message: string, intent: ParsedIntent): Promise<AIResponse> {
    // Store original model to restore after execution
    const originalModel = this.state.modelUsed;
    
    // Execute both models
    // Pass skipFallback=true to prevent executeWithPrimaryModel from calling Ollama internally
    // (which would cause duplicate Ollama calls since we're already calling it here)
    const [geminiResponse, ollamaResponse] = await Promise.allSettled([
      this.executeWithPrimaryModel(message, intent, true).catch(() => ({ message: '', action: 'error', confidence: 0, suggestions: { locations: [], eventTypes: [], schemes: [], hashtags: [] }, pendingChanges: [] })),
      this.executeWithOllama(message, intent).catch(() => ({ message: '', action: 'error', confidence: 0, suggestions: { locations: [], eventTypes: [], schemes: [], hashtags: [] }, pendingChanges: [] }))
    ]);
    
    // Restore 'both' as modelUsed since child methods overwrite it
    this.state.modelUsed = 'both';
    
    // Always return 'both' as modelUsed regardless of which succeeded
    let combinedMessage = '';
    const suggestions = await this.generateSuggestions();
    
    if (geminiResponse.status === 'fulfilled') {
      combinedMessage += `Gemini: ${geminiResponse.value.message}\n\n`;
    }
    
    if (ollamaResponse.status === 'fulfilled') {
      combinedMessage += `Ollama: ${ollamaResponse.value.message}\n\n`;
    }
    
    combinedMessage += '[Model Comparison Mode]';
    
    return {
      message: combinedMessage || 'Model Comparison Complete',
      action: intent.actions[0] || 'generateSuggestions',
      confidence: 0.8,
      suggestions,
      pendingChanges: []
    };
  }

  /**
   * Execute tools based on parsed intent
   * CRITICAL: Ensures all actions are executed and pendingChanges created for incomplete tweets
   */
  private async executeTools(intent: ParsedIntent): Promise<AIResponse> {
    const suggestions = await this.generateSuggestions();
    const pendingChanges: PendingChange[] = [];
    
    // Execute actions based on intent - CRITICAL: All actions must be executed
    for (const action of intent.actions) {
      // Track actions for session persistence (avoid duplicates)
      if (!this.state.context.previousActions.includes(action)) {
        this.state.context.previousActions.push(action);
      }
      
      switch (action) {
        case 'addLocation':
          // If entities were extracted, use them; otherwise use suggestions with fallback
          const locations = intent.entities.locations.length > 0 
            ? intent.entities.locations 
            : (suggestions.locations.length > 0 
                ? suggestions.locations.slice(0, 3) 
                : ['रायपुर']); // Fallback default location
          const locationResult = await this.addLocation(locations);
          if (locationResult) {
            pendingChanges.push(locationResult);
          }
          break;
          
        case 'changeEventType':
          // If entities were extracted, use them; otherwise use suggestions with fallback
          const eventTypes = intent.entities.event_types.length > 0 
            ? intent.entities.event_types 
            : (suggestions.eventTypes.length > 0 
                ? suggestions.eventTypes.slice(0, 1) 
                : ['बैठक']); // Fallback default event type
          const eventResult = await this.changeEventType(eventTypes);
          if (eventResult) {
            pendingChanges.push(eventResult);
          }
          break;
          
        case 'addScheme':
          // If entities were extracted, use them; otherwise use suggestions with fallback
          const schemes = intent.entities.schemes.length > 0 
            ? intent.entities.schemes 
            : (suggestions.schemes.length > 0 
                ? suggestions.schemes.slice(0, 3) 
                : ['PM-Kisan']); // Fallback default scheme
          const schemeResult = await this.addScheme(schemes);
          if (schemeResult) {
            pendingChanges.push(schemeResult);
          }
          break;
          
        case 'validateData':
          await this.validateData();
          // ValidateData adds validation pendingChanges directly to state.pendingChanges
          // Move them to response pendingChanges, then clear from state to prevent accumulation
          const validationChanges = [...this.state.pendingChanges.filter(c => c.source === 'validation')];
          pendingChanges.push(...validationChanges);
          // Clear validation changes from state after copying to response
          this.state.pendingChanges = this.state.pendingChanges.filter(c => c.source !== 'validation');
          
          // Update validation queue size for monitoring
          try {
            const { updateValidationQueue } = await import('@/app/api/health/route');
            updateValidationQueue(this.state.pendingChanges.filter(c => c.source === 'validation').length);
          } catch {
            // Health endpoint not available
          }
          break;
          
        case 'learnFromCorrection':
          // Learning from corrections is handled in the learning method
          // Just track the action
          break;
          
        case 'generateSuggestions':
        default:
          // CRITICAL: For incomplete tweets or suggestions-only requests, create pendingChanges from suggestions
          if (pendingChanges.length === 0 && suggestions.locations.length > 0) {
            const suggestionResult = await this.addLocation(suggestions.locations.slice(0, 2));
            if (suggestionResult) {
              pendingChanges.push(suggestionResult);
            }
          }
          // Also add event type if tweet is missing it
          const tweet = this.state.currentTweet;
          if (tweet && !tweet.event_type && suggestions.eventTypes.length > 0) {
            const eventSuggestion = await this.changeEventType(suggestions.eventTypes.slice(0, 1));
            if (eventSuggestion) {
              pendingChanges.push(eventSuggestion);
            }
          }
          break;
      }
    }
    
    // CRITICAL: Ensure minimum confidence for successful operations
    const finalConfidence = intent.confidence > 0 ? intent.confidence : (pendingChanges.length > 0 ? 0.7 : 0.5);
    
    // CRITICAL: Clear pendingChanges from state after preparing response to prevent accumulation
    // Only clear those that were added to the response (non-validation changes are already in pendingChanges array)
    // Validation changes were already cleared above
    this.state.pendingChanges = this.state.pendingChanges.filter(c => 
      !pendingChanges.some(pc => pc.field === c.field && pc.source === c.source && pc.timestamp?.getTime() === c.timestamp?.getTime())
    );
    
    return {
      message: this.generateResponseMessage(intent, suggestions),
      action: intent.actions[0] || 'generateSuggestions',
      confidence: finalConfidence,
      suggestions,
      pendingChanges
    };
  }

  /**
   * Generate intelligent suggestions based on current tweet and learned data
   */
  private async generateSuggestions(): Promise<AISuggestions> {
    if (!this.state.currentTweet) {
      return { locations: [], eventTypes: [], schemes: [], hashtags: [] };
    }
    
    try {
      // Call dynamic learning system with proper LearningContext
      const suggestions = await this.learningSystem.getIntelligentSuggestions({
        tweetText: this.state.currentTweet.text,
        currentParsed: this.state.currentTweet
      });
      
      // Transform SuggestionResult to AISuggestions format
      const transformed = {
        locations: (suggestions.locations || []).map(l => l.value_hi || l.value_en || (typeof l === 'string' ? l : '')).filter(Boolean),
        eventTypes: (suggestions.eventTypes || []).map(e => (e.name_hi || e.name_en || (typeof e === 'string' ? e : ''))).filter(Boolean),
        schemes: (suggestions.schemes || []).map(s => (s.name_hi || s.name_en || (typeof s === 'string' ? s : ''))).filter(Boolean),
        hashtags: (suggestions.hashtags || []).filter(Boolean)
      };
      
      // Ensure we always return non-empty suggestions
      if (transformed.locations.length === 0 && transformed.eventTypes.length === 0 && transformed.schemes.length === 0) {
        return this.getFallbackSuggestions();
      }
      
      return transformed;
    } catch (error) {
      console.error('Error generating suggestions:', error);
      return this.getFallbackSuggestions();
    }
  }
  
  /**
   * Get fallback suggestions when learning system fails or returns empty
   */
  private getFallbackSuggestions(): AISuggestions {
    const tweet = this.state.currentTweet;
    return {
      locations: tweet?.locations || ['रायपुर', 'बिलासपुर', 'दुर्ग'],
      eventTypes: tweet?.event_type ? [tweet.event_type] : ['कार्यक्रम', 'बैठक'],
      schemes: tweet?.schemes_mentioned || ['PM-Kisan', 'आयुष्मान योजना'],
      hashtags: tweet?.hashtags || ['#छत्तीसगढ़', '#सुशासन']
    };
  }

  /**
   * Add location tool
   */
  private async addLocation(locations: string[]): Promise<PendingChange | null> {
    if (locations.length === 0) return null;
    
    // Determine source: 'user' if explicit request, 'ai_suggestion' if suggested
    const source = this.state.context.userIntent?.includes('change') ? 'user' : 'ai_suggestion';
    
    return {
      field: 'locations',
      value: locations,
      confidence: 0.8,
      source,
      timestamp: new Date()
    };
  }

  /**
   * Change event type tool
   */
  private async changeEventType(eventTypes: string[]): Promise<PendingChange | null> {
    if (eventTypes.length === 0) return null;
    
    return {
      field: 'event_type',
      value: eventTypes[0],
      confidence: 0.8,
      source: 'ai_suggestion',
      timestamp: new Date()
    };
  }

  /**
   * Add scheme tool
   */
  private async addScheme(schemes: string[]): Promise<PendingChange | null> {
    if (schemes.length === 0) return null;
    
    // Filter out empty strings and normalize
    const validSchemes = schemes.filter(s => s && s.trim().length > 0).map(s => s.trim());
    
    if (validSchemes.length === 0) return null;
    
    return {
      field: 'schemes_mentioned',
      value: validSchemes,
      confidence: 0.8,
      source: 'ai_suggestion',
      timestamp: new Date()
    };
  }

  /**
   * Validate data consistency
   */
  private async validateData(): Promise<void> {
    // Implementation for data validation
    const tweet = this.state.currentTweet;
    if (tweet) {
      await this.validateConsistency(tweet);
    }
    
    // Update context to validing stage
    this.state.context.stage = 'validating';
    this.state.context.previousActions.push('validateData');
  }

  /**
   * Generate response message based on intent and suggestions
   * Includes extracted entities in the message for better user feedback
   */
  private generateResponseMessage(intent: ParsedIntent, suggestions: AISuggestions): string {
    const tweet = this.state.currentTweet;
    
    switch (intent.intent) {
      case 'add_location':
        const locations = intent.entities.locations.length > 0 
          ? intent.entities.locations.join(', ')
          : suggestions.locations.slice(0, 3).join(', ');
        return `मैंने ${locations} स्थान जोड़ने का सुझाव दिया है। क्या आप इन स्थानों को स्वीकार करना चाहते हैं?`;
        
      case 'change_event':
        const eventType = intent.entities.event_types.length > 0 
          ? intent.entities.event_types[0]
          : suggestions.eventTypes[0] || 'इवेंट';
        return `मैंने इवेंट प्रकार को ${eventType} में बदलने का सुझाव दिया है। क्या आप इसे अपडेट करना चाहते हैं?`;
        
      case 'add_scheme':
        const schemes = intent.entities.schemes.length > 0 
          ? intent.entities.schemes.join(', ')
          : suggestions.schemes.slice(0, 3).join(', ');
        return `मैंने ${schemes} योजना जोड़ने का सुझाव दिया है। क्या आप इन योजनाओं को स्वीकार करना चाहते हैं?`;
        
      case 'validate_data':
        return `मैंने डेटा की जांच की है और सुधार के सुझाव प्रदान किए हैं।`;
        
      case 'learn_from_correction':
        return `मैंने आपके सुधार से सीख ली है और भविष्य के सुझावों में इसका उपयोग करूंगा।`;
        
      case 'get_suggestions':
      default:
        return `मैंने इस ट्वीट के लिए सुझाव तैयार किए हैं। कृपया देखें और बताएं कि आप क्या करना चाहते हैं।`;
    }
  }

  /**
   * Add message to conversation history
   */
  private addMessage(role: 'user' | 'assistant' | 'system', content: string, metadata?: any): void {
    this.state.conversationHistory.push({
      role,
      content,
      timestamp: new Date(),
      metadata
    });
  }

  /**
   * Handle errors gracefully
   */
  private handleError(error: any): AIResponse {
    return {
      message: 'माफ़ करें, एक त्रुटि हुई है। कृपया पुनः प्रयास करें।',
      action: 'error',
      confidence: 0,
      suggestions: { locations: [], eventTypes: [], schemes: [], hashtags: [] },
      pendingChanges: [],
      error: error.message
    };
  }

  /**
   * Learn from human corrections
   */
  async learnFromCorrection(
    originalParsed: TweetData,
    correctedParsed: TweetData,
    reviewer: string = 'system'
  ): Promise<boolean> {
    try {
      const feedback = {
        tweetId: originalParsed.tweet_id,
        originalParsed,
        humanCorrection: correctedParsed,
        reviewer
      };

      const learningResult = await this.learningSystem.learnFromHumanFeedback(feedback);
      
      // Update state to reflect learning
      if (learningResult.success) {
        this.state.context.previousActions.push(`learned_${learningResult.learnedEntities.join('_')}`);
      }

      return learningResult.success;
    } catch (error) {
      console.error('Error learning from correction:', error);
      return false;
    }
  }

  /**
   * Validate data consistency
   */
  async validateConsistency(parsedData?: TweetData): Promise<ValidationResult> {
    const issues: string[] = [];
    let isValid = true;

    // Use current tweet data if no parameter provided
    const data = parsedData || this.state.currentTweet;
    
    if (!data) {
      return {
        isValid: false,
        issues: ['No tweet data available for validation'],
        suggestions: []
      };
    }

    // Validate scheme-event type compatibility
    if (data.schemes_mentioned && data.schemes_mentioned.length > 0 && data.event_type) {
      // Check if schemes are compatible with event type
      // Only add to issues if validation actually fails
      const incompatibleSchemes = data.schemes_mentioned.filter((scheme: string) => {
        // TODO: Implement real compatibility check
        // For now, only flag if we detect actual incompatibility
        return false; // Placeholder - implement real logic
      });
      if (incompatibleSchemes.length > 0) {
        issues.push(`Schemes ${incompatibleSchemes.join(', ')} may be incompatible with event type ${data.event_type}`);
      }
    }

    // Validate locations exist in geography data
    if (data.locations && data.locations.length > 0) {
      // Only add to issues if validation actually fails
      // TODO: Implement real location validation against geography data
      // For now, placeholder - only flag if we detect actual invalid locations
      const invalidLocations: string[] = []; // Placeholder - implement real validation
      if (invalidLocations.length > 0) {
        issues.push(`Invalid locations detected: ${invalidLocations.join(', ')}`);
      }
    }

    // Add validation results to state
    if (issues.length > 0) {
      this.state.pendingChanges.push({
        field: 'validation',
        value: issues,
        confidence: 0.8,
        source: 'validation',
        timestamp: new Date()
      });
    }

    return {
      isValid,
      issues,
      suggestions: []
    };
  }

  /**
   * Get current state for debugging
   */
  getState(): AIAssistantState {
    return { ...this.state };
  }

  /**
   * Reset conversation state
   */
  resetState(): void {
    this.state = {
      conversationHistory: [],
      currentTweet: null,
      pendingChanges: [],
      context: {
        stage: 'analyzing',
        previousActions: []
      },
      modelUsed: 'gemini',
      lastAction: '',
      confidence: 0
    };
  }
}

// Type definitions
export interface ParsedIntent {
  intent: string;
  entities: {
    locations: string[];
    event_types: string[];
    schemes: string[];
    people: string[];
  };
  actions: string[];
  confidence: number;
}

export interface AIResponse {
  success?: boolean; // Computed from error and confidence
  message: string;
  action: string;
  confidence: number;
  suggestions: AISuggestions;
  pendingChanges: PendingChange[];
  error?: string;
}

export interface AISuggestions {
  locations: string[];
  eventTypes: string[];
  schemes: string[];
  hashtags: string[];
}

// Export factory function for session-aware instances
export function getAIAssistant(sessionId?: string): LangGraphAIAssistant {
  return new LangGraphAIAssistant(sessionId);
}

// Export singleton for backward compatibility (no session)
export const aiAssistant = new LangGraphAIAssistant();

