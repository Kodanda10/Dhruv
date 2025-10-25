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

type Post = { id: string | number; timestamp: string; content: string; parsed?: any; confidence?: number; needs_review?: boolean; review_status?: string };

export default function DashboardDark() {
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
  }, [searchParams]);

  // Fetch server-side parsed events (if API available)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get<{ success: boolean; data: any[] }>(`/api/parsed-events?limit=200`);
        if (mounted && res.success) setServerRows(res.data);
      } catch {
        // ignore; fallback to local file
      }
    })();
    return () => { mounted = false; };
  }, []);

  const parsed = useMemo(() => {
    const source = serverRows || parsedTweets;
    return source.map((p: Post) => {
      if (p.parsed && p.parsed.event_type) {
        const locations = (p.parsed.locations || []).map((l: any) => l.name || l);
        const people = p.parsed.people || [];
        const orgs = p.parsed.organizations || [];
        const schemes = p.parsed.schemes || [];
        
        return {
          id: p.id,
          ts: p.timestamp,
          when: formatHindiDate(p.timestamp),
          where: locations,
          what: [p.parsed.event_type],
          which: {
            mentions: people,
            hashtags: [...orgs, ...schemes],
          },
          schemes: schemes,
          how: p.content,
          confidence: p.confidence,
          needs_review: p.needs_review,
          review_status: p.review_status,
        };
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
    });
  }, [serverRows]);

  const filtered = useMemo(() => {
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

  const totalCount = parsed.length;
  const shownCount = filtered.length;

  return (
    <section>
      <div className="mb-4 flex items-end gap-4 flex-wrap bg-[#192734] border border-gray-800 rounded-xl p-4 shadow-sm">
        <label className="text-sm font-medium text-gray-300">
          स्थान फ़िल्टर
          <input
            aria-label="स्थान फ़िल्टर"
            className="ml-2 border border-gray-700 bg-[#0d1117] text-gray-100 placeholder:text-gray-500 px-2 py-1 rounded-md w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="जैसे: रायगढ़"
            value={locFilter}
            onChange={(e) => setLocFilter(e.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-gray-300">
          टैग/मेंशन फ़िल्टर
          <input
            aria-label="टैग/मेंशन फ़िल्टर"
            className="ml-2 border border-gray-700 bg-[#0d1117] text-gray-100 placeholder:text-gray-500 px-2 py-1 rounded-md w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="#समारोह, @PMOIndia"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-gray-300">
          तिथि से
          <input
            aria-label="तिथि से"
            type="date"
            className="ml-2 border border-gray-700 bg-[#0d1117] text-gray-100 placeholder:text-gray-500 px-2 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-gray-300">
          तिथि तक
          <input
            aria-label="तिथि तक"
            type="date"
            className="ml-2 border border-gray-700 bg-[#0d1117] text-gray-100 placeholder:text-gray-500 px-2 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </label>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-gray-400 text-sm" aria-live="polite">
            {`दिखा रहे हैं: ${shownCount} / ${totalCount}`}
          </div>
          <button
            aria-label="फ़िल्टर साफ़ करें"
            onClick={() => {
              setLocFilter('');
              setTagFilter('');
              setFromDate('');
              setToDate('');
              setActionFilter('');
              router.push('/');
            }}
            className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
          >
            फ़िल्टर साफ़ करें
          </button>
        </div>
      </div>
      <div className="overflow-x-auto bg-[#192734] border border-gray-800 rounded-xl p-2 shadow-sm">
        <table aria-label="गतिविधि सारणी" className="min-w-full text-sm border-collapse table-fixed text-gray-100">
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[14%]" />
            <col className="w-[18%]" />
            <col className="w-[14%]" />
            <col className="w-[38%]" />
          </colgroup>
          <thead className="bg-[#0d1117] text-gray-300">
            <tr>
              <th className="text-left font-semibold p-2 border-b border-gray-700">दिन / दिनांक</th>
              <th className="text-left font-semibold p-2 border-b border-l border-gray-700">स्थान</th>
              <th className="text-left font-semibold p-2 border-b border-l border-gray-700">दौरा / कार्यक्रम</th>
              <th className="text-left font-semibold p-2 border-b border-l border-gray-700 w-[14%]">कौन/टैग</th>
              <th className="text-left font-semibold p-2 border-b border-l border-gray-700 w-[38%]">विवरण</th>
            </tr>
          </thead>
          <tbody className="bg-[#192734]" data-testid="tbody">
            {filtered.map((row, index) => (
              <tr key={row.id} className={`align-top hover:bg-gray-800`}>
                <td className="p-2 border-b border-gray-700 whitespace-nowrap">{row.when}</td>
                <td className="p-2 border-b border-l border-gray-700">{row.where.join(', ') || '—'}</td>
                <td className="p-2 border-b border-l border-gray-700">{row.what.length ? row.what.map((w:any) => getEventTypeHindi(w)).join(', ') : '—'}</td>
                <td className="p-2 border-b border-l border-gray-700 align-top w-[14%]" aria-label="कौन/टैग">
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
                            <button
                              key={`${t}-${i}`}
                              onClick={() => {
                                const current = tagFilter.trim();
                                const norm = t.replace(/^[@#]/, '');
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
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                                isSelected 
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                                  : 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600'
                              }`}
                            >
                              {t}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </td>
                <td
                  className="p-2 border-b border-l border-gray-700 align-top whitespace-pre-wrap break-words w-[38%]"
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
                          className="text-blue-400 underline break-all"
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
