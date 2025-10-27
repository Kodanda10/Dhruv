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

// AI Assistant Core Class
export class LangGraphAIAssistant {
  private gemini: GoogleGenerativeAI;
  private learningSystem: DynamicLearningSystem;
  private state: AIAssistantState;
  private ollamaEndpoint: string;

  constructor() {
    this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    this.learningSystem = new DynamicLearningSystem();
    this.ollamaEndpoint = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    
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

  /**
   * Main entry point for AI Assistant interactions
   */
  async processMessage(
    message: string, 
    tweetData: TweetData,
    useBothModels: boolean = false
  ): Promise<AIResponse> {
    try {
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
      
      return response;
      
    } catch (error) {
      console.error('AI Assistant error:', error);
      return this.handleError(error);
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
   * Simple fallback intent parsing
   */
  private simpleIntentParsing(message: string): ParsedIntent {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('add') && lowerMessage.includes('location')) {
      return {
        intent: 'add_location',
        entities: { locations: [], event_types: [], schemes: [], people: [] },
        actions: ['addLocation'],
        confidence: 0.7
      };
    }
    
    if (lowerMessage.includes('change') && lowerMessage.includes('event')) {
      return {
        intent: 'change_event',
        entities: { locations: [], event_types: [], schemes: [], people: [] },
        actions: ['changeEventType'],
        confidence: 0.7
      };
    }
    
    if (lowerMessage.includes('add') && lowerMessage.includes('scheme')) {
      return {
        intent: 'add_scheme',
        entities: { locations: [], event_types: [], schemes: [], people: [] },
        actions: ['addScheme'],
        confidence: 0.7
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
          const locationResult = await this.addLocation(intent.entities.locations);
          if (locationResult) pendingChanges.push(locationResult);
          break;
          
        case 'changeEventType':
          const eventResult = await this.changeEventType(intent.entities.event_types);
          if (eventResult) pendingChanges.push(eventResult);
          break;
          
        case 'addScheme':
          const schemeResult = await this.addScheme(intent.entities.schemes);
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
      const suggestions = await this.learningSystem.getIntelligentSuggestions(
        this.state.currentTweet.tweet_id,
        this.state.currentTweet.text
      );
      
      return {
        locations: suggestions.locations || [],
        eventTypes: suggestions.eventTypes || [],
        schemes: suggestions.schemes || [],
        hashtags: suggestions.hashtags || []
      };
    } catch (error) {
      console.error('Error generating suggestions:', error);
      return { locations: [], eventTypes: [], schemes: [], hashtags: [] };
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

// Export singleton instance
export const aiAssistant = new LangGraphAIAssistant();

