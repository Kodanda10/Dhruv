/**
 * Health Metrics Tracking
 * 
 * Tracks system health metrics for the /api/health endpoint
 */

// Track Ollama calls (in production, use Redis or shared state)
let ollamaCallCount = 0;
let lastOllamaCall = Date.now();

// Track validation queue size
let validationQueueSize = 0;

/**
 * Increment Ollama call counter (called from langgraph-assistant)
 */
export function recordOllamaCall(): void {
  ollamaCallCount++;
  lastOllamaCall = Date.now();
}

/**
 * Update validation queue size (called from langgraph-assistant)
 */
export function updateValidationQueue(size: number): void {
  validationQueueSize = size;
}

/**
 * Get current Ollama call metrics
 */
export function getOllamaMetrics(): { recent: number; lastCall: number } {
  // Reset count if it's been more than 1 minute since last call
  if (Date.now() - lastOllamaCall > 60000) {
    ollamaCallCount = 0;
  }
  
  return {
    recent: ollamaCallCount,
    lastCall: lastOllamaCall > 0 ? lastOllamaCall : 0
  };
}

/**
 * Get current validation queue size
 */
export function getValidationQueueSize(): number {
  return validationQueueSize;
}



