/**
 * AI Assistant Demo Page
 */

'use client';

import React, { useState, useEffect } from 'react';
import AIReviewAssistant, { AISuggestion } from '@/labs/ai/AIReviewAssistant';

const DEMO_TWEET = {
  id: 'demo',
  content:
    'AI सहायक डेमो में आपका स्वागत है। यह ट्वीट दिखाता है कि सिफारिशें कैसी दिखेंगी जब वास्तविक डेटा उपलब्ध नहीं है।',
  event_type: 'demo',
  locations: ['रायपुर'],
  people_mentioned: ['माननीय नेता'],
  organizations: ['टीम परिवर्तन'],
  schemes_mentioned: ['मुख्यमंत्री जन दर्शन'],
  needs_review: false,
};

export default function AIPage() {
  const [tweet, setTweet] = useState<any>(DEMO_TWEET);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchTweet = async () => {
      try {
        const response = await fetch('/api/parsed-events?limit=1&needs_review=true', {
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (isMounted && data.success && Array.isArray(data.events) && data.events.length > 0) {
          const event = data.events[0];
          setTweet({
            id: event.id || event.tweet_id || DEMO_TWEET.id,
            content: event.text || event.content || DEMO_TWEET.content,
            event_type: event.event_type || DEMO_TWEET.event_type,
            locations: Array.isArray(event.locations)
              ? event.locations.map((l: any) => (typeof l === 'string' ? l : l?.name || '')).filter(Boolean)
              : DEMO_TWEET.locations,
            people_mentioned: event.people_mentioned || DEMO_TWEET.people_mentioned,
            organizations: event.organizations || DEMO_TWEET.organizations,
            schemes_mentioned: event.schemes_mentioned || DEMO_TWEET.schemes_mentioned,
            needs_review: event.needs_review ?? DEMO_TWEET.needs_review,
          });
        } else if (isMounted) {
          setError('कोई ट्वीट नहीं मिला');
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'ट्वीट लोड करने में त्रुटि');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchTweet();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSuggestionAccept = (suggestion: AISuggestion) => {
    console.log('Suggestion accepted:', suggestion);
    // In production, this would update the database
    alert('सुझाव स्वीकार कर लिया गया (डेटाबेस अपडेट किया जाएगा)');
  };

  const resolvedTweet = tweet || DEMO_TWEET;

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="glassmorphic-card mb-6">
          <h1 className="text-3xl font-bold text-primary mb-2 flex items-center gap-3">
            <span role="img" aria-label="AI">🤖</span>
            <span>AI Assistant Demo</span>
          </h1>
          <p className="text-secondary">AI सहायक सुझाव का परीक्षण करें</p>
          {isLoading && <p className="text-xs text-secondary mt-2">लोड हो रहा है...</p>}
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        </div>

        <div className="glassmorphic-card mb-6">
          <h2 className="text-xl font-semibold text-primary mb-4">ट्वीट</h2>
          <div className="glassmorphic rounded-lg p-4 mb-4">
            <p className="text-primary">{resolvedTweet.content}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-secondary">घटना प्रकार:</span>
              <span className="text-primary ml-2">{resolvedTweet.event_type}</span>
            </div>
            <div>
              <span className="text-secondary">स्थान:</span>
              <span className="text-primary ml-2">{resolvedTweet.locations.join(', ') || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div className="glassmorphic-card">
          <AIReviewAssistant tweet={resolvedTweet} onSuggestionAccept={handleSuggestionAccept} />
        </div>
      </div>
    </div>
  );
}
