import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GeminiModelProvider, OllamaModelProvider, ModelOrchestrator, ModelConfig } from '@/lib/ai-assistant/model-manager';

// Mock Google Generative AI
jest.mock('@google/generative-ai', () => {
  const mockGenerateContent = jest.fn();
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: mockGenerateContent
      })
    })),
    __mockGenerateContent: mockGenerateContent
  };
});

describe('ModelManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GeminiModelProvider', () => {
    it('should initialize with correct config', () => {
      const config: ModelConfig = {
        name: 'Test Gemini',
        type: 'gemini',
        modelId: 'gemini-1.5-flash',
        maxTokens: 500,
        temperature: 0.8,
        enabled: true
      };

      const provider = new GeminiModelProvider(config);
      const metrics = provider.getMetrics();

      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.errorRate).toBe(0);
    });

    it('should generate response successfully', async () => {
      const { __mockGenerateContent } = require('@google/generative-ai');
      __mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: jest.fn().mockReturnValue('Test response from Gemini')
        }
      });

      const provider = new GeminiModelProvider({
        name: 'Test Gemini',
        type: 'gemini',
        enabled: true
      });

      const response = await provider.generateResponse('Test prompt', 'Test context');

      expect(response.content).toBe('Test response from Gemini');
      expect(response.model).toBe('gemini');
      expect(response.confidence).toBe(0.8);
      expect(response.responseTime).toBeGreaterThanOrEqual(0);
      expect(response.tokensUsed).toBeDefined();

      const metrics = provider.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.failedRequests).toBe(0);
    });

    it('should handle API errors gracefully', async () => {
      const { __mockGenerateContent } = require('@google/generative-ai');
      __mockGenerateContent.mockRejectedValueOnce(new Error('API rate limit exceeded'));

      const provider = new GeminiModelProvider({
        name: 'Test Gemini',
        type: 'gemini',
        enabled: true
      });

      await expect(provider.generateResponse('Test prompt')).rejects.toThrow('Gemini API error');

      const metrics = provider.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(1);
      expect(metrics.errorRate).toBe(1.0);
    });

    it('should update metrics correctly on success', async () => {
      const { __mockGenerateContent } = require('@google/generative-ai');
      __mockGenerateContent.mockResolvedValue({
        response: {
          text: jest.fn().mockReturnValue('Response')
        }
      });

      const provider = new GeminiModelProvider({
        name: 'Test Gemini',
        type: 'gemini',
        enabled: true
      });

      await provider.generateResponse('Prompt 1');
      await provider.generateResponse('Prompt 2');

      const metrics = provider.getMetrics();
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.successfulRequests).toBe(2);
      expect(metrics.averageResponseTime).toBeGreaterThanOrEqual(0);
    });

    it('should return health status based on error rate', async () => {
      const { __mockGenerateContent } = require('@google/generative-ai');
      
      const provider = new GeminiModelProvider({
        name: 'Test Gemini',
        type: 'gemini',
        enabled: true
      });

      // Initially healthy (0% error rate)
      expect(provider.isHealthy()).toBe(true);

      // Simulate success (healthy)
      __mockGenerateContent.mockResolvedValue({
        response: {
          text: jest.fn().mockReturnValue('Response')
        }
      });

      for (let i = 0; i < 10; i++) {
        await provider.generateResponse('Test');
      }

      expect(provider.isHealthy()).toBe(true); // Still healthy

      // Simulate failures
      __mockGenerateContent.mockRejectedValue(new Error('API Error'));
      
      for (let i = 0; i < 10; i++) {
        try {
          await provider.generateResponse('Test');
        } catch {
          // Expected to fail
        }
      }

      // Now error rate should be high enough to be unhealthy
      const metrics = provider.getMetrics();
      expect(metrics.errorRate).toBeGreaterThan(0.1);
      expect(provider.isHealthy()).toBe(false);
    });
  });

  describe('OllamaModelProvider', () => {
    // Mock fetch globally
    let mockFetch: jest.MockedFunction<typeof fetch>;
    
    beforeEach(() => {
      mockFetch = jest.fn();
      global.fetch = mockFetch;
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should initialize with correct config', () => {
      const config: ModelConfig = {
        name: 'Test Ollama',
        type: 'ollama',
        endpoint: 'http://localhost:11434',
        modelId: 'gemma2:2b',
        maxTokens: 500,
        temperature: 0.8,
        enabled: true
      };

      const provider = new OllamaModelProvider(config);
      const metrics = provider.getMetrics();

      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
    });

    it('should generate response successfully', async () => {
      // @ts-expect-error - Jest mock type compatibility
      const mockJson = jest.fn().mockResolvedValue({
        response: 'Test response from Ollama'
      });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: mockJson
      } as unknown as Response);

      const provider = new OllamaModelProvider({
        name: 'Test Ollama',
        type: 'ollama',
        endpoint: 'http://localhost:11434',
        enabled: true
      });

      const response = await provider.generateResponse('Test prompt', 'Test context');

      expect(response.content).toBe('Test response from Ollama');
      expect(response.model).toBe('ollama');
      expect(response.confidence).toBe(0.7);
      expect(response.responseTime).toBeGreaterThanOrEqual(0);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      // @ts-expect-error - Jest mock type compatibility for fetch Response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const provider = new OllamaModelProvider({
        name: 'Test Ollama',
        type: 'ollama',
        endpoint: 'http://localhost:11434',
        enabled: true
      });

      await expect(provider.generateResponse('Test prompt')).rejects.toThrow('Ollama API error');

      const metrics = provider.getMetrics();
      expect(metrics.failedRequests).toBe(1);
      expect(metrics.errorRate).toBeGreaterThan(0);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const provider = new OllamaModelProvider({
        name: 'Test Ollama',
        type: 'ollama',
        endpoint: 'http://localhost:11434',
        enabled: true
      });

      await expect(provider.generateResponse('Test prompt')).rejects.toThrow('Ollama API error');

      const metrics = provider.getMetrics();
      expect(metrics.failedRequests).toBe(1);
    });

    it('should return health status based on error rate', () => {
      const provider = new OllamaModelProvider({
        name: 'Test Ollama',
        type: 'ollama',
        enabled: true
      });

      // Initially healthy
      expect(provider.isHealthy()).toBe(true);

      // Simulate failures
      const metrics = provider['metrics'];
      metrics.failedRequests = 10;
      metrics.totalRequests = 50; // 20% error rate
      metrics.errorRate = 0.2;

      expect(provider.isHealthy()).toBe(false); // Unhealthy (>= 20%)
    });
  });

  describe('ModelOrchestrator', () => {
    let mockFetch: jest.MockedFunction<typeof fetch>;
    
    beforeEach(() => {
      mockFetch = jest.fn();
      global.fetch = mockFetch;
      
      // Mock fetch for Ollama availability check (called in constructor)
      // @ts-expect-error - Jest mock type compatibility
      const mockJsonTags = jest.fn().mockResolvedValue({ models: [] });
      mockFetch.mockResolvedValue({
        ok: true,
        json: mockJsonTags
      } as unknown as Response);
      
      jest.clearAllMocks();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should initialize with both providers', () => {
      const orchestrator = new ModelOrchestrator();
      const health = orchestrator.getModelHealth();

      expect(health).toHaveProperty('gemini');
      expect(health).toHaveProperty('ollama');
    });

    it('should generate response with primary model', async () => {
      const { __mockGenerateContent } = require('@google/generative-ai');
      __mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: jest.fn().mockReturnValue('Primary model response')
        }
      });

      const orchestrator = new ModelOrchestrator();
      const response = await orchestrator.generateResponse('Test prompt', 'Context');

      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('model');
      if (!Array.isArray(response)) {
        expect(['gemini', 'ollama']).toContain(response.model);
      }
    });

    it('should fallback to secondary model on primary failure', async () => {
      const { __mockGenerateContent } = require('@google/generative-ai');
      __mockGenerateContent.mockRejectedValueOnce(new Error('Primary failed'));

      // @ts-expect-error - Jest mock type compatibility
      const mockJson = jest.fn().mockResolvedValue({ response: 'Fallback response' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: mockJson
      } as unknown as Response);

      const orchestrator = new ModelOrchestrator();
      const response = await orchestrator.generateResponse('Test prompt');

      expect(response).toHaveProperty('content');
      if (!Array.isArray(response)) {
        expect(response.content).toContain('response');
      }
    });

    it('should generate with both models when requested', async () => {
      const { __mockGenerateContent } = require('@google/generative-ai');
      __mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: jest.fn().mockReturnValue('Gemini response')
        }
      });

      // @ts-expect-error - Jest mock type compatibility
      const mockJsonOllama = jest.fn().mockResolvedValue({ response: 'Ollama response' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: mockJsonOllama
      } as unknown as Response);

      const orchestrator = new ModelOrchestrator();
      const responses = await orchestrator.generateResponse('Test prompt', undefined, true);

      expect(Array.isArray(responses)).toBe(true);
      if (Array.isArray(responses)) {
        expect(responses.length).toBeGreaterThan(0);
      }
    });

    it('should get model metrics', () => {
      const orchestrator = new ModelOrchestrator();
      const metrics = orchestrator.getModelMetrics();

      expect(metrics).toHaveProperty('gemini');
      expect(metrics).toHaveProperty('ollama');
      expect(metrics.gemini).toHaveProperty('totalRequests');
      expect(metrics.ollama).toHaveProperty('totalRequests');
    });

    it('should update primary model based on health', () => {
      const orchestrator = new ModelOrchestrator();
      
      // Set both to healthy
      orchestrator['geminiProvider']['metrics'].errorRate = 0.05;
      orchestrator['ollamaProvider']['metrics'].errorRate = 0.15;
      
      orchestrator.updatePrimaryModel();
      
      // Should prefer Gemini when both healthy
      expect(orchestrator['primaryModel']).toBe('gemini');
      expect(orchestrator['fallbackModel']).toBe('ollama');
    });

    it('should recommend correct model for request type', () => {
      const orchestrator = new ModelOrchestrator();
      
      expect(['gemini', 'ollama']).toContain(orchestrator.getRecommendedModel('simple'));
      expect(orchestrator.getRecommendedModel('complex')).toBe('gemini');
      expect(orchestrator.getRecommendedModel('comparison')).toBe('both');
    });

    it('should check model availability', async () => {
      // @ts-expect-error - Jest mock type compatibility
      const mockJsonTags = jest.fn().mockResolvedValue({ models: [] });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: mockJsonTags
      } as unknown as Response);

      const orchestrator = new ModelOrchestrator();
      const availability = await orchestrator.checkModelAvailability();

      expect(availability).toHaveProperty('gemini');
      expect(availability).toHaveProperty('ollama');
      expect(typeof availability.gemini).toBe('boolean');
      expect(typeof availability.ollama).toBe('boolean');
    });
  });
});

