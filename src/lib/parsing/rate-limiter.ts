/**
 * Rate Limiter for AI Parsing APIs
 * Enforces Gemini and Ollama rate limits with exponential backoff
 */

interface RateLimiterConfig {
  geminiRPM: number;      // Requests per minute for Gemini
  ollamaRPM: number;      // Requests per minute for Ollama
  maxRetries: number;     // Maximum retry attempts
  backoffMultiplier: number; // Exponential backoff multiplier
  initialBackoffMs: number;   // Initial backoff time
}

interface RequestRecord {
  timestamp: number;
  endpoint: 'gemini' | 'ollama';
}

export class RateLimiter {
  private config: RateLimiterConfig;
  private requestHistory: RequestRecord[] = [];
  private readonly HISTORY_RETENTION_MS = 60 * 1000; // Keep 1 minute of history

  constructor(config: RateLimiterConfig) {
    // Override with very conservative free tier limits
    this.config = {
      ...config,
      geminiRPM: Math.min(config.geminiRPM || 10, 2), // Very conservative: max 2 RPM for Gemini free tier (1 req per 30s)
      ollamaRPM: Math.min(config.ollamaRPM || 60, 30), // Conservative: 30 RPM for Ollama (1 req per 2s)
      maxRetries: config.maxRetries || 10,
      backoffMultiplier: config.backoffMultiplier || 2,
      initialBackoffMs: config.initialBackoffMs || 5000 // Start with 5 second backoff
    };
  }

  /**
   * Check if we can make a request to the specified endpoint
   */
  canMakeRequest(endpoint: 'gemini' | 'ollama'): boolean {
    this.cleanupOldRequests();

    const now = Date.now();
    const windowStart = now - this.HISTORY_RETENTION_MS;

    // Count requests in the current window
    const recentRequests = this.requestHistory.filter(
      req => req.endpoint === endpoint && req.timestamp >= windowStart
    );

    const maxRequests = endpoint === 'gemini'
      ? this.config.geminiRPM
      : this.config.ollamaRPM;

    return recentRequests.length < maxRequests;
  }

  /**
   * Wait until we can make a request, then record it
   */
  async acquirePermit(endpoint: 'gemini' | 'ollama'): Promise<void> {
    let attempt = 0;

    while (attempt < this.config.maxRetries) {
      if (this.canMakeRequest(endpoint)) {
        // Record the request
        this.requestHistory.push({
          timestamp: Date.now(),
          endpoint
        });
        return;
      }

      // Calculate wait time with exponential backoff
      const waitTime = this.config.initialBackoffMs *
        Math.pow(this.config.backoffMultiplier, attempt);

      console.log(`Rate limit hit for ${endpoint}, waiting ${waitTime}ms (attempt ${attempt + 1})`);
      await this.sleep(waitTime);
      attempt++;
    }

    throw new Error(`Rate limit exceeded for ${endpoint} after ${this.config.maxRetries} attempts`);
  }

  /**
   * Get current rate limit status
   */
  getStatus(): {
    gemini: { used: number; limit: number; remaining: number };
    ollama: { used: number; limit: number; remaining: number };
    } {
    this.cleanupOldRequests();

    const now = Date.now();
    const windowStart = now - this.HISTORY_RETENTION_MS;

    const geminiRequests = this.requestHistory.filter(
      req => req.endpoint === 'gemini' && req.timestamp >= windowStart
    ).length;

    const ollamaRequests = this.requestHistory.filter(
      req => req.endpoint === 'ollama' && req.timestamp >= windowStart
    ).length;

    return {
      gemini: {
        used: geminiRequests,
        limit: this.config.geminiRPM,
        remaining: Math.max(0, this.config.geminiRPM - geminiRequests)
      },
      ollama: {
        used: ollamaRequests,
        limit: this.config.ollamaRPM,
        remaining: Math.max(0, this.config.ollamaRPM - ollamaRequests)
      }
    };
  }

  /**
   * Clean up old request records
   */
  private cleanupOldRequests(): void {
    const cutoff = Date.now() - this.HISTORY_RETENTION_MS;
    this.requestHistory = this.requestHistory.filter(
      req => req.timestamp >= cutoff
    );
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}