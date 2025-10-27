/**
 * Conversation Context Manager for AI Assistant
 * 
 * This module maintains conversation state across turns, tracks what user has edited,
 * what's pending, what's approved, and provides relevant context to LLM based on
 * conversation stage.
 */

// Context interfaces
export interface ConversationContext {
  sessionId: string;
  stage: ConversationStage;
  focusField?: string;
  userIntent?: string;
  previousActions: ActionHistory[];
  pendingChanges: PendingChange[];
  approvedChanges: ApprovedChange[];
  rejectedChanges: RejectedChange[];
  conversationFlow: ConversationTurn[];
  currentTweet?: TweetContext;
  userPreferences: UserPreferences;
  lastActivity: Date;
}

export interface ActionHistory {
  action: string;
  timestamp: Date;
  success: boolean;
  details?: any;
}

export interface PendingChange {
  id: string;
  field: string;
  value: any;
  confidence: number;
  source: 'user' | 'ai_suggestion' | 'validation';
  timestamp: Date;
  reason?: string;
}

export interface ApprovedChange {
  id: string;
  field: string;
  value: any;
  timestamp: Date;
  approvedBy: 'user' | 'ai';
}

export interface RejectedChange {
  id: string;
  field: string;
  value: any;
  timestamp: Date;
  reason: string;
}

export interface ConversationTurn {
  turnId: string;
  userMessage: string;
  aiResponse: string;
  timestamp: Date;
  actions: string[];
  entities: any;
  confidence: number;
}

export interface TweetContext {
  tweetId: string;
  originalText: string;
  currentState: any;
  editHistory: EditHistory[];
}

export interface EditHistory {
  timestamp: Date;
  field: string;
  oldValue: any;
  newValue: any;
  editedBy: 'user' | 'ai';
}

export interface UserPreferences {
  language: 'hindi' | 'english' | 'mixed';
  verbosity: 'brief' | 'detailed';
  autoSuggest: boolean;
  validationLevel: 'strict' | 'moderate' | 'lenient';
}

export type ConversationStage = 
  | 'initializing'
  | 'analyzing'
  | 'suggesting'
  | 'editing'
  | 'validating'
  | 'approving'
  | 'completed'
  | 'error';

// Context Manager Class
export class ConversationContextManager {
  private contexts: Map<string, ConversationContext>;
  private maxContextAge: number; // 24 hours in milliseconds
  private maxConversationTurns: number;

  constructor() {
    this.contexts = new Map();
    this.maxContextAge = 24 * 60 * 60 * 1000; // 24 hours
    this.maxConversationTurns = 50;
  }

  /**
   * Initialize or get existing conversation context
   */
  getOrCreateContext(sessionId: string, tweetId?: string): ConversationContext {
    let context = this.contexts.get(sessionId);
    
    if (!context || this.isContextExpired(context)) {
      context = this.createNewContext(sessionId, tweetId);
      this.contexts.set(sessionId, context);
    }

    // Update last activity
    context.lastActivity = new Date();
    
    return context;
  }

  /**
   * Update conversation context with new turn
   */
  updateContext(
    sessionId: string,
    turn: ConversationTurn,
    stage?: ConversationStage,
    focusField?: string
  ): void {
    const context = this.getOrCreateContext(sessionId);
    
    // Add conversation turn
    context.conversationFlow.push(turn);
    
    // Limit conversation turns
    if (context.conversationFlow.length > this.maxConversationTurns) {
      context.conversationFlow = context.conversationFlow.slice(-this.maxConversationTurns);
    }
    
    // Update stage and focus
    if (stage) {
      context.stage = stage;
    }
    
    if (focusField) {
      context.focusField = focusField;
    }
    
    // Update user intent if detected
    if (turn.entities?.intent) {
      context.userIntent = turn.entities.intent;
    }
    
    // Add action to history
    context.previousActions.push({
      action: turn.actions[0] || 'unknown',
      timestamp: new Date(),
      success: turn.confidence > 0.5,
      details: turn.entities
    });
    
    // Update last activity
    context.lastActivity = new Date();
  }

