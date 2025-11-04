"use client";
import parsedTweets from '../../data/parsed_tweets.json';
import { api } from '@/lib/api';
import { parsePost, formatHindiDate } from '@/utils/parse';
import { isParseEnabled } from '../../config/flags';
import { matchTagFlexible, matchTextFlexible } from '@/utils/tag-search';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getEventTypeHindi } from '@/lib/eventTypes';
import type { Route } from 'next';
import Card from './Card';
import SoftButton from './SoftButton';
import Chip from './Chip';

type Post = { id: string | number; timestamp: string; content: string; parsed?: any; confidence?: number; needs_review?: boolean; review_status?: string };

export default function Dashboard() {
  const [locFilter, setLocFilter] = useState('');
  const [serverRows, setServerRows] = useState<any[] | null>(null);
  const [tagFilter, setTagFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const searchParams = useSearchParams();
  const router = useRouter();

  // Sync from URL params
  useEffect(() => {
    const loc = searchParams.get('loc') ?? '';
    const tag = searchParams.get('tag') ?? '';
    const from = searchParams.get('from') ?? '';
    const to = searchParams.get('to') ?? '';
    const action = searchParams.get('action') ?? '';
    setLocFilter(loc);
    setTagFilter(tag);
    setFromDate(from);
    setToDate(to);
    setActionFilter(action);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Fetch server-side parsed events (if API available)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get<{ success: boolean; events: any[] }>(`/api/parsed-events?limit=200`);
        if (mounted && res.success) setServerRows(res.events);
      } catch {
        // ignore; fallback to local file
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Overlay local reviewed edits from localStorage onto data
  const baseRows: any[] = useMemo(() => {
    if (serverRows && Array.isArray(serverRows) && serverRows.length) {
      return serverRows.map((e: any) => ({
        id: e.tweet_id,
        timestamp: e.tweet_created_at,
        content: e.tweet_text,
        parsed: {
          event_type: e.event_type,
          locations: (e.locations || []).map((l: any) => l.name || l),
          people_mentioned: e.people_mentioned || [],
          organizations: e.organizations || [],
          schemes_mentioned: e.schemes_mentioned || [],
        },
        confidence: e.overall_confidence,
        needs_review: e.needs_review,
        review_status: e.review_status,
      }));
    }
    return (parsedTweets as Post[]) as any[];
  }, [serverRows]);

  const parsed = useMemo(() => baseRows.map((p: any) => {
    if (p.parsed && p.parsed.event_type) {
      // Use parsed data from database
      const schemes = p.parsed.schemes_mentioned || p.parsed.schemes || [];
      const organizations = p.parsed.organizations || [];
      
      // Apply local overlay if present
      let overlay: any = null;
      try {
        const raw = localStorage.getItem(`tweet_review:${String(p.id)}`);
        overlay = raw ? JSON.parse(raw) : null;
      } catch {}
      const eventType = overlay?.event_type || p.parsed.event_type;
      const ovLocations = overlay?.locations || [];
      const ovPeople = overlay?.people_mentioned || [];
      const ovOrgs = overlay?.organizations || [];
      const ovSchemes = overlay?.schemes_mentioned || [];
      const locations = (ovLocations.length ? ovLocations : (p.parsed.locations || [])).map((l: any) => l.name || l);
      const people = ovPeople.length ? ovPeople : (p.parsed.people_mentioned || p.parsed.people || []);
      const orgs = ovOrgs.length ? ovOrgs : (p.parsed.organizations || []);
      const schemesEff = ovSchemes.length ? ovSchemes : schemes;
      const reviewStatus = overlay?.review_status || p.review_status;
      return {
        id: p.id,
        ts: p.timestamp,
        when: formatHindiDate(p.timestamp),
        where: locations,
        what: [eventType],
        which: {
          mentions: people,
          hashtags: [...orgs, ...schemesEff],
        },
        schemes: schemesEff,
        how: p.content,
        confidence: p.confidence,
        needs_review: p.needs_review,
        review_status: reviewStatus,
      };
    }
    // Fallback to parsePost if no parsed data
    if (isParseEnabled()) {
      return { id: p.id, ts: p.timestamp, ...parsePost(p) };
    }
    return {
      id: p.id,
      ts: p.timestamp,
      when: formatHindiDate(p.timestamp),
      where: [] as string[],
      what: [] as string[],
      which: { mentions: [] as string[], hashtags: [] as string[] },
      schemes: [],
      how: p.content,
    };
  }), [baseRows]);

  const truncate = (s: string, max: number) => {
    if (s.length <= max) return { display: s, title: s };
    return { display: s.slice(0, Math.max(0, max - 1)) + '…', title: s };
  };

  const filtered = useMemo(() => {
    // Exclude skipped from Home
    let rows = parsed.filter((r: any) => r.review_status !== 'skipped');
    if (locFilter.trim()) {
      const q = locFilter.trim();
      rows = rows.filter((r) => r.where.some((w: string) => matchTextFlexible(w, q)));
    }
    if (tagFilter.trim()) {
      const tokens = tagFilter
        .split(/[#,\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      rows = rows.filter((r) => {
        const tags = [...r.which.hashtags, ...r.which.mentions];
        return tokens.some((q) =>
          tags.some((t) => matchTagFlexible(t, q)) ||
          matchTextFlexible(r.how, q) ||
          r.what.some((w) => matchTextFlexible(w, q)) ||
          r.where.some((w: string) => matchTextFlexible(w, q))
        );
      });
    }
    if (actionFilter.trim()) {
      const q = actionFilter.trim();
      rows = rows.filter((r) => r.what.some((w) => w.includes(q)));
    }
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(toDate) : null;
    if (from || to) {
      rows = rows.filter((r) => {
        const d = new Date(r.ts);
        if (from && d < from) return false;
        if (to) {
          const end = new Date(to);
          end.setHours(23, 59, 59, 999);
          if (d > end) return false;
        }
        return true;
      });
    }
    return rows;
  }, [parsed, locFilter, tagFilter, actionFilter, fromDate, toDate]);

  const [refreshTs, setRefreshTs] = useState(0);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'tweet_review_refresh_ts') {
        setRefreshTs(Date.now());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  // trigger recompute when refreshTs changes
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _bump = refreshTs;

  const totalCount = parsed.length;
  const shownCount = filtered.length;

  return (
    <section>
      <div className="mb-4 flex items-end gap-4 flex-wrap bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <label className="text-sm font-medium text-gray-700">
          स्थान फ़िल्टर
          <input
            aria-label="स्थान फ़िल्टर"
            className="ml-2 border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-2 py-1 rounded-md w-40 focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="जैसे: रायगढ़"
            value={locFilter}
            onChange={(e) => setLocFilter(e.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-gray-700">
          टैग/मेंशन फ़िल्टर
          <input
            aria-label="टैग/मेंशन फ़िल्टर"
            className="ml-2 border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-2 py-1 rounded-md w-48 focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="#समारोह, @PMOIndia"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-gray-700">
          तिथि से
          <input
            aria-label="तिथि से"
            type="date"
            className="ml-2 border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-2 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-gray-700">
          तिथि तक
          <input
            aria-label="तिथि तक"
            type="date"
            className="ml-2 border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-2 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </label>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-gray-600 text-sm" aria-live="polite">
            {`दिखा रहे हैं: ${shownCount} / ${totalCount}`}
          </div>
          <SoftButton
            ariaLabel="फ़िल्टर साफ़ करें"
            onClick={() => {
              setLocFilter('');
              setTagFilter('');
              setFromDate('');
              setToDate('');
              setActionFilter('');
              router.push('/' as Route);
            }}
          >
            फ़िल्टर साफ़ करें
          </SoftButton>
        </div>
      </div>
      <div className="overflow-x-auto bg-white border border-gray-200 rounded-xl p-2 shadow-sm">
        <table aria-label="गतिविधि सारणी" className="min-w-full text-sm border-collapse table-fixed text-gray-900">
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[14%]" />
            <col className="w-[18%]" />
            <col className="w-[14%]" />
            <col className="w-[38%]" />
          </colgroup>
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="text-left font-semibold p-2 border-b border-gray-200">दिन / दिनांक</th>
              <th className="text-left font-semibold p-2 border-b border-l border-gray-200">स्थान</th>
              <th className="text-left font-semibold p-2 border-b border-l border-gray-200">दौरा / कार्यक्रम</th>
              <th className="text-left font-semibold p-2 border-b border-l border-gray-200 w-[14%]">कौन/टैग</th>
              <th className="text-left font-semibold p-2 border-b border-l border-gray-200 w-[38%]">विवरण</th>
            </tr>
          </thead>
          <tbody className="bg-white" data-testid="tbody">
            {filtered.map((row, index) => (
              <tr key={row.id} className={`align-top hover:bg-gray-50`}>
                <td className="p-2 border-b border-gray-200 whitespace-nowrap">{row.when}</td>
                <td className="p-2 border-b border-l border-gray-200">{row.where.join(', ') || '—'}</td>
                <td className="p-2 border-b border-l border-gray-200">{row.what.length ? row.what.map((w:any) => getEventTypeHindi(w)).join(', ') : '—'}</td>
                <td className="p-2 border-b border-l border-gray-200 align-top w-[14%]" aria-label="कौन/टैग">
                  {(() => {
                    const tags = [...row.which.mentions, ...row.which.hashtags];
                    if (!tags.length) return '—';
                    return (
                      <div className="flex gap-2 flex-wrap max-w-[14rem]">
                        {tags.map((t, i) => {
                          const isSelected = tagFilter
                            .split(/[#,\s]+/)
                            .filter(Boolean)
                            .some((q) => matchTagFlexible(t, q));
                          return (
                            <Chip
                              key={`${t}-${i}`}
                              label={t}
                              selected={isSelected}
                              onClick={() => {
                                const current = tagFilter.trim();
                                const norm = t.replace(/^[@#]/, '');
                                // toggle behavior: add if missing, remove if present
                                const tokens = current
                                  ? current.split(/[,\s]+/).filter(Boolean)
                                  : [];
                                const exists = tokens.some((q) => matchTagFlexible(norm, q));
                                let nextTokens: string[];
                                if (exists) {
                                  nextTokens = tokens.filter((q) => !matchTagFlexible(norm, q));
                                } else {
                                  nextTokens = [...tokens, `#${norm}`];
                                }
                                const next = nextTokens.join(', ');
                                setTagFilter(next);
                              }}
                            />
                          );
                        })}
                      </div>
                    );
                  })()}
                </td>
                <td
                  className="p-2 border-b border-l border-gray-200 align-top whitespace-pre-wrap break-words w-[38%]"
                  aria-label="विवरण"
                  title={row.how}
                >
                  {(() => {
                    const urlRegex = /(https?:\/\/[^\s]+)/g;
                    const parts = row.how.split(urlRegex);
                    return parts.map((part: string, i: number) => {
                      const isUrl = part.startsWith('http://') || part.startsWith('https://');
                      return isUrl ? (
                        <a
                          key={i}
                          href={part}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-700 underline break-all"
                        >
                          {part}
                        </a>
                      ) : (
                        <span key={i}>{part}</span>
                      );
                    });
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
