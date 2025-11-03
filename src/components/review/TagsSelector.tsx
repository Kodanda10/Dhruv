"use client";
import React, { useEffect, useMemo, useState, useRef } from 'react';
import Input from '../ui/Input';
import TagBubble from './TagBubble';
import { api } from '@/lib/api';

export interface TagItem { id?: number; label_hi: string; }

export interface TagsSelectorProps {
  tweetId: string;
  initialSelected?: string[]; // label_hi list
  onChange?: (selected: string[]) => void;
}

export default function TagsSelector({ tweetId, initialSelected = [], onChange }: TagsSelectorProps) {
  const [query, setQuery] = useState('');
  const [all, setAll] = useState<TagItem[]>([]);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const onChangeRef = useRef(onChange);

  // Keep onChange ref up to date
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    setSelected(initialSelected);
  }, [JSON.stringify(initialSelected)]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const q = query.trim();
        const data = await api.get<{ success: boolean; tags: any[] }>(`/api/tags${q ? `?query=${encodeURIComponent(q)}` : ''}`);
        if (mounted && data?.success) setAll(data.tags.map((t: any) => ({ id: t.id, label_hi: t.label_hi })));
      } catch {}
    })();
    return () => { mounted = false; };
  }, [query]);

  // Load suggested topics for this tweet
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await api.get<{ success: boolean; suggested: { label_hi: string }[] }>(`/api/tweets/${encodeURIComponent(tweetId)}/tags`);
        const sug = (data?.suggested || []).map((s: any) => s.label_hi).filter(Boolean);
        if (mounted) setSuggested(sug);
      } catch {}
    })();
    return () => { mounted = false; };
  }, [tweetId]);

  // Only call onChange when selected actually changes, using ref to avoid dependency
  useEffect(() => { 
    onChangeRef.current?.(selected); 
  }, [selected]);

  const shown = useMemo(() => {
    const q = query.trim();
    if (!q) return all;
    return all.filter(t => t.label_hi.includes(q));
  }, [all, query]);

  const toggle = (label: string) => {
    setSelected(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]);
  };

  const create = async () => {
    const val = query.trim();
    if (!val) return;
    try {
      await api.post('/api/tags', { label_hi: val });
      setSelected(prev => prev.includes(val) ? prev : [...prev, val]);
    } catch {}
  };

  const persist = async () => {
    try {
      await api.post(`/api/tweets/${encodeURIComponent(tweetId)}/tags`, { labels: selected, source: 'human' });
      // notify others to refresh
      localStorage.setItem('tweet_review_refresh_ts', String(Date.now()));
    } catch {}
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="टैग खोजें या नया जोड़ें" />
        <button type="button" onClick={create} className="rounded-md bg-green-600 text-white px-3">+ जोड़ें</button>
        <button type="button" onClick={persist} className="rounded-md bg-blue-600 text-white px-3">सहेजें</button>
      </div>
      {suggested.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-gray-600">सुझाव:</div>
          <div className="flex flex-wrap gap-8">
            {suggested.map((label, i) => (
              <TagBubble key={`sug-${label}-${i}`} label={label} selected={selected.includes(label)} onToggle={() => toggle(label)} />
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-8">
        {shown.map((t, i) => (
          <TagBubble key={`${t.label_hi}-${i}`} label={t.label_hi} selected={selected.includes(t.label_hi)} onToggle={() => toggle(t.label_hi)} />
        ))}
      </div>
    </div>
  );
}