  /**
   * Add pending change to context
   */
  addPendingChange(
    sessionId: string,
    field: string,
    value: any,
    confidence: number,
    source: 'user' | 'ai_suggestion' | 'validation',
    reason?: string
  ): string {
    const context = this.getOrCreateContext(sessionId);
    
    const changeId = this.generateChangeId();
    const pendingChange: PendingChange = {
      id: changeId,
      field,
      value,
      confidence,
      source,
      timestamp: new Date(),
      reason
    };
    
    context.pendingChanges.push(pendingChange);
    context.lastActivity = new Date();
    
    return changeId;
  }

  /**
   * Approve a pending change
   */
  approveChange(sessionId: string, changeId: string, approvedBy: 'user' | 'ai'): boolean {
    const context = this.getOrCreateContext(sessionId);
    
    const changeIndex = context.pendingChanges.findIndex(c => c.id === changeId);
    if (changeIndex === -1) return false;
    
    const change = context.pendingChanges[changeIndex];
    
    // Move to approved changes
    context.approvedChanges.push({
      id: changeId,
      field: change.field,
      value: change.value,
      timestamp: new Date(),
      approvedBy
    });
    
    // Remove from pending
    context.pendingChanges.splice(changeIndex, 1);
    
    // Update tweet context if available
    if (context.currentTweet) {
      this.updateTweetContext(context.currentTweet, change.field, change.value);
    }
    
    context.lastActivity = new Date();
    return true;
  }

  /**
   * Reject a pending change
   */
  rejectChange(sessionId: string, changeId: string, reason: string): boolean {
    const context = this.getOrCreateContext(sessionId);
    
    const changeIndex = context.pendingChanges.findIndex(c => c.id === changeId);
    if (changeIndex === -1) return false;
    
    const change = context.pendingChanges[changeIndex];
    
    // Move to rejected changes
    context.rejectedChanges.push({
      id: changeId,
      field: change.field,
      value: change.value,
      timestamp: new Date(),
      reason
    });
    
    // Remove from pending
    context.pendingChanges.splice(changeIndex, 1);
    
    context.lastActivity = new Date();
    return true;
  }

  /**
   * Get relevant context for LLM
   */
  getRelevantContext(sessionId: string, currentStage?: ConversationStage): string {
    const context = this.getOrCreateContext(sessionId);
    
    let relevantContext = '';
    
    // Add conversation history
    if (context.conversationFlow.length > 0) {
      relevantContext += 'Previous conversation:\n';
      const recentTurns = context.conversationFlow.slice(-3); // Last 3 turns
      for (const turn of recentTurns) {
        relevantContext += `User: ${turn.userMessage}\n`;
        relevantContext += `AI: ${turn.aiResponse}\n`;
      }
    }
    
    // Add current stage context
    relevantContext += `\nCurrent stage: ${context.stage}\n`;
    if (context.focusField) {
      relevantContext += `Focus field: ${context.focusField}\n`;
    }
    
    // Add pending changes
    if (context.pendingChanges.length > 0) {
      relevantContext += '\nPending changes:\n';
      for (const change of context.pendingChanges) {
        relevantContext += `- ${change.field}: ${JSON.stringify(change.value)} (confidence: ${change.confidence})\n`;
      }
    }
    
    // Add approved changes
    if (context.approvedChanges.length > 0) {
      relevantContext += '\nApproved changes:\n';
      const recentApproved = context.approvedChanges.slice(-5); // Last 5 approved
      for (const change of recentApproved) {
        relevantContext += `- ${change.field}: ${JSON.stringify(change.value)}\n`;
      }
    }
    
    // Add rejected changes for learning
    if (context.rejectedChanges.length > 0) {
      relevantContext += '\nRejected changes (for learning):\n';
      const recentRejected = context.rejectedChanges.slice(-3); // Last 3 rejected
      for (const change of recentRejected) {
        relevantContext += `- ${change.field}: ${JSON.stringify(change.value)} (reason: ${change.reason})\n`;
      }
    }
    
    // Add user preferences
    relevantContext += `\nUser preferences:\n`;
    relevantContext += `- Language: ${context.userPreferences.language}\n`;
    relevantContext += `- Verbosity: ${context.userPreferences.verbosity}\n`;
    relevantContext += `- Auto-suggest: ${context.userPreferences.autoSuggest}\n`;
    relevantContext += `- Validation level: ${context.userPreferences.validationLevel}\n`;
    
    return relevantContext;
  }

