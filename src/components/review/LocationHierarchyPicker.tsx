import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import Input from '../ui/Input';
import Badge from '../ui/Badge';

export interface GeoNode { type?: string; name: string; code?: string }
export type GeoPath = { path?: GeoNode[] } | GeoNode[];

export interface LocationHierarchyPickerProps {
  value: GeoPath[];
  onChange: (paths: GeoPath[]) => void;
}

export default function LocationHierarchyPicker({ value, onChange }: LocationHierarchyPickerProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<{ label: string; path: any }[]>([]);
  const [show, setShow] = useState(false);
  const debounceRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setSuggestions([]); return; }
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const res = await api.get<{ success: boolean; results: { label: string; path: any }[] }>(`/api/geo/search?query=${encodeURIComponent(q)}`);
        if (res?.success) setSuggestions(res.results || []);
      } catch { setSuggestions([]); }
    }, 200) as unknown as number;
  }, [query]);

  const addPath = (item: { label: string; path: any }) => {
    const next = [...(value || []), item.path];
    onChange(next);
    setQuery('');
    setSuggestions([]);
    setShow(false);
  };

  const removeIndex = (idx: number) => {
    const next = (value || []).filter((_, i) => i !== idx);
    onChange(next);
  };

  const addCustom = () => {
    const q = query.trim();
    if (!q) return;
    // minimal node fallback
    onChange([...(value || []), { name: q } as any]);
    setQuery('');
    setSuggestions([]);
    setShow(false);
  };

  const labelFor = (p: any, idx: number) => {
    const arr = Array.isArray(p) ? p : (p?.path || []);
    const parts = Array.isArray(arr)
      ? arr.map((n: any) => {
          if (!n?.name) return null;
          if ((n.type || '').toLowerCase() === 'ward') return `Ward ${n.name}`;
          return n.name;
        }).filter(Boolean)
      : [];
    const label = parts.length ? parts.join(' › ') : (p?.name || '');
    return label;
  };

  return (
    <div className="space-y-2 relative">
      <div className="flex gap-2">
        <Input
          placeholder="Search location…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShow(true); }}
          onFocus={() => setShow(true)}
        />
        <button type="button" className="rounded-md bg-green-600 text-white px-3" onClick={addCustom}>Add custom</button>
      </div>
      {show && suggestions.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-sm max-h-60 overflow-auto">
          {suggestions.map((s, i) => (
            <div key={i} className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer" onClick={() => addPath(s)}>
              {s.label}
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        {(value || []).map((p, i) => (
          <span key={i} className="inline-flex items-center gap-2 bg-blue-50 text-blue-800 px-2 py-1 rounded-full text-xs">
            <span data-testid={`loc-chip-${i}`}>{labelFor(p, i)}</span>
            <button type="button" className="text-blue-700 hover:text-blue-900" onClick={() => removeIndex(i)} aria-label="Remove">×</button>
          </span>
        ))}
      </div>
    </div>
  );
}
