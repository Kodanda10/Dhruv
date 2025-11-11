'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';

interface AISuggestion {
  field: string;
  current_value: any;
  suggested_value: any;
  confidence: number;
  rationale: string;
}

export default function AIAssistantCard() {
  const [tweetText, setTweetText] = useState('');
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = useCallback(async () => {
    if (!tweetText.trim()) {
      setError('Please enter tweet text to analyze.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuggestions([]);

    try {
      const response = await fetch('/api/labs/ai/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: tweetText,
          entities: {}, // Passing empty entities for a general analysis
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get AI suggestions.');
      }

      const data = await response.json();
      // The API returns suggestions inside a `suggestions` object with various keys
      const extractedSuggestions: AISuggestion[] = [];
      if (data.success && data.suggestions) {
        const { event_type, locations, people_mentioned, organizations, schemes_mentioned, reasoning, event_type_confidence } = data.suggestions;
        if (event_type) {
          extractedSuggestions.push({ field: 'event_type', current_value: '', suggested_value: event_type, confidence: event_type_confidence || 0, rationale: reasoning || '' });
        }
        if (locations && locations.length > 0) {
          extractedSuggestions.push({ field: 'locations', current_value: [], suggested_value: locations, confidence: 0.9, rationale: reasoning || '' });
        }
        if (people_mentioned && people_mentioned.length > 0) {
          extractedSuggestions.push({ field: 'people_mentioned', current_value: [], suggested_value: people_mentioned, confidence: 0.9, rationale: reasoning || '' });
        }
        if (organizations && organizations.length > 0) {
          extractedSuggestions.push({ field: 'organizations', current_value: [], suggested_value: organizations, confidence: 0.9, rationale: reasoning || '' });
        }
        if (schemes_mentioned && schemes_mentioned.length > 0) {
          extractedSuggestions.push({ field: 'schemes_mentioned', current_value: [], suggested_value: schemes_mentioned, confidence: 0.9, rationale: reasoning || '' });
        }
      }
      setSuggestions(extractedSuggestions);
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  }, [tweetText]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="glassmorphic-card rounded-lg p-6"
    >
      <h3 className="text-xl font-bold mb-4 text-white">AI Review Assistant</h3>
      <div className="flex flex-col gap-4">
        <textarea
          placeholder="Enter tweet text for analysis..."
          value={tweetText}
          onChange={(e) => setTweetText(e.target.value)}
          className="w-full h-24 px-3 py-2 text-sm border border-white/20 rounded-lg focus:outline-none focus:border-[#8BF5E6] focus:ring-2 focus:ring-[#8BF5E6]/20 bg-white/5 backdrop-blur-sm text-white"
          aria-label="Tweet text input"
        />
        <button
          onClick={handleAnalyze}
          className="neon-button px-4 py-2 text-sm font-semibold rounded-lg self-end"
          disabled={loading}
        >
          {loading ? 'Analyzing...' : 'Analyze Tweet'}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-300 px-3 py-2 rounded-md text-sm mt-4" role="alert">
          {error}
        </div>
      )}

      <div className="mt-4 space-y-2 h-48 overflow-y-auto">
        {loading && <p className="text-center text-white/70">Loading suggestions...</p>}
        {!loading && suggestions.length === 0 && !error && (
          <p className="text-center text-white/50">No suggestions to display.</p>
        )}
        {suggestions.map((suggestion, index) => (
          <div key={index} className="p-2 border-b border-white/10">
            <p className="font-medium text-white">
              Suggest to change <span className="text-yellow-400">{suggestion.field}</span> to "{Array.isArray(suggestion.suggested_value) ? suggestion.suggested_value.join(', ') : String(suggestion.suggested_value)}"
            </p>
            <p className="text-xs text-mint-green">Confidence: {(suggestion.confidence * 100).toFixed(0)}%</p>
            {suggestion.rationale && <p className="text-xs text-white/70">Rationale: {suggestion.rationale}</p>}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
