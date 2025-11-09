'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AIReviewAssistant, { AISuggestion } from '@/labs/ai/AIReviewAssistant';

type ParsedEvent = {
  id: string;
  tweet_id: string;
  tweet_text: string;
  event_type: string;
  locations: Array<string | { name?: string; district?: string }>;
  people_mentioned: string[];
  organizations: string[];
  schemes_mentioned: string[];
  needs_review: boolean;
  review_status?: string | null;
};

function normalizeStrings(values: ParsedEvent['locations']): string[] {
  return (values || [])
    .map((item) => {
      if (typeof item === 'string') return item;
      return item?.name || item?.district || '';
    })
    .filter((item): item is string => Boolean(item && item.trim()));
}

export default function LabsReviewPreview() {
  const [tweet, setTweet] = useState<ParsedEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string>('');

  const handleSuggestionAccept = useCallback((suggestion: AISuggestion) => {
    setLastAction(
      `AI सुझाव स्वीकार: घटना "${suggestion.event_type ?? '—'}", स्थान ${
        suggestion.locations?.join(', ') ?? '—'
      }`,
    );
  }, []);

  useEffect(() => {
    let isActive = true;
    (async () => {
      try {
        const response = await fetch('/api/parsed-events?needs_review=true&limit=1');
        if (!response.ok) throw new Error('parsed events fetch failed');
        const payload = await response.json();
        const event = payload?.events?.[0];
        if (isActive) {
          if (!event) {
            setError('समीक्षा के लिए ट्वीट उपलब्ध नहीं है');
          } else {
            setTweet(event);
          }
        }
      } catch (err: any) {
        if (isActive) setError(err.message || 'डेटा लोड करने में त्रुटि');
      } finally {
        if (isActive) setLoading(false);
      }
    })();
    return () => {
      isActive = false;
    };
  }, []);

  const normalizedLocations = useMemo(() => normalizeStrings(tweet?.locations || []), [tweet]);
  const availableTags = useMemo(() => tweet?.schemes_mentioned || [], [tweet]);
  const availablePeople = useMemo(() => tweet?.people_mentioned || [], [tweet]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-white">
        समीक्षा डेटा लोड हो रहा है…
      </div>
    );
  }

  if (error || !tweet) {
    return (
      <div className="rounded-3xl border border-red-400/30 bg-red-500/10 p-6 text-center text-red-100">
        {error || 'कोई डेटा उपलब्ध नहीं'}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/8 to-white/0 p-6 shadow-2xl shadow-black/40 space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-white/60">Labs Preview</p>
        <h2 className="text-2xl font-semibold text-white">AI Review Assistant (Real Data)</h2>
        <p className="text-sm text-white/60">
          यह वही ट्वीट है जो production समीक्षा कतार में है। AI सहायक सीधे `/api/labs/ai/assist` को कॉल करता है।
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <article className="rounded-2xl border border-white/10 bg-black/40 p-5 space-y-4">
          <div>
            <p className="text-xs text-white/50 mb-1">Tweet Preview</p>
            <p className="text-lg text-white">{tweet.tweet_text}</p>
          </div>
          <dl className="text-sm text-white/70 space-y-1">
            <div className="flex justify-between">
              <dt className="text-white/50">घटना प्रकार</dt>
              <dd>{tweet.event_type || 'अनिर्दिष्ट'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-white/50">स्थान</dt>
              <dd>{normalizedLocations.join(', ') || 'अनिर्दिष्ट'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-white/50">योजनाएँ / टैग</dt>
              <dd>{availableTags.join(', ') || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-white/50">उल्लिखित लोग</dt>
              <dd>{availablePeople.join(', ') || '—'}</dd>
            </div>
          </dl>

          <div className="space-y-3 pt-3 border-t border-white/10">
            <SuggestionGroup label="स्थान" items={normalizedLocations} />
            <SuggestionGroup label="टैग / योजनाएँ" items={availableTags} />
            <SuggestionGroup label="लोग / संगठन" items={availablePeople} />
          </div>
        </article>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <AIReviewAssistant
            tweet={{
              id: tweet.tweet_id || tweet.id,
              content: tweet.tweet_text,
              event_type: tweet.event_type,
              locations: normalizedLocations,
              people_mentioned: availablePeople,
              organizations: tweet.organizations || [],
              schemes_mentioned: availableTags,
              needs_review: tweet.needs_review,
            }}
            onSuggestionAccept={handleSuggestionAccept}
          />
        </div>
      </div>

      {lastAction && (
        <div className="rounded-2xl border border-teal-300/40 bg-teal-300/10 px-4 py-3 text-sm text-teal-100">
          {lastAction}
        </div>
      )}
    </div>
  );
}

function SuggestionGroup({ label, items }: { label: string; items: string[] }) {
  if (!items.length) {
    return (
      <div>
        <p className="text-xs text-white/50 mb-1">{label}</p>
        <p className="text-xs text-white/30">डेटा उपलब्ध नहीं</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs text-white/50 mb-1">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={`${label}-${item}`} className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
