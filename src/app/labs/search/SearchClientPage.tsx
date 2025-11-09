'use client';

import { useState, ChangeEvent, FormEvent } from 'react';
import { FaissSearchResult } from '@/labs/faiss/search';

type SearchState = {
  query: string;
  results: FaissSearchResult[];
  loading: boolean;
  error: string | null;
};

export default function SearchClientPage() {
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
      const response = await fetch(`/api/labs/faiss/search?q=${encodeURIComponent(state.query)}&limit=10`);
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
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">FAISS Search</h1>

      <form onSubmit={handleSearch} className="flex gap-2 mb-8">
        <input
          type="text"
          placeholder="Enter search query"
          value={state.query}
          onChange={handleQueryChange}
          className="flex-grow p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Search query input"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          disabled={state.loading}
        >
          {state.loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {state.error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline"> {state.error}</span>
        </div>
      )}

      <h2 className="text-2xl font-semibold mb-4">Search Results</h2>
      {state.loading && <p className="text-blue-600">Loading...</p>}

      {!state.loading && state.results.length === 0 && !state.error && (
        <p className="text-gray-500">No results to display. Try a search!</p>
      )}

      {!state.loading && state.results.length > 0 && (
        <ul className="space-y-2">
          {state.results.map((result) => (
            <li key={result.id} className="p-3 border border-gray-200 rounded-md shadow-sm">
              <p className="font-medium text-lg">{result.name}</p>
              <p className="text-sm text-gray-600">Score: {result.score?.toFixed(4)}</p>
              {result.match_type && <p className="text-xs text-gray-500">Type: {result.match_type}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
