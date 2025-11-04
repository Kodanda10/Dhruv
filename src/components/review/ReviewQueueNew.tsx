/**
 * Enhanced Review Queue Component
 *
 * Hindi-Only Dashboard: All UI elements and messages in Hindi
 * AI Integration: LangGraph assistant for intelligent suggestions
 * Human-in-the-Loop: Edit form with approval/rejection workflow
 * Accessibility: WCAG 2.1 AA compliant navigation and forms
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import AIReviewAssistant from './AIReviewAssistant';
import ReviewEditForm from './ReviewEditForm';
import { formatHindiDate } from '@/lib/utils';

interface ParsedTweet {
  id: string;
  content: string;
  text: string;
  event_type: string;
  event_type_hi?: string;
  event_type_confidence?: number;
  locations: string[];
  people_mentioned: string[];
  organizations: string[];
  schemes_mentioned: string[];
  confidence?: number;
  needs_review: boolean;
  review_status: string;
  timestamp: string;
  parsed_by?: string;
  parsed_at?: string;
}

export default function ReviewQueueNew() {
  const { isAuthenticated } = useAuth();
  const [tweets, setTweets] = useState<ParsedTweet[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Only show for authenticated admin users
  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <div className="text-muted">
          <p className="text-lg mb-4">🔒 व्यवस्थापक पहुंच आवश्यक</p>
          <p className="text-sm">समीक्षा कार्य करने के लिए कृपया लॉगिन करें।</p>
        </div>
      </div>
    );
  }

  // Fetch tweets needing review
  const fetchTweets = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/parsed-events?needs_review=true&limit=50');
      const data = await response.json();

      if (data.success) {
        setTweets(data.data || []);
        setCurrentIndex(0);
      } else {
        setError('ट्वीट लोड करने में त्रुटि');
      }
    } catch (err) {
      console.error('Error fetching tweets:', err);
      setError('ट्वीट लोड करने में त्रुटि');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTweets();
  }, [fetchTweets]);

  // Handle AI suggestion acceptance
  const handleAISuggestionAccept = useCallback(async (suggestion: any) => {
    if (tweets.length === 0) return;

    const currentTweet = tweets[currentIndex];
    try {
      // Update the tweet with AI suggestions
      await handleSave({
        ...currentTweet,
        event_type: suggestion.event_type,
        event_type_hi: suggestion.event_type_hi || suggestion.event_type,
        locations: suggestion.locations || [],
        people_mentioned: suggestion.people_mentioned || [],
        organizations: suggestion.organizations || [],
        schemes_mentioned: suggestion.schemes_mentioned || [],
        review_notes: `AI सुझाव स्वीकार किया गया: ${suggestion.reasoning || ''}`
      });

      console.log('AI suggestion applied:', suggestion);
    } catch (error) {
      console.error('Error applying AI suggestion:', error);
      setError('AI सुझाव लागू करने में त्रुटि');
    }
  }, [tweets, currentIndex]);

  // Handle save edits
  const handleSave = useCallback(async (updatedTweet: ParsedTweet & { review_notes?: string }) => {
    try {
      const response = await fetch('/api/review/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTweet),
      });

      const data = await response.json();

      if (data.success) {
        // Update local state
        setTweets(prev => prev.map(tweet =>
          tweet.id === updatedTweet.id ? { ...updatedTweet, needs_review: false } : tweet
        ));

        // Move to next tweet if current one was updated
        if (currentIndex < tweets.length - 1) {
          setCurrentIndex(prev => prev + 1);
        }
      } else {
        setError(data.error || 'सहेजने में त्रुटि');
      }
    } catch (err) {
      console.error('Error saving:', err);
      setError('सहेजने में त्रुटि');
    }
  }, [tweets, currentIndex]);

  // Handle approval
  const handleApprove = useCallback(async (tweetId: string, notes: string) => {
    try {
      const response = await fetch('/api/review/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tweetId,
          action: 'approve',
          notes
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update local state
        setTweets(prev => prev.filter(tweet => tweet.id !== tweetId));

        // Adjust current index if necessary
        if (currentIndex >= tweets.length - 1) {
          setCurrentIndex(Math.max(0, currentIndex - 1));
        }
      } else {
        setError(data.error || 'मंजूरी देने में त्रुटि');
      }
    } catch (err) {
      console.error('Error approving:', err);
      setError('मंजूरी देने में त्रुटि');
    }
  }, [tweets, currentIndex]);

  // Handle rejection
  const handleReject = useCallback(async (tweetId: string, notes: string) => {
    try {
      const response = await fetch('/api/review/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tweetId,
          action: 'reject',
          notes
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update local state
        setTweets(prev => prev.filter(tweet => tweet.id !== tweetId));

        // Adjust current index if necessary
        if (currentIndex >= tweets.length - 1) {
          setCurrentIndex(Math.max(0, currentIndex - 1));
        }
      } else {
        setError(data.error || 'अस्वीकार करने में त्रुटि');
      }
    } catch (err) {
      console.error('Error rejecting:', err);
      setError('अस्वीकार करने में त्रुटि');
    }
  }, [tweets, currentIndex]);

  // Handle skip
  const handleSkip = useCallback(async (tweetId: string) => {
    try {
      const response = await fetch('/api/review/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tweetId,
          action: 'skip'
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Move to next tweet
        if (currentIndex < tweets.length - 1) {
          setCurrentIndex(prev => prev + 1);
        }
      } else {
        setError(data.error || 'छोड़ने में त्रुटि');
      }
    } catch (err) {
      console.error('Error skipping:', err);
      setError('छोड़ने में त्रुटि');
    }
  }, [tweets, currentIndex]);

  // Navigation
  const handlePrevious = useCallback(() => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentIndex(prev => Math.min(tweets.length - 1, prev + 1));
  }, [tweets.length]);

  // Loading state
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-muted">समीक्षा के लिए ट्वीट लोड हो रहे हैं...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">
          <p className="text-lg">⚠️ त्रुटि</p>
          <p className="text-sm">{error}</p>
        </div>
        <button
          onClick={fetchTweets}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200"
        >
          पुनः प्रयास करें
        </button>
      </div>
    );
  }

  // No tweets state
  if (tweets.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-muted">
          <p className="text-lg mb-4">🎉 सभी ट्वीट समीक्षा हो चुके हैं!</p>
          <p className="text-sm">समीक्षा के लिए कोई ट्वीट नहीं मिला।</p>
        </div>
      </div>
    );
  }

  const currentTweet = tweets[currentIndex];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-primary mb-2">ट्वीट समीक्षा कतार</h2>
        <p className="text-muted">
          ट्वीट {currentIndex + 1} / {tweets.length} • ID: {currentTweet.id}
        </p>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 rounded-md transition-colors duration-200"
          aria-label="पिछला ट्वीट"
        >
          ← पिछला
        </button>

        <div className="text-sm text-muted">
          {formatHindiDate(currentTweet.timestamp)}
        </div>

        <button
          onClick={handleNext}
          disabled={currentIndex === tweets.length - 1}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 rounded-md transition-colors duration-200"
          aria-label="अगला ट्वीट"
        >
          अगला →
        </button>
      </div>

      {/* Tweet Content */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="font-semibold text-lg mb-3">ट्वीट सामग्री</h3>
        <div className="bg-gray-50 p-4 rounded-md">
          <p className="text-gray-800 whitespace-pre-wrap">{currentTweet.content || currentTweet.text}</p>
        </div>

        {/* Current Classification */}
        <div className="mt-4 p-3 bg-blue-50 border-l-4 border-blue-300 rounded">
          <h4 className="font-medium text-blue-900 mb-2">वर्तमान वर्गीकरण</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">घटना प्रकार:</span>
              <span className="ml-2 text-blue-700">{currentTweet.event_type_hi || currentTweet.event_type}</span>
              {currentTweet.event_type_confidence && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  {Math.round(currentTweet.event_type_confidence * 100)}%
                </span>
              )}
            </div>
            <div>
              <span className="font-medium text-gray-700">स्थान:</span>
              <span className="ml-2 text-blue-700">{currentTweet.locations?.join(', ') || 'कोई नहीं'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">व्यक्ति:</span>
              <span className="ml-2 text-blue-700">{currentTweet.people_mentioned?.join(', ') || 'कोई नहीं'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">योजनाएं:</span>
              <span className="ml-2 text-blue-700">{currentTweet.schemes_mentioned?.join(', ') || 'कोई नहीं'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Review Assistant */}
      <AIReviewAssistant
        tweet={{
          id: currentTweet.id,
          content: currentTweet.content || currentTweet.text,
          event_type: currentTweet.event_type,
          locations: currentTweet.locations || [],
          people_mentioned: currentTweet.people_mentioned || [],
          organizations: currentTweet.organizations || [],
          schemes_mentioned: currentTweet.schemes_mentioned || [],
          needs_review: currentTweet.needs_review
        }}
        onSuggestionAccept={handleAISuggestionAccept}
      />

      {/* Review Edit Form */}
      <ReviewEditForm
        tweet={currentTweet}
        onSave={handleSave}
        onApprove={handleApprove}
        onReject={handleReject}
        onSkip={handleSkip}
      />
    </div>
  );
}
