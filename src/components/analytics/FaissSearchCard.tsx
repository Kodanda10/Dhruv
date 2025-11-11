'use client';

import { useState, ChangeEvent, FormEvent } from 'react';
import { motion } from 'framer-motion';

interface FaissSearchResult {
  id: string;
  name: string;
  score?: number;
  match_type?: string;
}

type SearchState = {
  query: string;
  results: FaissSearchResult[];
  loading: boolean;
  error: string | null;
};

export default function FaissSearchCard() {
  const [state, setState] = useState<SearchState>({
    query: '',
    results: [],
    loading: false,
    error: null,
  });

  const handleQueryChange = (e: ChangeEvent<HTMLInputElement>) => {
    setState(prevState => ({ ...prevState, query: e.target.value }));
  };

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!state.query.trim()) {
      setState(prevState => ({ ...prevState, error: 'Please enter a search query.' }));
      return;
    }

    setState(prevState => ({ ...prevState, loading: true, error: null, results: [] }));

    try {
      const response = await fetch(`/api/labs/faiss/search?q=${encodeURIComponent(state.query)}&limit=5`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch search results.');
      }
      const data: FaissSearchResult[] = await response.json();
      setState(prevState => ({ ...prevState, results: data }));
    } catch (err: any) {
      setState(prevState => ({ ...prevState, error: err.message || 'An unknown error occurred.' }));
    } finally {
      setState(prevState => ({ ...prevState, loading: false }));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="glassmorphic-card rounded-lg p-6"
    >
      <h3 className="text-xl font-bold mb-4 text-white">Vector Location Search</h3>
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Search for a location..."
          value={state.query}
          onChange={handleQueryChange}
          className="flex-grow px-3 py-2 text-sm border border-white/20 rounded-lg focus:outline-none focus:border-[#8BF5E6] focus:ring-2 focus:ring-[#8BF5E6]/20 bg-white/5 backdrop-blur-sm text-white"
          aria-label="Location search query"
        />
        <button
          type="submit"
          className="neon-button px-4 py-2 text-sm font-semibold rounded-lg"
          disabled={state.loading}
        >
          {state.loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {state.error && (
        <div className="bg-red-900/50 border border-red-700 text-red-300 px-3 py-2 rounded-md text-sm mb-4" role="alert">
          {state.error}
        </div>
      )}

      <div className="space-y-2 h-48 overflow-y-auto">
        {state.loading && <p className="text-center text-white/70">Loading results...</p>}
        {!state.loading && state.results.length === 0 && !state.error && (
          <p className="text-center text-white/50">No results to display.</p>
        )}
        {state.results.map((result) => (
          <div key={result.id} className="p-2 border-b border-white/10">
            <p className="font-medium text-white">{result.name}</p>
            <p className="text-xs text-mint-green">Score: {result.score?.toFixed(4)}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
