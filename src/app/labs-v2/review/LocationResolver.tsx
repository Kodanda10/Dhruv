'use client';

import { useState, useEffect } from 'react';

interface LocationSuggestion {
  id: string;
  name: string;
  score: number;
  type?: string;
}

interface LocationResolverProps {
  parsedLocation: string;
  onResolve: (resolvedLocation: string | null) => void;
}

export default function LocationResolver({ parsedLocation, onResolve }: LocationResolverProps) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<LocationSuggestion | null>(null);
  const [manualLocation, setManualLocation] = useState('');
  const [mode, setMode] = useState<'suggestions' | 'manual'>('suggestions'); // 'suggestions' or 'manual'

  useEffect(() => {
    async function fetchSuggestions() {
      if (!parsedLocation) {
        setSuggestions([]);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/labs/locations/resolve?q=${encodeURIComponent(parsedLocation)}&limit=5`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch location suggestions.');
        }
        const data: LocationSuggestion[] = await response.json();
        setSuggestions(data);
        if (data.length > 0) {
          setSelectedSuggestion(data[0]); // Auto-select the first suggestion
        }
      } catch (err: any) {
        setError(err.message || 'An unknown error occurred while fetching suggestions.');
      } finally {
        setLoading(false);
      }
    }
    fetchSuggestions();
  }, [parsedLocation]);

  const handleResolve = () => {
    if (mode === 'suggestions' && selectedSuggestion) {
      onResolve(selectedSuggestion.name);
    } else if (mode === 'manual' && manualLocation.trim()) {
      onResolve(manualLocation.trim());
    } else {
      onResolve(null); // "None of these" or empty manual input
    }
  };

  return (
    <div className="p-4 bg-gray-100 rounded-md text-sm">
      <h4 className="font-semibold mb-2">Parsed Location: <span className="text-blue-700">{parsedLocation || 'N/A'}</span></h4>

      {loading && <p className="text-blue-600">Loading suggestions...</p>}
      {error && <p className="text-red-600">Error: {error}</p>}

      {!loading && !error && (
        <>
          <div className="flex space-x-2 mb-3">
            <button
              className={`px-3 py-1 rounded-md ${mode === 'suggestions' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              onClick={() => setMode('suggestions')}
            >
              Suggestions
            </button>
            <button
              className={`px-3 py-1 rounded-md ${mode === 'manual' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              onClick={() => setMode('manual')}
            >
              Manual
            </button>
          </div>

          {mode === 'suggestions' && (
            <div>
              {suggestions.length === 0 ? (
                <p className="text-gray-500">No suggestions found.</p>
              ) : (
                <ul className="space-y-1 mb-3">
                  {suggestions.map((s) => (
                    <li key={s.id} className={`flex items-center ${selectedSuggestion?.id === s.id ? 'font-medium text-blue-700' : ''}`}>
                      <input
                        type="radio"
                        id={`loc-${s.id}`}
                        name="location-suggestion"
                        value={s.id}
                        checked={selectedSuggestion?.id === s.id}
                        onChange={() => setSelectedSuggestion(s)}
                        className="mr-2"
                      />
                      <label htmlFor={`loc-${s.id}`}>{s.name} (Score: {s.score.toFixed(2)})</label>
                    </li>
                  ))}
                </ul>
              )}
              <button
                className="px-3 py-1 bg-gray-300 rounded-md hover:bg-gray-400"
                onClick={() => { setSelectedSuggestion(null); onResolve(null); }}
              >
                None of these
              </button>
            </div>
          )}

          {mode === 'manual' && (
            <div className="mb-3">
              <input
                type="text"
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter location manually"
                value={manualLocation}
                onChange={(e) => setManualLocation(e.target.value)}
              />
            </div>
          )}

          <div className="mt-4 text-right">
            <button
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              onClick={handleResolve}
            >
              Confirm Location
            </button>
          </div>
        </>
      )}
    </div>
  );
}
