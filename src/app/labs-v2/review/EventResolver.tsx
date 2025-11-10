'use client';

import { useState, useEffect } from 'react';

interface EventTypeSuggestion {
  id: string;
  name_hindi: string;
  name_english: string;
  description_hindi?: string;
  description_english?: string;
  category?: string;
  score: number;
}

interface EventResolverProps {
  parsedEventType: string;
  tweetText: string;
  tweetId: string; // Add tweetId prop
  onResolve: (resolvedEvent: string | null) => void;
}

export default function EventResolver({ parsedEventType, tweetText, tweetId, onResolve }: EventResolverProps) {
  const [suggestions, setSuggestions] = useState<EventTypeSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [manualEntry, setManualEntry] = useState<string>('');
  const [isManualMode, setIsManualMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSuggestions() {
      if (!parsedEventType) { // Only fetch if parsedEventType is available
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/labs/event-types/suggest?parsedEventType=${encodeURIComponent(parsedEventType)}&tweetText=${encodeURIComponent(tweetText)}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch event type suggestions.');
        }
        const data: EventTypeSuggestion[] = await response.json();
        setSuggestions(data);
        if (data.length > 0) {
          setSelectedSuggestion(data[0].name_english); // Auto-select the first suggestion
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchSuggestions();
  }, [parsedEventType, tweetText]);

  const handleConfirm = async () => {
    let resolvedValue: string | null = null;
    let resolvedId: string | null = null;
    let reviewStatus: string = 'confirmed';

    if (isManualMode) {
      resolvedValue = manualEntry.trim();
      reviewStatus = 'manual_entry';
    } else {
      resolvedValue = selectedSuggestion;
      const selected = suggestions.find(s => s.name_english === selectedSuggestion);
      resolvedId = selected ? selected.id : null;
    }

    if (resolvedValue === '') {
      resolvedValue = null;
    }

    // Call the confirm API
    try {
      const response = await fetch('/api/labs/event-types/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parsedEventType,
          resolvedEventTypeId: resolvedId,
          reviewStatus,
          manualEntryName: isManualMode ? resolvedValue : null,
          reviewerId: 'human_reviewer_1', // Placeholder for actual reviewer ID
          tweetId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to confirm event type.');
      }
      console.log('Event type confirmed:', resolvedValue);
      onResolve(resolvedValue);
    } catch (err: any) {
      console.error('Error confirming event type:', err);
      setError(err.message);
    }
  };

  const handleToggleMode = () => {
    setIsManualMode(!isManualMode);
    if (!isManualMode) { // Switching to manual mode
      setSelectedSuggestion(null);
    } else { // Switching back to suggestions
      setManualEntry('');
      if (suggestions.length > 0) {
        setSelectedSuggestion(suggestions[0].name_english);
      }
    }
  };

  if (loading) {
    return <div className="text-gray-500">Loading suggestions...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  return (
    <div className="space-y-4">
      <h4 className="font-semibold mb-2">Parsed Event Type: <span className="text-blue-700">{parsedEventType}</span></h4>
      
      <div className="flex space-x-2 mb-4">
        <button
          onClick={handleToggleMode}
          className={`px-4 py-2 rounded-md ${!isManualMode ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}
        >
          Suggestions
        </button>
        <button
          onClick={handleToggleMode}
          className={`px-4 py-2 rounded-md ${isManualMode ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}
        >
          Manual Entry
        </button>
      </div>

      {isManualMode ? (
        <div>
          <input
            type="text"
            value={manualEntry}
            onChange={(e) => setManualEntry(e.target.value)}
            placeholder="Enter event type manually"
            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      ) : (
        suggestions.length > 0 ? (
          <div className="space-y-2">
            {suggestions.map((suggestion) => (
              <label key={suggestion.id} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="eventTypeSuggestion"
                  value={suggestion.name_english}
                  checked={selectedSuggestion === suggestion.name_english}
                  onChange={(e) => setSelectedSuggestion(e.target.value)}
                  className="form-radio text-blue-600"
                />
                <span>{suggestion.name_english} (Score: {suggestion.score.toFixed(2)})</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">No suggestions found for "{parsedEventType}".</p>
        )
      )}

      <div className="flex space-x-2">
        <button
          onClick={handleConfirm}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-blue-300"
          disabled={isManualMode ? manualEntry.trim() === '' : !selectedSuggestion}
        >
          Confirm Event
        </button>
        <button
          onClick={() => onResolve(null)}
          className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400"
        >
          Clear Selection
        </button>
      </div>
    </div>
  );
}
