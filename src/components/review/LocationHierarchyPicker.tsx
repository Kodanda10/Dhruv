'use client';

import { useEffect, useMemo, useState } from 'react';

export interface GeoNode {
  type: string;
  name: string;
  code?: string;
}

interface GeoSuggestion {
  label: string;
  path: GeoNode[];
}

interface LocationHierarchyPickerProps {
  value: GeoNode[][];
  onChange?: (paths: GeoNode[][]) => void;
}

export default function LocationHierarchyPicker({
  value = [],
  onChange,
}: LocationHierarchyPickerProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/geo/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) {
          setSuggestions([]);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setSuggestions((data.results || []).slice(0, 10));
        }
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [query]);

  const formatNode = (node: GeoNode) => {
    const raw = node?.name ?? '';
    if (!raw) return '';
    if (node.type?.toLowerCase() === 'ward' && !/^ward/i.test(raw)) {
      return `Ward ${raw}`;
    }
    return raw;
  };

  const formattedValue = useMemo(
    () =>
      (value || [])
        .map((path) => {
          if (!Array.isArray(path)) {
            // Handle case where path is not an array, possibly log an error
            return 'Invalid location data';
          }
          return path.map((node) => formatNode(node)).join(' › ');
        }),
    [value],
  );

  const addPath = (suggestion: GeoSuggestion) => {
    if (!onChange) return;
    const exists = value.some(
      (path) => JSON.stringify(path) === JSON.stringify(suggestion.path),
    );
    if (exists) return;
    onChange([...value, suggestion.path]);
    setQuery('');
    setSuggestions([]);
  };

  const removePath = (index: number) => {
    if (!onChange) return;
    const next = value.filter((_, idx) => idx !== index);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Search location…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {loading && <div className="text-xs text-gray-500">Loading...</div>}
      {suggestions.length > 0 && (
        <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
          {suggestions.map((suggestion, idx) => (
            <button
              type="button"
              key={`${suggestion.label}-${idx}`}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
              onClick={() => addPath(suggestion)}
            >
              {suggestion.label || suggestion.path.map((node) => formatNode(node)).join(' › ')}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {formattedValue.map((label, idx) => (
          <span
            key={`${label}-${idx}`}
            className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-medium flex items-center gap-2"
          >
            <span data-testid={`loc-chip-${idx}`}>{label}</span>
            <button
              type="button"
              aria-label="Remove location"
              className="text-indigo-500 hover:text-indigo-700"
              onClick={() => removePath(idx)}
            >
              <svg
                viewBox="0 0 12 12"
                className="w-3 h-3"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M3 3l6 6m0-6l-6 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
