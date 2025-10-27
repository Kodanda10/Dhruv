import { NextRequest, NextResponse } from 'next/server';
import { aiAssistant } from '@/lib/ai-assistant/langgraph-assistant';
import { contextManager } from '@/lib/ai-assistant/context-manager';
import { modelOrchestrator } from '@/lib/ai-assistant/model-manager';

export async function POST(request: NextRequest) {
  try {
    const { 
      message, 
      tweetData, 
      sessionId, 
      useBothModels = false,
      action = 'chat' 
    } = await request.json();

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      );
    }

    // Generate session ID if not provided
    const currentSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get or create conversation context
    const context = contextManager.getOrCreateContext(currentSessionId, tweetData?.tweet_id);

    // Process message with AI Assistant
    const aiResponse = await aiAssistant.processMessage(
      message,
      tweetData || {},
      useBothModels,
      currentSessionId
    );

    // Update conversation context
    contextManager.updateContext(currentSessionId, {
      turnId: `turn_${Date.now()}`,
      userMessage: message,
      aiResponse: aiResponse.message,
      timestamp: new Date(),
      actions: [aiResponse.action],
      entities: {
        intent: aiResponse.action,
        confidence: aiResponse.confidence
      },
      confidence: aiResponse.confidence
    }, 'editing');

    // Add pending changes to context if any
    for (const change of aiResponse.pendingChanges) {
      contextManager.addPendingChange(
        currentSessionId,
        change.field,
        change.value,
        change.confidence,
        change.source,
        change.reason
      );
    }

    // Get contextual suggestions
    const contextualSuggestions = contextManager.getContextualSuggestions(currentSessionId);

    // Get model metrics for debugging
    const modelMetrics = modelOrchestrator.getModelMetrics();

    return NextResponse.json({
      success: true,
      response: aiResponse.message,
      action: aiResponse.action,
      confidence: aiResponse.confidence,
      suggestions: aiResponse.suggestions,
      pendingChanges: aiResponse.pendingChanges,
      contextualSuggestions,
      sessionId: currentSessionId,
      modelUsed: aiResponse.modelUsed || 'gemini',
      modelMetrics: {
        gemini: {
          totalRequests: modelMetrics.gemini.totalRequests,
          errorRate: modelMetrics.gemini.errorRate,
          averageResponseTime: modelMetrics.gemini.averageResponseTime
        },
        ollama: {
          totalRequests: modelMetrics.ollama.totalRequests,
          errorRate: modelMetrics.ollama.errorRate,
          averageResponseTime: modelMetrics.ollama.averageResponseTime
        }
      },
      context: {
        stage: context.stage,
        focusField: context.focusField,
        pendingChangesCount: context.pendingChanges.length,
        approvedChangesCount: context.approvedChanges.length
      }
    });

  } catch (error) {
    console.error('AI Assistant API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle auto-suggestions endpoint
export async function PUT(request: NextRequest) {
  try {
    const { tweetData, sessionId } = await request.json();

    if (!tweetData) {
      return NextResponse.json(
        { success: false, error: 'Tweet data is required' },
        { status: 400 }
      );
    }

    const currentSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Generate auto-suggestions
    const aiResponse = await aiAssistant.processMessage(
      'Generate suggestions for this tweet',
      tweetData,
      false
    );

    // Update context for suggestions
    contextManager.updateContext(currentSessionId, {
      turnId: `suggestions_${Date.now()}`,
      userMessage: 'Generate suggestions',
      aiResponse: aiResponse.message,
      timestamp: new Date(),
      actions: ['generateSuggestions'],
      entities: { intent: 'get_suggestions' },
      confidence: aiResponse.confidence
    }, 'suggesting');

    return NextResponse.json({
      success: true,
      suggestions: aiResponse.suggestions,
      pendingChanges: aiResponse.pendingChanges,
      sessionId: currentSessionId,
      confidence: aiResponse.confidence
    });

  } catch (error) {
    console.error('AI Assistant suggestions error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to generate suggestions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle validation endpoint
export async function PATCH(request: NextRequest) {
  try {
    const { tweetData, sessionId } = await request.json();

    if (!tweetData) {
      return NextResponse.json(
        { success: false, error: 'Tweet data is required' },
        { status: 400 }
      );
    }

    const currentSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Validate data consistency
    const aiResponse = await aiAssistant.processMessage(
      'Validate data consistency',
      tweetData,
      false
    );

    // Update context for validation
    contextManager.updateContext(currentSessionId, {
      turnId: `validation_${Date.now()}`,
      userMessage: 'Validate data',
      aiResponse: aiResponse.message,
      timestamp: new Date(),
      actions: ['validateData'],
      entities: { intent: 'validate_data' },
      confidence: aiResponse.confidence
    }, 'validating');

    return NextResponse.json({
      success: true,
      validation: {
        isValid: aiResponse.confidence > 0.7,
        issues: aiResponse.pendingChanges.filter(c => c.source === 'validation'),
        suggestions: aiResponse.suggestions
      },
      sessionId: currentSessionId,
      confidence: aiResponse.confidence
    });

  } catch (error) {
    console.error('AI Assistant validation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to validate data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}