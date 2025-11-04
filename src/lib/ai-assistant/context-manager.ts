/**
 * Context Manager for AI Assistant
 * Manages conversation context and state
 */

export interface ConversationContext {
  sessionId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  metadata: {
    tweetCount?: number;
    lastActivity?: Date;
    userPreferences?: any;
  };
}

export class ContextManager {
  private contexts: Map<string, ConversationContext> = new Map();

  getContext(sessionId: string): ConversationContext | null {
    return this.contexts.get(sessionId) || null;
  }

  setContext(sessionId: string, context: ConversationContext): void {
    this.contexts.set(sessionId, context);
  }

  updateContext(sessionId: string, updates: Partial<ConversationContext>): void {
    const existing = this.getContext(sessionId);
    if (existing) {
      this.setContext(sessionId, { ...existing, ...updates });
    }
  }

  clearContext(sessionId: string): void {
    this.contexts.delete(sessionId);
  }
}

export const contextManager = new ContextManager();