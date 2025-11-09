/**
 * FAISS Search Tester Page
 */

'use client';

import React, { useState } from 'react';

interface SearchResult {
  id: string;
  name: string;
  score: number;
  similarity_score: number;
  source: string;
  match_type: string;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ locationCount: number; dimension: number; indexPath: string } | null>(null);

  React.useEffect(() => {
    // Load index stats on mount
    fetch('/api/labs/faiss/search?q=&limit=0')
      .then((res) => res.json())
      .then((data) => {
        if (data.stats) {
          setStats(data.stats);
        }
      })
      .catch((err) => console.error('Failed to load stats:', err));
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) {
      setError('कृपया खोज क्वेरी दर्ज करें');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);
    setLatency(null);

    const startTime = Date.now();

    try {
      const response = await fetch(`/api/labs/faiss/search?q=${encodeURIComponent(query)}&limit=5`);
      const data = await response.json();

      if (data.success) {
        setResults(data.results || []);
        setLatency(data.latency_ms || Date.now() - startTime);
        if (data.stats && !stats) {
          setStats(data.stats);
        }
      } else {
        setError(data.error || 'खोज विफल');
      }
    } catch (err: any) {
      setError(err.message || 'खोज विफल');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 shadow-xl border border-white/20">
          <h1 className="text-3xl font-bold text-white mb-2">🔍 FAISS Vector Search</h1>
          <p className="text-white/80 mb-6">स्थान खोज के लिए FAISS वेक्टर खोज का परीक्षण करें</p>

          {stats && (
            <div className="bg-white/5 rounded-lg p-4 mb-6">
              <h2 className="text-lg font-semibold text-white mb-2">Index Statistics</h2>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-white/60">Locations:</span>
                  <span className="text-white ml-2 font-semibold">{stats.locationCount.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-white/60">Dimension:</span>
                  <span className="text-white ml-2 font-semibold">{stats.dimension}</span>
                </div>
                <div>
                  <span className="text-white/60">Backend:</span>
                  <span className="text-white ml-2 font-semibold">FAISS</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-4 mb-6">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="स्थान नाम दर्ज करें (उदा: खरसिया)"
              className="flex-1 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSearch}
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-semibold transition-colors disabled:cursor-not-allowed"
            >
              {isLoading ? 'खोज रहे हैं...' : 'खोजें'}
            </button>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
              <p className="text-red-200">{error}</p>
            </div>
          )}

          {latency !== null && (
            <div className="text-white/80 text-sm mb-4">
              लेटेंसी: {latency}ms
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-white mb-4">परिणाम (Top {results.length})</h2>
              {results.map((result, index) => (
                <div
                  key={result.id || index}
                  className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-semibold text-lg">{result.name}</h3>
                      <p className="text-white/60 text-sm mt-1">
                        Score: {(result.score || result.similarity_score || 0).toFixed(4)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs bg-blue-500/20 text-blue-200 px-2 py-1 rounded">
                        {result.match_type || 'semantic'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && results.length === 0 && !error && query && (
            <div className="text-center py-8 text-white/60">
              कोई परिणाम नहीं मिला
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

