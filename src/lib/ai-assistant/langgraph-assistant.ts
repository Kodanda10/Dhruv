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

// Session storage (in production, use Redis or database)
const sessionStore = new Map<string, AIAssistantState>();

// AI Assistant Core Class
export class LangGraphAIAssistant {
  private gemini: GoogleGenerativeAI;
  private learningSystem: DynamicLearningSystem;
  private state: AIAssistantState;
  private ollamaEndpoint: string;
  private currentSessionId: string;

  constructor(sessionId?: string) {
    this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    this.learningSystem = new DynamicLearningSystem();
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
        response = await this.executeWithPrimaryModel(message, intent);
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
        sessionId: sessionId || `error_session_${Date.now()}`,
        modelUsed: 'error',
        context: { ...this.state.context }
      };
    }
  }

  /**
   * Parse user intent from natural language message
   */
  private async parseUserIntent(message: string): Promise<ParsedIntent> {
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

    try {
      const model = this.gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Clean and parse JSON response
      const cleanedText = text.replace(/```json|```/g, '').trim();
      return JSON.parse(cleanedText);
    } catch (error) {
      // Fallback to simple parsing
      return this.simpleIntentParsing(message);
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
      const schemePattern = /(?:add|जोड़ें).*?((?:PM Kisan|Ayushman|Ujjwala|PM Kisan|मुख्यमंत्री|युवा).*?)/i;
      const match = message.match(schemePattern);
      if (match) {
        schemes.push(match[1]);
      }
      
      return {
        intent: 'add_scheme',
        entities: { locations: [], event_types: [], schemes, people: [] },
        actions: ['addScheme'],
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
  private async executeWithPrimaryModel(message: string, intent: ParsedIntent): Promise<AIResponse> {
    this.state.modelUsed = 'gemini';
    
    try {
      const response = await this.executeTools(intent);
      return response;
    } catch (error) {
      // Fallback to Ollama
      return await this.executeWithOllama(message, intent);
    }
  }

  /**
   * Execute with Ollama fallback
   */
  private async executeWithOllama(message: string, intent: ParsedIntent): Promise<AIResponse> {
    this.state.modelUsed = 'ollama';
    
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
    this.state.modelUsed = 'both';
    
    const [geminiResponse, ollamaResponse] = await Promise.allSettled([
      this.executeWithPrimaryModel(message, intent),
      this.executeWithOllama(message, intent)
    ]);
    
    // Use Gemini response as primary, Ollama as backup
    if (geminiResponse.status === 'fulfilled') {
      return {
        ...geminiResponse.value,
        message: `${geminiResponse.value.message}\n\n[Model Comparison: Gemini (primary), Ollama (backup)]`
      };
    } else if (ollamaResponse.status === 'fulfilled') {
      return ollamaResponse.value;
    } else {
      return this.handleError(new Error('Both models failed'));
    }
  }

  /**
   * Execute tools based on parsed intent
   */
  private async executeTools(intent: ParsedIntent): Promise<AIResponse> {
    const suggestions = await this.generateSuggestions();
    const pendingChanges: PendingChange[] = [];
    
    // Execute actions based on intent
    for (const action of intent.actions) {
      switch (action) {
        case 'addLocation':
          // If entities were extracted, use them; otherwise use suggestions
          const locations = intent.entities.locations.length > 0 
            ? intent.entities.locations 
            : suggestions.locations.slice(0, 3); // Top 3 suggestions
          const locationResult = await this.addLocation(locations);
          if (locationResult) pendingChanges.push(locationResult);
          break;
          
        case 'changeEventType':
          // If entities were extracted, use them; otherwise use suggestions
          const eventTypes = intent.entities.event_types.length > 0 
            ? intent.entities.event_types 
            : suggestions.eventTypes.slice(0, 1); // Top 1 suggestion
          const eventResult = await this.changeEventType(eventTypes);
          if (eventResult) pendingChanges.push(eventResult);
          break;
          
        case 'addScheme':
          // If entities were extracted, use them; otherwise use suggestions
          const schemes = intent.entities.schemes.length > 0 
            ? intent.entities.schemes 
            : suggestions.schemes.slice(0, 3); // Top 3 suggestions
          const schemeResult = await this.addScheme(schemes);
          if (schemeResult) pendingChanges.push(schemeResult);
          break;
          
        case 'validateData':
          await this.validateData();
          break;
          
        case 'generateSuggestions':
        default:
          // Suggestions already generated
          break;
      }
    }
    
    return {
      message: this.generateResponseMessage(intent, suggestions),
      action: intent.actions[0] || 'generateSuggestions',
      confidence: intent.confidence,
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
      return {
        locations: (suggestions.locations || []).map(l => l.value_hi || l.value_en || l.value),
        eventTypes: (suggestions.eventTypes || []).map(e => e.name_hi || e.name_en || e),
        schemes: (suggestions.schemes || []).map(s => s.name_hi || s.name_en || s),
        hashtags: suggestions.hashtags || []
      };
    } catch (error) {
      console.error('Error generating suggestions:', error);
      // Return fallback suggestions based on current tweet data
      return {
        locations: this.state.currentTweet.locations || [],
        eventTypes: this.state.currentTweet.event_type ? [this.state.currentTweet.event_type] : [],
        schemes: this.state.currentTweet.schemes_mentioned || [],
        hashtags: this.state.currentTweet.hashtags || []
      };
    }
  }

  /**
   * Add location tool
   */
  private async addLocation(locations: string[]): Promise<PendingChange | null> {
    if (locations.length === 0) return null;
    
    return {
      field: 'locations',
      value: locations,
      confidence: 0.8,
      source: 'ai_suggestion',
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
    
    return {
      field: 'schemes_mentioned',
      value: schemes,
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
    console.log('Validating data consistency...');
  }

  /**
   * Generate response message based on intent and suggestions
   */
  private generateResponseMessage(intent: ParsedIntent, suggestions: AISuggestions): string {
    const tweet = this.state.currentTweet;
    
    switch (intent.intent) {
      case 'add_location':
        return `मैंने स्थान जोड़ने का सुझाव दिया है। क्या आप इन स्थानों को स्वीकार करना चाहते हैं?`;
        
      case 'change_event':
        return `इवेंट प्रकार बदलने का सुझाव दिया है। क्या आप इसे अपडेट करना चाहते हैं?`;
        
      case 'add_scheme':
        return `योजना जोड़ने का सुझाव दिया है। क्या आप इन योजनाओं को स्वीकार करना चाहते हैं?`;
        
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

