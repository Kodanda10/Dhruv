import { NextRequest, NextResponse } from 'next/server';
import { DynamicLearningSystem } from '@/lib/dynamic-learning';

export async function POST(request: NextRequest) {
  try {
    const { action, data } = await request.json();

    const learningSystem = new DynamicLearningSystem();

    switch (action) {
      case 'learn_from_feedback':
        const feedbackResult = await learningSystem.learnFromHumanFeedback(data);
        return NextResponse.json(feedbackResult);

      case 'get_suggestions':
        const suggestionsResult = await learningSystem.getIntelligentSuggestions(data);
        return NextResponse.json(suggestionsResult);

      case 'update_reference_datasets':
        const updateResult = await learningSystem.updateReferenceDatasets(data);
        return NextResponse.json(updateResult);

      case 'get_learning_insights':
        const insightsResult = await learningSystem.getLearningInsights();
        return NextResponse.json(insightsResult);

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Dynamic Learning API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