  /**
   * Get suggestions based on context
   */
  getContextualSuggestions(sessionId: string): any {
    const context = this.getOrCreateContext(sessionId);
    
    const suggestions: any = {
      nextActions: [],
      focusAreas: [],
      warnings: []
    };
    
    // Suggest next actions based on stage
    switch (context.stage) {
      case 'analyzing':
        suggestions.nextActions = ['generateSuggestions', 'addLocation', 'suggestEventType'];
        break;
      case 'suggesting':
        suggestions.nextActions = ['validateData', 'approveChanges', 'editField'];
        break;
      case 'editing':
        suggestions.nextActions = ['validateData', 'approveChanges', 'generateHashtags'];
        break;
      case 'validating':
        suggestions.nextActions = ['approveChanges', 'rejectChanges', 'editField'];
        break;
    }
    
    // Add focus areas based on pending changes
    if (context.pendingChanges.length > 0) {
      suggestions.focusAreas = context.pendingChanges.map(c => c.field);
    }
    
    // Add warnings based on rejected changes
    if (context.rejectedChanges.length > 2) {
      suggestions.warnings.push('Multiple rejections detected. Consider adjusting approach.');
    }
    
    return suggestions;
  }

  /**
   * Update user preferences
   */
  updateUserPreferences(
    sessionId: string,
    preferences: Partial<UserPreferences>
  ): void {
    const context = this.getOrCreateContext(sessionId);
    context.userPreferences = { ...context.userPreferences, ...preferences };
    context.lastActivity = new Date();
  }

  /**
   * Clear context (for new conversation)
   */
  clearContext(sessionId: string): void {
    this.contexts.delete(sessionId);
  }

  /**
   * Get context summary for debugging
   */
  getContextSummary(sessionId: string): any {
    const context = this.getOrCreateContext(sessionId);
    
    return {
      sessionId: context.sessionId,
      stage: context.stage,
      focusField: context.focusField,
      conversationTurns: context.conversationFlow.length,
      pendingChanges: context.pendingChanges.length,
      approvedChanges: context.approvedChanges.length,
      rejectedChanges: context.rejectedChanges.length,
      lastActivity: context.lastActivity,
      userPreferences: context.userPreferences
    };
  }

  /**
   * Cleanup expired contexts
   */
  cleanupExpiredContexts(): void {
    const now = new Date();
    for (const [sessionId, context] of this.contexts.entries()) {
      if (now.getTime() - context.lastActivity.getTime() > this.maxContextAge) {
        this.contexts.delete(sessionId);
      }
    }
  }

  // Private helper methods

  private createNewContext(sessionId: string, tweetId?: string): ConversationContext {
    return {
      sessionId,
      stage: 'initializing',
      previousActions: [],
      pendingChanges: [],
      approvedChanges: [],
      rejectedChanges: [],
      conversationFlow: [],
      currentTweet: tweetId ? {
        tweetId,
        originalText: '',
        currentState: {},
        editHistory: []
      } : undefined,
      userPreferences: {
        language: 'mixed',
        verbosity: 'detailed',
        autoSuggest: true,
        validationLevel: 'moderate'
      },
      lastActivity: new Date()
    };
  }

  private isContextExpired(context: ConversationContext): boolean {
    const now = new Date();
    return now.getTime() - context.lastActivity.getTime() > this.maxContextAge;
  }

  private generateChangeId(): string {
    return `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateTweetContext(tweetContext: TweetContext, field: string, value: any): void {
    const oldValue = tweetContext.currentState[field];
    tweetContext.currentState[field] = value;
    
    tweetContext.editHistory.push({
      timestamp: new Date(),
      field,
      oldValue,
      newValue: value,
      editedBy: 'user'
    });
  }
}

// Export singleton instance
export const contextManager = new ConversationContextManager();

