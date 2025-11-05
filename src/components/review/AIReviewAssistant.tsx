/**
 * AI Review Assistant Component
 *
 * Hindi-Only Dashboard: All UI text, prompts, and error messages in Hindi
 * AI Integration: Connects to LangGraph assistant for context-aware suggestions
 * Human-in-the-Loop: Accept/reject AI suggestions with visual feedback
 * Accessibility: WCAG 2.1 AA compliant with screen reader support
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface ParsedTweet {
  id: string;
  content: string;
  event_type: string;
  locations: string[];
  people_mentioned: string[];
  organizations: string[];
  schemes_mentioned: string[];
  needs_review: boolean;
}

interface AISuggestion {
  event_type?: string;
  event_type_confidence?: number;
  locations?: string[];
  people_mentioned?: string[];
  organizations?: string[];
  schemes_mentioned?: string[];
  reasoning?: string;
}

interface AIReviewAssistantProps {
  tweet: ParsedTweet;
  onSuggestionAccept: (suggestion: AISuggestion) => void;
}

export default function AIReviewAssistant({ tweet, onSuggestionAccept }: AIReviewAssistantProps) {
  const { isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Only show for authenticated admin users
  if (!isAuthenticated) {
    return null;
  }

  const fetchAISuggestions = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    setSuggestion(null);

    try {
      console.log('AI सहायक से सुझाव प्राप्त किए जा रहे हैं...', { tweetId: tweet.id });

      // Import LangGraph assistant dynamically to avoid SSR issues
      const { getAIAssistant } = await import('@/lib/ai-assistant/langgraph-assistant');

      const assistant = getAIAssistant();

      // Convert ParsedTweet to TweetData format
      const tweetData = {
        tweet_id: tweet.id,
        text: tweet.content,
        event_type: tweet.event_type,
        locations: tweet.locations,
        people_mentioned: tweet.people_mentioned,
        organizations: tweet.organizations,
        schemes_mentioned: tweet.schemes_mentioned,
      };

      const aiSuggestion = await assistant.generateSuggestions(tweetData);

      if (!aiSuggestion || typeof aiSuggestion !== 'object') {
        throw new Error('अमान्य AI प्रतिक्रिया प्राप्त हुई');
      }

      setSuggestion(aiSuggestion);
      console.log('AI सुझाव प्राप्त हो गए:', aiSuggestion);

    } catch (err) {
      console.error('AI सुझाव प्राप्त करने में त्रुटि:', err);
      setError(err instanceof Error ? err.message : 'AI सहायक से संपर्क करने में त्रुटि');
    } finally {
      setIsLoading(false);
    }
  }, [tweet, isLoading]);

  const handleAcceptSuggestion = useCallback(() => {
    if (!suggestion) return;

    console.log('AI सुझाव स्वीकार किया गया:', suggestion);
    onSuggestionAccept(suggestion);
    setHasInteracted(true);
  }, [suggestion, onSuggestionAccept]);

  const handleRejectSuggestion = useCallback(() => {
    console.log('AI सुझाव अस्वीकार किया गया');
    setHasInteracted(true);
    setSuggestion(null);
  }, []);

  return (
    <div
      className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 shadow-sm"
      role="region"
      aria-label="AI सहायक सुझाव"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
          🤖 AI सहायक सुझाव
        </h3>

        <button
          onClick={fetchAISuggestions}
          disabled={isLoading}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed"
          aria-label="AI से नई सुझाव प्राप्त करें"
        >
          {isLoading ? '⏳ प्राप्त हो रहा है...' : '🔄 पुनः प्राप्त करें'}
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8" role="status" aria-live="polite">
          <div className="flex items-center gap-3 text-blue-700">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-700"></div>
            <span>सुझाव प्राप्त हो रहे हैं...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div
          className="bg-red-50 border border-red-200 rounded-md p-3 text-red-800"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-center gap-2">
            <span className="text-red-600">⚠️</span>
            <span className="font-medium">सुझाव प्राप्त करने में त्रुटि</span>
          </div>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-xs text-red-600 hover:text-red-800 underline focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded"
          >
            त्रुटि छिपाएं
          </button>
        </div>
      )}

      {/* AI Suggestions Display */}
      {suggestion && !isLoading && !error && (
        <div className="space-y-4">
          <div className="bg-white border border-blue-200 rounded-md p-4 shadow-sm">
            <h4 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
              💡 AI सुझाव
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                आत्मविश्वास: {Math.round((suggestion.event_type_confidence || 0) * 100)}%
              </span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">घटना प्रकार:</span>
                <span className="ml-2 text-blue-700 font-medium">{suggestion.event_type}</span>
              </div>

              {suggestion.locations && suggestion.locations.length > 0 && (
                <div>
                  <span className="font-medium text-gray-700">स्थान:</span>
                  <span className="ml-2 text-blue-700">{suggestion.locations.join(', ')}</span>
                </div>
              )}

              {suggestion.people_mentioned && suggestion.people_mentioned.length > 0 && (
                <div>
                  <span className="font-medium text-gray-700">उल्लिखित व्यक्ति:</span>
                  <span className="ml-2 text-blue-700">{suggestion.people_mentioned.join(', ')}</span>
                </div>
              )}

              {suggestion.organizations && suggestion.organizations.length > 0 && (
                <div>
                  <span className="font-medium text-gray-700">संगठन:</span>
                  <span className="ml-2 text-blue-700">{suggestion.organizations.join(', ')}</span>
                </div>
              )}

              {suggestion.schemes_mentioned && suggestion.schemes_mentioned.length > 0 && (
                <div>
                  <span className="font-medium text-gray-700">योजनाएं:</span>
                  <span className="ml-2 text-blue-700">{suggestion.schemes_mentioned.join(', ')}</span>
                </div>
              )}
            </div>

            {suggestion.reasoning && (
              <div className="mt-3 p-3 bg-blue-50 border-l-4 border-blue-300 rounded">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">कारण:</span> {suggestion.reasoning}
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {!hasInteracted && (
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleRejectSuggestion}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                aria-label="AI सुझाव अस्वीकार करें"
              >
                अस्वीकार करें
              </button>

              <button
                onClick={handleAcceptSuggestion}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                aria-label="AI सुझाव स्वीकार करें"
              >
                ✅ स्वीकार करें
              </button>
            </div>
          )}

          {/* Feedback Message */}
          {hasInteracted && (
            <div className="text-center py-4">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                suggestion ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
              }`}>
                {suggestion ? (
                  <>
                    <span>✅</span>
                    <span>सुझाव स्वीकार कर लिया गया</span>
                  </>
                ) : (
                  <>
                    <span>👎</span>
                    <span>सुझाव अस्वीकार कर दिया गया</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Initial State */}
      {!isLoading && !suggestion && !error && (
        <div className="text-center py-8 text-blue-700">
          <div className="text-4xl mb-3">🤖</div>
          <p className="text-sm">
            AI सहायक से सटीक वर्गीकरण सुझाव प्राप्त करने के लिए "पुनः प्राप्त करें" बटन पर क्लिक करें
          </p>
        </div>
      )}
    </div>
  );
}
