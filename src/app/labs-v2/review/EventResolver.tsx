'use client';

import { useState, useEffect } from 'react';

interface EventSuggestion {
  id: string;
  name: string;
  score: number;
}

interface EventResolverProps {
  parsedEventType: string;
  tweetText: string;
  onResolve: (resolvedEvent: string | null) => void;
}

export default function EventResolver({ parsedEventType, tweetText, onResolve }: EventResolverProps) {
  const [suggestions, setSuggestions] = useState<EventSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<EventSuggestion | null>(null);

  useEffect(() => {
    async function fetchSuggestions() {
      if (!tweetText) return;

      setLoading(true);
      setError(null);
      try {
        // The plan mentions a /suggest endpoint. We'll mock this for now.
        // In a real scenario, this would be a POST request with the tweet text.
        const response = await fetch(`/api/labs/event-types/suggest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: tweetText }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch event suggestions.');
        }
        const data: EventSuggestion[] = await response.json();
        setSuggestions(data);
        if (data.length > 0) {
          // Auto-select the suggestion that matches the parsed event type, if any
          const matchingSuggestion = data.find(s => s.name === parsedEventType) || data[0];
          setSelectedSuggestion(matchingSuggestion);
        }
      } catch (err: any) {
        setError(err.message || 'An unknown error occurred.');
      } finally {
        setLoading(false);
      }
    }
    fetchSuggestions();
  }, [parsedEventType, tweetText]);

  return (
    <div className="p-4 bg-gray-100 rounded-md text-sm">
      <h4 className="font-semibold mb-2">Parsed Event Type: <span className="text-blue-700">{parsedEventType || 'N/A'}</span></h4>

      {loading && <p className="text-blue-600">Loading suggestions...</p>}
      {error && <p className="text-red-600">Error: {error}</p>}

      {!loading && !error && (
        <>
          {suggestions.length === 0 ? (
            <p className="text-gray-500">No suggestions found.</p>
          ) : (
            <ul className="space-y-1 mb-3">
              {suggestions.map((s) => (
                <li key={s.id} className={`flex items-center ${selectedSuggestion?.id === s.id ? 'font-medium text-blue-700' : ''}`}>
                  <input
                    type="radio"
                    id={`evt-${s.id}`}
                    name="event-suggestion"
                    value={s.id}
                    checked={selectedSuggestion?.id === s.id}
                    onChange={() => setSelectedSuggestion(s)}
                    className="mr-2"
                  />
                  <label htmlFor={`evt-${s.id}`}>{s.name} (Score: {s.score.toFixed(2)})</label>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 text-right">
            <button
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              onClick={() => onResolve(selectedSuggestion?.name || null)}
            >
              Confirm Event
            </button>
          </div>
        </>
      )}
    </div>
  );
}
