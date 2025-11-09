'use client';

import { useEffect, useMemo, useState } from 'react';
import TagBubble from './TagBubble';

interface TagsSelectorProps {
  tweetId: string;
  initialSelected?: string[];
  onChange?: (values: string[]) => void;
}

interface TagOption {
  id?: number;
  label_hi?: string;
  label?: string;
}

export default function TagsSelector({
  tweetId,
  initialSelected = [],
  onChange,
}: TagsSelectorProps) {
  const [availableTags, setAvailableTags] = useState<TagOption[]>([]);
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelected(initialSelected);
  }, [initialSelected]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/tags');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setAvailableTags(data.tags || []);
        }
      } catch {
        // Ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayedTags = useMemo(() => {
    return availableTags.map((tag) => tag.label_hi || tag.label).filter(Boolean) as string[];
  }, [availableTags]);

  const toggleTag = (label: string) => {
    setSelected((prev) => {
      const exists = prev.includes(label);
      const next = exists ? prev.filter((t) => t !== label) : [...prev, label];
      onChange?.(next);
      return next;
    });
  };

  const addCustomTag = async () => {
    const value = query.trim();
    if (!value) return;

    try {
      await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: value }),
      });
      setAvailableTags((prev) => [...prev, { label_hi: value }]);
      setQuery('');
      toggleTag(value);
    } catch {
      // ignore
    }
  };

  const persistSelection = async () => {
    setSaving(true);
    try {
      await fetch(`/api/tweets/${tweetId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: selected }),
      });
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="टैग खोजें या नया जोड़ें"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="px-3 py-1 text-xs rounded-md bg-green-600 text-white hover:bg-green-700"
          onClick={addCustomTag}
        >
          + जोड़ें
        </button>
        <button
          type="button"
          className="px-3 py-1 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          onClick={persistSelection}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'सहेजें'}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {displayedTags.map((label) => (
          <TagBubble
            key={label}
            label={label}
            selected={selected.includes(label)}
            onClick={() => toggleTag(label)}
          />
        ))}
      </div>
    </div>
  );
}
