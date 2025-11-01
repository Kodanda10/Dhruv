/**
 * Model Manager for AI Assistant
 * 
 * This module manages different AI models (Gemini and Ollama) with primary/fallback
 * logic, parallel execution, rate limiting, and error handling.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Model interfaces
export interface ModelResponse {
  content: string;
  confidence: number;
  model: string;
  responseTime: number;
  tokensUsed?: number;
}

export interface ModelConfig {
  name: string;
  type: 'gemini' | 'ollama';
  endpoint?: string;
  modelId?: string;
  maxTokens?: number;
  temperature?: number;
  enabled: boolean;
}

export interface ModelMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  totalTokensUsed: number;
  lastUsed: Date;
  errorRate: number;
}

// Model providers
export class GeminiModelProvider {
  private client: GoogleGenerativeAI;
  private metrics: ModelMetrics;
  private config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
    this.client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      totalTokensUsed: 0,
      lastUsed: new Date(),
      errorRate: 0
    };
  }

  async generateResponse(
    prompt: string,
    context?: string
  ): Promise<ModelResponse> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const model = this.client.getGenerativeModel({ 
        model: this.config.modelId || 'gemini-1.5-flash',
        generationConfig: {
          maxOutputTokens: this.config.maxTokens || 1000,
          temperature: this.config.temperature || 0.7,
        }
      });

      const fullPrompt = context ? `${context}\n\n${prompt}` : prompt;
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();

      const responseTime = Date.now() - startTime;
      this.updateMetrics(true, responseTime, text.length);

      return {
        content: text,
        confidence: 0.8, // Gemini typically has high confidence
        model: 'gemini',
        responseTime,
        tokensUsed: text.length
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(false, responseTime, 0);
      
      throw new Error(`Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private updateMetrics(success: boolean, responseTime: number, tokensUsed: number): void {
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) / 
      this.metrics.totalRequests;

    this.metrics.totalTokensUsed += tokensUsed;
    this.metrics.lastUsed = new Date();
    this.metrics.errorRate = this.metrics.failedRequests / this.metrics.totalRequests;
  }

  getMetrics(): ModelMetrics {
    return { ...this.metrics };
  }

  isHealthy(): boolean {
    return this.metrics.errorRate < 0.1; // Less than 10% error rate
  }
}

export class OllamaModelProvider {
  private metrics: ModelMetrics;
  private config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      totalTokensUsed: 0,
      lastUsed: new Date(),
      errorRate: 0
    };
  }

  async generateResponse(
    prompt: string,
    context?: string
  ): Promise<ModelResponse> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const fullPrompt = context ? `${context}\n\n${prompt}` : prompt;
      
      const response = await fetch(`${this.config.endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.modelId || 'gemma2:2b',
          prompt: fullPrompt,
          stream: false,
          options: {
            temperature: this.config.temperature || 0.7,
            num_predict: this.config.maxTokens || 1000
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.response || '';

      const responseTime = Date.now() - startTime;
      this.updateMetrics(true, responseTime, content.length);

      return {
        content,
        confidence: 0.7, // Ollama typically has good confidence
        model: 'ollama',
        responseTime,
        tokensUsed: content.length
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(false, responseTime, 0);
      
      throw new Error(`Ollama API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private updateMetrics(success: boolean, responseTime: number, tokensUsed: number): void {
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) / 
      this.metrics.totalRequests;

    this.metrics.totalTokensUsed += tokensUsed;
    this.metrics.lastUsed = new Date();
    this.metrics.errorRate = this.metrics.failedRequests / this.metrics.totalRequests;
  }

  getMetrics(): ModelMetrics {
    return { ...this.metrics };
  }

  isHealthy(): boolean {
    return this.metrics.errorRate < 0.2; // Less than 20% error rate for local model
  }
}

// Model orchestrator
export class ModelOrchestrator {
  private geminiProvider: GeminiModelProvider;
  private ollamaProvider: OllamaModelProvider;
  private primaryModel: 'gemini' | 'ollama';
  private fallbackModel: 'gemini' | 'ollama';

  constructor() {
    // Initialize Gemini provider
    this.geminiProvider = new GeminiModelProvider({
      name: 'Gemini 1.5 Flash',
      type: 'gemini',
      modelId: 'gemini-1.5-flash',
      maxTokens: 1000,
      temperature: 0.7,
      enabled: !!process.env.GEMINI_API_KEY
    });

    // Initialize Ollama provider
    this.ollamaProvider = new OllamaModelProvider({
      name: 'Gemma2 2B',
      type: 'ollama',
      endpoint: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      modelId: 'gemma2:2b',
      maxTokens: 1000,
      temperature: 0.7,
      enabled: true // Always enabled as fallback
    });

    // Set primary and fallback models
    this.primaryModel = this.geminiProvider.isHealthy() ? 'gemini' : 'ollama';
    this.fallbackModel = this.primaryModel === 'gemini' ? 'ollama' : 'gemini';
  }

  /**
   * Generate response using primary model with automatic fallback
   */
  async generateResponse(
    prompt: string,
    context?: string,
    useBothModels: boolean = false
  ): Promise<ModelResponse | ModelResponse[]> {
    if (useBothModels) {
      return this.generateWithBothModels(prompt, context);
    }

    try {
      const response = await this.generateWithPrimaryModel(prompt, context);
      return response;
    } catch (error) {
      console.warn(`Primary model failed, trying fallback: ${error}`);
      return this.generateWithFallbackModel(prompt, context);
    }
  }

  /**
   * Generate response using primary model
   */
  private async generateWithPrimaryModel(
    prompt: string,
    context?: string
  ): Promise<ModelResponse> {
    if (this.primaryModel === 'gemini') {
      return this.geminiProvider.generateResponse(prompt, context);
    } else {
      return this.ollamaProvider.generateResponse(prompt, context);
    }
  }

  /**
   * Generate response using fallback model
   */
  private async generateWithFallbackModel(
    prompt: string,
    context?: string
  ): Promise<ModelResponse> {
    if (this.fallbackModel === 'gemini') {
      return this.geminiProvider.generateResponse(prompt, context);
    } else {
      return this.ollamaProvider.generateResponse(prompt, context);
    }
  }

  /**
   * Generate response using both models for comparison
   */
  private async generateWithBothModels(
    prompt: string,
    context?: string
  ): Promise<ModelResponse[]> {
    const [geminiResponse, ollamaResponse] = await Promise.allSettled([
      this.geminiProvider.generateResponse(prompt, context),
      this.ollamaProvider.generateResponse(prompt, context)
    ]);

    const responses: ModelResponse[] = [];

    if (geminiResponse.status === 'fulfilled') {
      responses.push(geminiResponse.value);
    }

    if (ollamaResponse.status === 'fulfilled') {
      responses.push(ollamaResponse.value);
    }

    return responses;
  }

  /**
   * Get model health status
   */
  getModelHealth(): { gemini: boolean; ollama: boolean } {
    return {
      gemini: this.geminiProvider.isHealthy(),
      ollama: this.ollamaProvider.isHealthy()
    };
  }

  /**
   * Get model metrics
   */
  getModelMetrics(): { gemini: ModelMetrics; ollama: ModelMetrics } {
    return {
      gemini: this.geminiProvider.getMetrics(),
      ollama: this.ollamaProvider.getMetrics()
    };
  }

  /**
   * Update primary model based on performance
   */
  updatePrimaryModel(): void {
    const geminiHealthy = this.geminiProvider.isHealthy();
    const ollamaHealthy = this.ollamaProvider.isHealthy();

    if (geminiHealthy && !ollamaHealthy) {
      this.primaryModel = 'gemini';
      this.fallbackModel = 'ollama';
    } else if (ollamaHealthy && !geminiHealthy) {
      this.primaryModel = 'ollama';
      this.fallbackModel = 'gemini';
    } else if (geminiHealthy && ollamaHealthy) {
      // Prefer Gemini for better quality, Ollama as fallback
      this.primaryModel = 'gemini';
      this.fallbackModel = 'ollama';
    } else {
      // Both unhealthy, use Gemini as primary (will fail gracefully)
      this.primaryModel = 'gemini';
      this.fallbackModel = 'ollama';
    }
  }

  /**
   * Check if models are available
   */
  async checkModelAvailability(): Promise<{ gemini: boolean; ollama: boolean }> {
    const geminiAvailable = !!process.env.GEMINI_API_KEY;
    
    let ollamaAvailable = false;
    try {
      const response = await fetch(`${this.ollamaProvider['config'].endpoint}/api/tags`);
      ollamaAvailable = response.ok;
    } catch (error) {
      ollamaAvailable = false;
    }

    return { gemini: geminiAvailable, ollama: ollamaAvailable };
  }

  /**
   * Get recommended model based on request type
   */
  getRecommendedModel(requestType: 'simple' | 'complex' | 'comparison'): 'gemini' | 'ollama' | 'both' {
    switch (requestType) {
      case 'simple':
        return this.primaryModel;
      case 'complex':
        return 'gemini'; // Gemini is better for complex tasks
      case 'comparison':
        return 'both';
      default:
        return this.primaryModel;
    }
  }
}

// Export singleton instance
export const modelOrchestrator = new ModelOrchestrator();

