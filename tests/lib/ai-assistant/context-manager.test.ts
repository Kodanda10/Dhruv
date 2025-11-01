import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ConversationContextManager, ConversationContext, ConversationStage, PendingChange, ApprovedChange, RejectedChange, ConversationTurn } from '@/lib/ai-assistant/context-manager';

describe('ConversationContextManager', () => {
  let contextManager: ConversationContextManager;
  const testSessionId = 'test-session-123';

  beforeEach(() => {
    contextManager = new ConversationContextManager();
  });

  describe('getOrCreateContext', () => {
    it('should create new context when session does not exist', () => {
      const context = contextManager.getOrCreateContext(testSessionId);
      
      expect(context).toBeDefined();
      expect(context.sessionId).toBe(testSessionId);
      expect(context.stage).toBe('initializing');
      expect(context.pendingChanges).toEqual([]);
      expect(context.approvedChanges).toEqual([]);
      expect(context.rejectedChanges).toEqual([]);
      expect(context.conversationFlow).toEqual([]);
    });

    it('should return existing context when session exists', () => {
      const context1 = contextManager.getOrCreateContext(testSessionId);
      context1.stage = 'editing';
      
      const context2 = contextManager.getOrCreateContext(testSessionId);
      
      expect(context2).toBe(context1);
      expect(context2.stage).toBe('editing');
    });

    it('should create new context when existing one is expired', () => {
      const context1 = contextManager.getOrCreateContext(testSessionId);
      
      // Simulate expired context by setting lastActivity to past
      context1.lastActivity = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      
      const context2 = contextManager.getOrCreateContext(testSessionId);
      
      expect(context2).not.toBe(context1);
      expect(context2.stage).toBe('initializing');
    });

    it('should initialize with tweetId if provided', () => {
      const tweetId = 'tweet-123';
      const context = contextManager.getOrCreateContext(testSessionId, tweetId);
      
      expect(context.currentTweet).toBeDefined();
      expect(context.currentTweet?.tweetId).toBe(tweetId);
    });

    it('should update lastActivity on get', () => {
      const context1 = contextManager.getOrCreateContext(testSessionId);
      const oldActivity = context1.lastActivity;
      
      // Wait a bit
      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);
      
      const context2 = contextManager.getOrCreateContext(testSessionId);
      
      expect(context2.lastActivity.getTime()).toBeGreaterThanOrEqual(oldActivity.getTime());
      
      jest.useRealTimers();
    });
  });

  describe('updateContext', () => {
    it('should add conversation turn', () => {
      const context = contextManager.getOrCreateContext(testSessionId);
      
      const turn = {
        turnId: 'turn-1',
        userMessage: 'Hello',
        aiResponse: 'Hi there!',
        timestamp: new Date(),
        actions: ['greet'],
        entities: { intent: 'greeting', confidence: 0.9 },
        confidence: 0.9
      };
      
      contextManager.updateContext(testSessionId, turn);
      
      expect(context.conversationFlow).toHaveLength(1);
      expect(context.conversationFlow[0]).toBe(turn);
    });

    it('should update stage when provided', () => {
      const context = contextManager.getOrCreateContext(testSessionId);
      const turn: ConversationTurn = {
        turnId: 'turn-1',
        userMessage: 'Test',
        aiResponse: 'Response',
        timestamp: new Date(),
        actions: ['test'],
        entities: {},
        confidence: 0.8
      };
      
      contextManager.updateContext(testSessionId, turn, 'editing');
      
      expect(context.stage).toBe('editing');
    });

    it('should update focusField when provided', () => {
      const context = contextManager.getOrCreateContext(testSessionId);
      const turn: ConversationTurn = {
        turnId: 'turn-1',
        userMessage: 'Test',
        aiResponse: 'Response',
        timestamp: new Date(),
        actions: ['test'],
        entities: {},
        confidence: 0.8
      };
      
      contextManager.updateContext(testSessionId, turn, 'editing', 'location');
      
      expect(context.focusField).toBe('location');
    });

    it('should limit conversation turns to maxConversationTurns', () => {
      const context = contextManager.getOrCreateContext(testSessionId);
      
      // Add more than max turns (default is 50)
      for (let i = 0; i < 55; i++) {
        const turn: ConversationTurn = {
          turnId: `turn-${i}`,
          userMessage: `Message ${i}`,
          aiResponse: `Response ${i}`,
          timestamp: new Date(),
          actions: ['test'],
          entities: {},
          confidence: 0.8
        };
        contextManager.updateContext(testSessionId, turn);
      }
      
      expect(context.conversationFlow.length).toBe(50);
      // Should keep the last 50 turns
      expect(context.conversationFlow[0].turnId).toBe('turn-5');
    });

    it('should add action to previousActions history', () => {
      const context = contextManager.getOrCreateContext(testSessionId);
      const turn: ConversationTurn = {
        turnId: 'turn-1',
        userMessage: 'Test',
        aiResponse: 'Response',
        timestamp: new Date(),
        actions: ['addLocation'],
        entities: { intent: 'location', confidence: 0.9 },
        confidence: 0.9
      };
      
      contextManager.updateContext(testSessionId, turn);
      
      expect(context.previousActions).toHaveLength(1);
      expect(context.previousActions[0].action).toBe('addLocation');
      expect(context.previousActions[0].success).toBe(true); // confidence > 0.5
    });

    it('should update userIntent from turn entities', () => {
      const context = contextManager.getOrCreateContext(testSessionId);
      const turn: ConversationTurn = {
        turnId: 'turn-1',
        userMessage: 'Test',
        aiResponse: 'Response',
        timestamp: new Date(),
        actions: ['test'],
        entities: { intent: 'location', confidence: 0.9 },
        confidence: 0.9
      };
      
      contextManager.updateContext(testSessionId, turn);
      
      expect(context.userIntent).toBe('location');
    });

    it('should not update userIntent when entities.intent is missing', () => {
      const context = contextManager.getOrCreateContext(testSessionId);
      context.userIntent = 'previous_intent';
      
      const turn: ConversationTurn = {
        turnId: 'turn-1',
        userMessage: 'Test',
        aiResponse: 'Response',
        timestamp: new Date(),
        actions: ['test'],
        entities: { confidence: 0.9 },
        confidence: 0.9
      };
      
      contextManager.updateContext(testSessionId, turn);
      
      expect(context.userIntent).toBe('previous_intent');
    });

    it('should mark action as failed when confidence is low', () => {
      const context = contextManager.getOrCreateContext(testSessionId);
      const turn: ConversationTurn = {
        turnId: 'turn-1',
        userMessage: 'Test',
        aiResponse: 'Response',
        timestamp: new Date(),
        actions: ['addLocation'],
        entities: {},
        confidence: 0.3 // Low confidence
      };
      
      contextManager.updateContext(testSessionId, turn);
      
      expect(context.previousActions[0].success).toBe(false);
    });
  });

  describe('addPendingChange', () => {
    it('should add pending change to context', () => {
      const context = contextManager.getOrCreateContext(testSessionId);
      
      const changeId = contextManager.addPendingChange(
        testSessionId,
        'location',
        'रायपुर',
        0.9,
        'ai_suggestion',
        'High confidence location match'
      );
      
      expect(changeId).toBeDefined();
      expect(context.pendingChanges).toHaveLength(1);
      expect(context.pendingChanges[0].field).toBe('location');
      expect(context.pendingChanges[0].value).toBe('रायपुर');
      expect(context.pendingChanges[0].confidence).toBe(0.9);
      expect(context.pendingChanges[0].source).toBe('ai_suggestion');
      expect(context.pendingChanges[0].reason).toBe('High confidence location match');
    });

    it('should generate unique change IDs', () => {
      const id1 = contextManager.addPendingChange(testSessionId, 'field1', 'value1', 0.8, 'user');
      const id2 = contextManager.addPendingChange(testSessionId, 'field2', 'value2', 0.8, 'user');
      
      expect(id1).not.toBe(id2);
    });

    it('should update lastActivity when adding pending change', () => {
      const context = contextManager.getOrCreateContext(testSessionId);
      const oldActivity = context.lastActivity;
      
      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);
      
      contextManager.addPendingChange(testSessionId, 'location', 'test', 0.8, 'user');
      
      expect(context.lastActivity.getTime()).toBeGreaterThanOrEqual(oldActivity.getTime());
      
      jest.useRealTimers();
    });
  });

  describe('approveChange', () => {
    it('should move pending change to approved changes', () => {
      const context = contextManager.getOrCreateContext(testSessionId);
      
      const changeId = contextManager.addPendingChange(
        testSessionId,
        'location',
        'रायपुर',
        0.9,
        'ai_suggestion'
      );
      
      const approved = contextManager.approveChange(testSessionId, changeId, 'user');
      
      expect(approved).toBe(true);
      expect(context.pendingChanges).toHaveLength(0);
      expect(context.approvedChanges).toHaveLength(1);
      expect(context.approvedChanges[0].field).toBe('location');
      expect(context.approvedChanges[0].value).toBe('रायपुर');
      expect(context.approvedChanges[0].approvedBy).toBe('user');
    });

    it('should return false if changeId does not exist', () => {
      const context = contextManager.getOrCreateContext(testSessionId);
      
      const approved = contextManager.approveChange(testSessionId, 'non-existent-id', 'user');
      
      expect(approved).toBe(false);
      expect(context.approvedChanges).toHaveLength(0);
    });

    it('should update tweet context when available', () => {
      const context = contextManager.getOrCreateContext(testSessionId, 'tweet-123');
      
      const changeId = contextManager.addPendingChange(
        testSessionId,
        'location',
        'रायपुर',
        0.9,
        'user'
      );
      
      contextManager.approveChange(testSessionId, changeId, 'user');
      
      expect(context.currentTweet?.currentState.location).toBe('रायपुर');
      expect(context.currentTweet?.editHistory.length).toBeGreaterThan(0);
    });

    it('should not update tweet context when not available', () => {
      const context = contextManager.getOrCreateContext(testSessionId);
      expect(context.currentTweet).toBeUndefined();
      
      const changeId = contextManager.addPendingChange(testSessionId, 'location', 'test', 0.8, 'user');
      const result = contextManager.approveChange(testSessionId, changeId, 'user');
      
      expect(result).toBe(true);
      expect(context.currentTweet).toBeUndefined();
    });

    it('should update lastActivity on approve', () => {
      const context = contextManager.getOrCreateContext(testSessionId);
      const changeId = contextManager.addPendingChange(testSessionId, 'location', 'test', 0.8, 'user');
      
      const oldActivity = context.lastActivity;
      
      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);
      
      contextManager.approveChange(testSessionId, changeId, 'user');
      
      expect(context.lastActivity.getTime()).toBeGreaterThanOrEqual(oldActivity.getTime());
      
      jest.useRealTimers();
    });
  });

  describe('rejectChange', () => {
    it('should move pending change to rejected changes', () => {
      const context = contextManager.getOrCreateContext(testSessionId);
      
      const changeId = contextManager.addPendingChange(
        testSessionId,
        'location',
        'Invalid Location',
        0.5,
        'ai_suggestion'
      );
      
      const rejected = contextManager.rejectChange(testSessionId, changeId, 'Location not found in database');
      
      expect(rejected).toBe(true);
      expect(context.pendingChanges).toHaveLength(0);
      expect(context.rejectedChanges).toHaveLength(1);
      expect(context.rejectedChanges[0].field).toBe('location');
      expect(context.rejectedChanges[0].value).toBe('Invalid Location');
      expect(context.rejectedChanges[0].reason).toBe('Location not found in database');
    });

    it('should return false if changeId does not exist', () => {
      const rejected = contextManager.rejectChange(testSessionId, 'non-existent-id', 'reason');
      
      expect(rejected).toBe(false);
    });

    it('should update lastActivity on reject', () => {
      const context = contextManager.getOrCreateContext(testSessionId);
      const changeId = contextManager.addPendingChange(testSessionId, 'location', 'test', 0.8, 'user');
      
      const oldActivity = context.lastActivity;
      
      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);
      
      contextManager.rejectChange(testSessionId, changeId, 'reason');
      
      expect(context.lastActivity.getTime()).toBeGreaterThanOrEqual(oldActivity.getTime());
      
      jest.useRealTimers();
    });
  });

  describe('getRelevantContext', () => {
    it('should return formatted context string', () => {
      const context = contextManager.getOrCreateContext(testSessionId);
      
      const turn: ConversationTurn = {
        turnId: 'turn-1',
        userMessage: 'Hello',
        aiResponse: 'Hi!',
        timestamp: new Date(),
        actions: ['greet'],
        entities: {},
        confidence: 0.9
      };
      
      contextManager.updateContext(testSessionId, turn);
      
      const relevantContext = contextManager.getRelevantContext(testSessionId);
      
      expect(relevantContext).toContain('Previous conversation:');
      expect(relevantContext).toContain('Hello');
      expect(relevantContext).toContain('Hi!');
      expect(relevantContext).toContain('Current stage:');
    });

    it('should include pending changes in context', () => {
      const context = contextManager.getOrCreateContext(testSessionId);
      
      contextManager.addPendingChange(testSessionId, 'location', 'रायपुर', 0.9, 'ai_suggestion');
      
      const relevantContext = contextManager.getRelevantContext(testSessionId);
      
      expect(relevantContext).toContain('Pending changes:');
      expect(relevantContext).toContain('location');
      expect(relevantContext).toContain('रायपुर');
    });

    it('should include approved changes in context', () => {
      const changeId = contextManager.addPendingChange(testSessionId, 'event_type', 'MEETING', 0.9, 'user');
      contextManager.approveChange(testSessionId, changeId, 'user');
      
      const relevantContext = contextManager.getRelevantContext(testSessionId);
      
      expect(relevantContext).toContain('Approved changes:');
      expect(relevantContext).toContain('event_type');
    });

    it('should include rejected changes in context', () => {
      const changeId = contextManager.addPendingChange(testSessionId, 'location', 'Invalid', 0.5, 'ai_suggestion');
      contextManager.rejectChange(testSessionId, changeId, 'Not found');
      
      const relevantContext = contextManager.getRelevantContext(testSessionId);
      
      expect(relevantContext).toContain('Rejected changes');
      expect(relevantContext).toContain('Not found');
    });

    it('should include user preferences in context', () => {
      const relevantContext = contextManager.getRelevantContext(testSessionId);
      
      expect(relevantContext).toContain('User preferences:');
      expect(relevantContext).toContain('Language:');
      expect(relevantContext).toContain('Verbosity:');
    });

    it('should limit conversation history to last 3 turns', () => {
      // Add 5 turns
      for (let i = 0; i < 5; i++) {
        const turn: ConversationTurn = {
          turnId: `turn-${i}`,
          userMessage: `Message ${i}`,
          aiResponse: `Response ${i}`,
          timestamp: new Date(),
          actions: ['test'],
          entities: {},
          confidence: 0.8
        };
        contextManager.updateContext(testSessionId, turn);
      }
      
      const relevantContext = contextManager.getRelevantContext(testSessionId);
      
      // Should only contain last 3 turns
      expect(relevantContext).toContain('Message 2');
      expect(relevantContext).toContain('Message 3');
      expect(relevantContext).toContain('Message 4');
      expect(relevantContext).not.toContain('Message 0');
      expect(relevantContext).not.toContain('Message 1');
    });

    it('should handle empty conversation flow', () => {
      const relevantContext = contextManager.getRelevantContext(testSessionId);
      
      expect(relevantContext).toContain('Current stage:');
      expect(relevantContext).not.toContain('Previous conversation:');
    });

    it('should limit approved changes to last 5', () => {
      // Add 7 approved changes
      for (let i = 0; i < 7; i++) {
        const changeId = contextManager.addPendingChange(testSessionId, `field${i}`, `value${i}`, 0.8, 'user');
        contextManager.approveChange(testSessionId, changeId, 'user');
      }
      
      const relevantContext = contextManager.getRelevantContext(testSessionId);
      
      // Should only contain last 5 approved
      expect(relevantContext).toContain('field2');
      expect(relevantContext).toContain('field6');
      expect(relevantContext).not.toContain('field0');
      expect(relevantContext).not.toContain('field1');
    });

    it('should limit rejected changes to last 3', () => {
      // Add 5 rejected changes
      for (let i = 0; i < 5; i++) {
        const changeId = contextManager.addPendingChange(testSessionId, `field${i}`, `value${i}`, 0.5, 'ai_suggestion');
        contextManager.rejectChange(testSessionId, changeId, `reason${i}`);
      }
      
      const relevantContext = contextManager.getRelevantContext(testSessionId);
      
      // Should only contain last 3 rejected
      expect(relevantContext).toContain('field2');
      expect(relevantContext).toContain('field4');
      expect(relevantContext).not.toContain('field0');
      expect(relevantContext).not.toContain('field1');
    });

    it('should include focusField when set', () => {
      contextManager.updateContext(testSessionId, {
        turnId: 'turn-1',
        userMessage: 'Test',
        aiResponse: 'Response',
        timestamp: new Date(),
        actions: ['test'],
        entities: {},
        confidence: 0.8
      } as ConversationTurn, 'editing', 'location');
      
      const relevantContext = contextManager.getRelevantContext(testSessionId);
      
      expect(relevantContext).toContain('Focus field: location');
    });

    it('should not include focusField when not set', () => {
      const relevantContext = contextManager.getRelevantContext(testSessionId);
      
      // Should not have Focus field line when focusField is undefined
      const lines = relevantContext.split('\n');
      const focusLine = lines.find(line => line.includes('Focus field:'));
      expect(focusLine).toBeUndefined();
    });
  });

  describe('getContextualSuggestions', () => {
    it('should return suggestions based on stage', () => {
      const context = contextManager.getOrCreateContext(testSessionId);
      contextManager.updateContext(testSessionId, {
        turnId: 'turn-1',
        userMessage: 'Test',
        aiResponse: 'Response',
        timestamp: new Date(),
        actions: ['test'],
        entities: {},
        confidence: 0.8
      } as ConversationTurn, 'analyzing');
      
      const suggestions = contextManager.getContextualSuggestions(testSessionId);
      
      expect(suggestions.nextActions).toContain('generateSuggestions');
      expect(suggestions.nextActions).toContain('addLocation');
      expect(suggestions.focusAreas).toEqual([]);
      expect(suggestions.warnings).toEqual([]);
    });

    it('should return suggestions for suggesting stage', () => {
      contextManager.updateContext(testSessionId, {
        turnId: 'turn-1',
        userMessage: 'Test',
        aiResponse: 'Response',
        timestamp: new Date(),
        actions: ['test'],
        entities: {},
        confidence: 0.8
      } as ConversationTurn, 'suggesting');
      
      const suggestions = contextManager.getContextualSuggestions(testSessionId);
      
      expect(suggestions.nextActions).toContain('validateData');
      expect(suggestions.nextActions).toContain('approveChanges');
    });

    it('should return suggestions for editing stage', () => {
      contextManager.updateContext(testSessionId, {
        turnId: 'turn-1',
        userMessage: 'Test',
        aiResponse: 'Response',
        timestamp: new Date(),
        actions: ['test'],
        entities: {},
        confidence: 0.8
      } as ConversationTurn, 'editing');
      
      const suggestions = contextManager.getContextualSuggestions(testSessionId);
      
      expect(suggestions.nextActions).toContain('validateData');
      expect(suggestions.nextActions).toContain('generateHashtags');
    });

    it('should return suggestions for validating stage', () => {
      contextManager.updateContext(testSessionId, {
        turnId: 'turn-1',
        userMessage: 'Test',
        aiResponse: 'Response',
        timestamp: new Date(),
        actions: ['test'],
        entities: {},
        confidence: 0.8
      } as ConversationTurn, 'validating');
      
      const suggestions = contextManager.getContextualSuggestions(testSessionId);
      
      expect(suggestions.nextActions).toContain('approveChanges');
      expect(suggestions.nextActions).toContain('rejectChanges');
    });

    it('should return empty suggestions for unknown stage', () => {
      contextManager.updateContext(testSessionId, {
        turnId: 'turn-1',
        userMessage: 'Test',
        aiResponse: 'Response',
        timestamp: new Date(),
        actions: ['test'],
        entities: {},
        confidence: 0.8
      } as ConversationTurn, 'initializing');
      
      const suggestions = contextManager.getContextualSuggestions(testSessionId);
      
      expect(suggestions.nextActions).toEqual([]);
    });

    it('should include focusAreas from pending changes', () => {
      contextManager.addPendingChange(testSessionId, 'location', 'test', 0.8, 'user');
      contextManager.addPendingChange(testSessionId, 'event_type', 'MEETING', 0.8, 'user');
      
      const suggestions = contextManager.getContextualSuggestions(testSessionId);
      
      expect(suggestions.focusAreas).toContain('location');
      expect(suggestions.focusAreas).toContain('event_type');
    });

    it('should add warnings for multiple rejections', () => {
      const change1 = contextManager.addPendingChange(testSessionId, 'field1', 'value1', 0.5, 'ai_suggestion');
      const change2 = contextManager.addPendingChange(testSessionId, 'field2', 'value2', 0.5, 'ai_suggestion');
      const change3 = contextManager.addPendingChange(testSessionId, 'field3', 'value3', 0.5, 'ai_suggestion');
      
      contextManager.rejectChange(testSessionId, change1, 'reason1');
      contextManager.rejectChange(testSessionId, change2, 'reason2');
      contextManager.rejectChange(testSessionId, change3, 'reason3');
      
      const suggestions = contextManager.getContextualSuggestions(testSessionId);
      
      expect(suggestions.warnings.length).toBeGreaterThan(0);
      expect(suggestions.warnings[0]).toContain('Multiple rejections');
    });
  });

  describe('updateUserPreferences', () => {
    it('should update user preferences', () => {
      const context = contextManager.getOrCreateContext(testSessionId);
      
      contextManager.updateUserPreferences(testSessionId, {
        language: 'hindi',
        verbosity: 'brief'
      });
      
      expect(context.userPreferences.language).toBe('hindi');
      expect(context.userPreferences.verbosity).toBe('brief');
      // Other preferences should remain unchanged
      expect(context.userPreferences.autoSuggest).toBe(true);
      expect(context.userPreferences.validationLevel).toBe('moderate');
    });

    it('should update lastActivity when updating preferences', () => {
      const context = contextManager.getOrCreateContext(testSessionId);
      const oldActivity = context.lastActivity;
      
      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);
      
      contextManager.updateUserPreferences(testSessionId, { language: 'hindi' });
      
      expect(context.lastActivity.getTime()).toBeGreaterThanOrEqual(oldActivity.getTime());
      
      jest.useRealTimers();
    });
  });

  describe('clearContext', () => {
    it('should remove context from manager', () => {
      const context1 = contextManager.getOrCreateContext(testSessionId);
      contextManager.addPendingChange(testSessionId, 'location', 'test', 0.8, 'user');
      
      contextManager.clearContext(testSessionId);
      
      const context2 = contextManager.getOrCreateContext(testSessionId);
      
      expect(context2).not.toBe(context1);
      expect(context2.pendingChanges).toHaveLength(0);
    });
  });

  describe('getContextSummary', () => {
    it('should return summary of context state', () => {
      const context = contextManager.getOrCreateContext(testSessionId, 'tweet-123');
      contextManager.addPendingChange(testSessionId, 'location', 'test', 0.8, 'user');
      const changeId = contextManager.addPendingChange(testSessionId, 'event_type', 'MEETING', 0.8, 'user');
      contextManager.approveChange(testSessionId, changeId, 'user');
      
      const summary = contextManager.getContextSummary(testSessionId);
      
      expect(summary.sessionId).toBe(testSessionId);
      expect(summary.stage).toBe('initializing');
      expect(summary.pendingChanges).toBe(1);
      expect(summary.approvedChanges).toBe(1);
      expect(summary.rejectedChanges).toBe(0);
      expect(summary.conversationTurns).toBe(0);
      expect(summary.userPreferences).toBeDefined();
    });
  });

  describe('cleanupExpiredContexts', () => {
    it('should remove contexts older than maxContextAge', () => {
      const context1 = contextManager.getOrCreateContext('session-1');
      const context2 = contextManager.getOrCreateContext('session-2');
      
      // Simulate expired context
      context1.lastActivity = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      
      contextManager.cleanupExpiredContexts();
      
      // Expired context should be removed
      const newContext1 = contextManager.getOrCreateContext('session-1');
      expect(newContext1).not.toBe(context1);
      
      // Active context should remain
      const sameContext2 = contextManager.getOrCreateContext('session-2');
      expect(sameContext2).toBe(context2);
    });
  });
});

