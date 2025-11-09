/**
 * AI Assistant Demo Page
 */

'use client';

import React, { useState, useEffect } from 'react';
import AIReviewAssistant, { AISuggestion } from '@/labs/ai/AIReviewAssistant';

export default function AIPage() {
  const [tweet, setTweet] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch a real tweet from database
    const fetchTweet = async () => {
      try {
        const response = await fetch('/api/parsed-events?limit=1&needs_review=true');
        const data = await response.json();

        if (data.success && data.events && data.events.length > 0) {
          const event = data.events[0];
          setTweet({
            id: event.id || event.tweet_id,
            content: event.text || event.content || '',
            event_type: event.event_type || 'other',
            locations: Array.isArray(event.locations) ? event.locations.map((l: any) => typeof l === 'string' ? l : l.name || '') : [],
            people_mentioned: event.people_mentioned || [],
            organizations: event.organizations || [],
            schemes_mentioned: event.schemes_mentioned || [],
            needs_review: event.needs_review || false,
          });
        } else {
          setError('कोई ट्वीट नहीं मिला');
        }
      } catch (err: any) {
        setError(err.message || 'ट्वीट लोड करने में त्रुटि');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTweet();
  }, []);

  const handleSuggestionAccept = (suggestion: AISuggestion) => {
    console.log('Suggestion accepted:', suggestion);
    // In production, this would update the database
    alert('सुझाव स्वीकार कर लिया गया (डेटाबेस अपडेट किया जाएगा)');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="text-white mt-4">लोड हो रहा है...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8 flex items-center justify-center">
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-6">
          <p className="text-red-200">{error}</p>
        </div>
      </div>
    );
  }

  if (!tweet) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6">
          <p className="text-white">कोई ट्वीट उपलब्ध नहीं</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 shadow-xl border border-white/20 mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">🤖 AI Assistant Demo</h1>
          <p className="text-white/80">AI सहायक सुझाव का परीक्षण करें</p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 shadow-xl border border-white/20 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">ट्वीट</h2>
          <div className="bg-white/5 rounded-lg p-4 mb-4">
            <p className="text-white">{tweet.content}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-white/60">घटना प्रकार:</span>
              <span className="text-white ml-2">{tweet.event_type}</span>
            </div>
            <div>
              <span className="text-white/60">स्थान:</span>
              <span className="text-white ml-2">{tweet.locations.join(', ') || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-xl">
          <AIReviewAssistant tweet={tweet} onSuggestionAccept={handleSuggestionAccept} />
        </div>
      </div>
    </div>
  );
}

