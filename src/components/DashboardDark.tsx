"use client";
import parsedTweets from '../../data/parsed_tweets.json';
import { api } from '@/lib/api';
import { parsePost, formatHindiDate } from '@/utils/parse';
import { isParseEnabled } from '../../config/flags';
import { matchTagFlexible, matchTextFlexible } from '@/utils/tag-search';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getEventTypeHindi } from '@/lib/eventTypes';
import { useSortableTable, SortField } from '@/hooks/useSortableTable';
import { usePolling } from '@/hooks/usePolling';
import type { Route } from 'next';

type Post = { id: string | number; timestamp: string; content: string; parsed?: any; confidence?: number; needs_review?: boolean; review_status?: string };

export default function DashboardDark() {
  const [locFilter, setLocFilter] = useState('');
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

  // Fetch server-side parsed events with polling
  const fetchParsedEvents = async () => {
    try {
      const res = await api.get<{ success: boolean; data: any[] }>(`/api/parsed-events?limit=200`);
      if (res.success) return res.data;
      return [];
    } catch {
      return [];
    }
  };

  const { 
    data: serverRows, 
    isLoading: isPolling, 
    hasNewData, 
    clearNewDataNotification 
  } = usePolling(fetchParsedEvents, {
    interval: 30000, // 30 seconds
    enabled: true,
    onNewData: (newData, previousData) => {
      console.log(`New tweets detected: ${newData.length - previousData.length} new tweets`);
    }
  });

  const parsed = useMemo(() => {
    const source = serverRows || parsedTweets;
    return source.map((p: any) => {
      // Handle both old parsed structure and new database structure
      const isDbData = p.locations !== undefined; // Database data has locations directly
      
      if (isDbData) {
        // Database structure
        const locations = (p.locations || []).map((l: any) => l.name || l);
        const people = p.people_mentioned || [];
        const orgs = p.organizations || [];
        const schemes = p.schemes_mentioned || [];
        
        return {
          id: p.id,
          ts: p.event_date || p.parsed_at,
          when: formatHindiDate(p.event_date || p.parsed_at),
          where: locations,
          what: [p.event_type || 'अन्य'],
          which: {
            mentions: people,
            hashtags: [...orgs, ...schemes],
          },
          schemes: schemes,
          how: p.content || `Tweet ID: ${p.tweet_id}`,
          confidence: p.confidence,
          needs_review: p.needs_review,
          review_status: p.review_status,
        };
      } else if (p.parsed && p.parsed.event_type) {
        // Old parsed structure
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
          confidence: p.parsed.confidence,
          needs_review: p.needs_review,
          review_status: p.review_status,
        };
      }
      
      // Fallback for unparsed data
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

  // Add sorting functionality
  const getFieldValue = (item: any, field: SortField) => {
    switch (field) {
      case 'date':
        return new Date(item.ts).getTime();
      case 'location':
        return item.where?.[0] || '';
      case 'event_type':
        return item.what?.[0] || '';
      case 'tags':
        return [...(item.which?.hashtags || []), ...(item.which?.mentions || [])].join(' ');
      case 'content':
        return item.how || '';
      default:
        return '';
    }
  };

  const { sortedData, handleSort, getSortIcon } = useSortableTable(filtered, getFieldValue);

  const totalCount = parsed.length;
  const shownCount = filtered.length;

  return (
    <section>
      {/* New Data Notification */}
      {hasNewData && (
        <div className="mb-4 bg-green-900/50 border border-green-700 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-green-400">refresh</span>
            <span className="text-green-300 text-sm font-medium">
              नए ट्वीट उपलब्ध हैं! पेज रिफ्रेश करें या नीचे स्क्रॉल करें।
            </span>
          </div>
          <button
            onClick={clearNewDataNotification}
            className="text-green-400 hover:text-green-300 text-sm underline"
          >
            छुपाएं
          </button>
        </div>
      )}

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
              <th 
                className="text-center font-semibold p-2 border-b border-gray-700 cursor-pointer hover:bg-gray-800 transition-colors"
                onClick={() => handleSort('date')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSort('date');
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label="Sort by date"
              >
                दिन / दिनांक {getSortIcon('date')}
              </th>
              <th 
                className="text-center font-semibold p-2 border-b border-l border-gray-700 cursor-pointer hover:bg-gray-800 transition-colors"
                onClick={() => handleSort('location')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSort('location');
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label="Sort by location"
              >
                स्थान {getSortIcon('location')}
              </th>
              <th 
                className="text-center font-semibold p-2 border-b border-l border-gray-700 cursor-pointer hover:bg-gray-800 transition-colors"
                onClick={() => handleSort('event_type')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSort('event_type');
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label="Sort by event type"
              >
                दौरा / कार्यक्रम {getSortIcon('event_type')}
              </th>
              <th 
                className="text-center font-semibold p-2 border-b border-l border-gray-700 w-[14%] cursor-pointer hover:bg-gray-800 transition-colors"
                onClick={() => handleSort('tags')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSort('tags');
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label="Sort by tags"
              >
                कौन/टैग {getSortIcon('tags')}
              </th>
              <th 
                className="text-center font-semibold p-2 border-b border-l border-gray-700 w-[38%] cursor-pointer hover:bg-gray-800 transition-colors"
                onClick={() => handleSort('content')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSort('content');
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label="Sort by content"
              >
                विवरण {getSortIcon('content')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-[#192734]" data-testid="tbody">
            {sortedData.map((row, index) => (
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
