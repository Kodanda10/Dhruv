"use client";
import React, { useEffect, useMemo, useState } from 'react';
import Input from '../ui/Input';
import TagBubble from './TagBubble';

export interface TagItem { id?: number; label_hi: string; }

export interface TagsSelectorProps {
  tweetId: string;
  initialSelected?: string[]; // label_hi list
  onChange?: (selected: string[]) => void;
}

export default function TagsSelector({ tweetId, initialSelected = [], onChange }: TagsSelectorProps) {
  const [query, setQuery] = useState('');
  const [all, setAll] = useState<TagItem[]>([]);
  const [selected, setSelected] = useState<string[]>(initialSelected);

  useEffect(() => {
    setSelected(initialSelected);
  }, [initialSelected]);

  useEffect(() => {
    const controller = new AbortController();
    const q = query.trim();
    fetch(`/api/tags${q ? `?query=${encodeURIComponent(q)}` : ''}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (data && data.tags) setAll(data.tags.map((t: any) => ({ id: t.id, label_hi: t.label_hi })));
      })
      .catch(() => {});
    return () => controller.abort();
  }, [query]);

  useEffect(() => { onChange?.(selected); }, [selected, onChange]);

  const shown = useMemo(() => {
    const q = query.trim();
    if (!q) return all;
    return all.filter(t => t.label_hi.includes(q));
  }, [all, query]);

  const toggle = (label: string) => {
    setSelected(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]);
  };

  const create = () => {
    const val = query.trim();
    if (!val) return;
    fetch('/api/tags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label_hi: val }) })
      .then(() => setSelected(prev => prev.includes(val) ? prev : [...prev, val]));
  };

  const persist = () => {
    fetch(`/api/tweets/${encodeURIComponent(tweetId)}/tags`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labels: selected, source: 'human' })
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="टैग खोजें या नया जोड़ें" />
        <button type="button" onClick={create} className="rounded-md bg-green-600 text-white px-3">+ जोड़ें</button>
        <button type="button" onClick={persist} className="rounded-md bg-blue-600 text-white px-3">सहेजें</button>
      </div>
      <div className="flex flex-wrap gap-8">
        {shown.map((t, i) => (
          <TagBubble key={`${t.label_hi}-${i}`} label={t.label_hi} selected={selected.includes(t.label_hi)} onToggle={() => toggle(t.label_hi)} />
        ))}
      </div>
    </div>
  );
}


