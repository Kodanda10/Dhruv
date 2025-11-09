"use client";
// Removed mock data import - using only database data
import { api } from '@/lib/api';
import { parsePost, formatHindiDate } from '@/utils/parse';
import { isParseEnabled } from '../../config/flags';
import { matchTagFlexible, matchTextFlexible } from '@/utils/tag-search';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getEventTypeInHindi } from '@/lib/i18n/event-types-hi';
import type { Route } from 'next';
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
  
  // Check if bulk review mode is enabled
  const bulkReviewMode = searchParams?.get('bulk_review') === 'true';

  // Sync from URL params
  useEffect(() => {
    if (!searchParams) return;
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

  // Fetch server-side data - either all tweets (bulk review) or parsed events only (normal)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (bulkReviewMode) {
          // Bulk review mode: Fetch ALL tweets (parsed + unparsed) with test_mode=true for testing
          const res = await api.get<{ 
            success: boolean; 
            tweets: any[]; 
            events?: any[];
            data?: any[];
            count?: number; 
            total?: number;
            parsed?: number;
            unparsed?: number;
            test_mode?: boolean;
          }>(`/api/all-tweets?test_mode=true&limit=20`);
          
          if (mounted && res.success) {
            const tweets = res.tweets || res.events || res.data || [];
            console.log(`[Dashboard] Bulk Review Mode: Fetched ${tweets.length} tweets`, {
              total: res.total,
              parsed: res.parsed,
              unparsed: res.unparsed,
              test_mode: res.test_mode,
              tweets_length: tweets.length
            });
            setServerRows(tweets);
          } else if (mounted) {
            console.warn('[Dashboard] Bulk Review: No tweets received from API', res);
            setServerRows([]);
          }
        } else {
          // Normal mode: Fetch only parsed events
          const res = await api.get<{ success: boolean; events: any[]; count?: number; total?: number; total_op_choudhary?: number }>(`/api/parsed-events?limit=5000`);
          if (mounted && res.success && res.events && res.events.length > 0) {
            console.log(`[Dashboard] Normal Mode: Fetched ${res.events.length} parsed events from API`, {
              count: res.count,
              total: res.total,
              total_op_choudhary: res.total_op_choudhary,
              events_length: res.events.length
            });
            setServerRows(res.events);
          } else if (mounted) {
            console.warn('[Dashboard] Normal Mode: No events received from API', res);
            setServerRows([]);
          }
        }
      } catch (error) {
        console.error(`[Dashboard] Failed to fetch data (mode: ${bulkReviewMode ? 'bulk_review' : 'normal'}):`, error);
        if (mounted) setServerRows([]);
      }
    })();
    return () => { mounted = false; };
  }, [bulkReviewMode]);

  // Overlay local reviewed edits from localStorage onto data
  const baseRows: any[] = useMemo(() => {
    if (serverRows && Array.isArray(serverRows) && serverRows.length > 0) {
      return serverRows.map((e: any) => {
        // Handle both bulk review format (with is_parsed flag) and normal format
        const isParsed = e.is_parsed !== undefined ? e.is_parsed : true;
        const parsedData = e.parsed_data || e;
        
        if (isParsed && parsedData) {
          // Parsed tweet - use parsed data
          return {
            id: e.tweet_id,
            timestamp: e.tweet_created_at || e.timestamp,
            content: e.tweet_text || e.text || e.content,
            is_parsed: true,
            parsing_status: 'parsed',
            parsed: {
              event_type: parsedData.event_type || e.event_type,
              locations: (parsedData.locations || e.locations || []).map((l: any) => l.name || l),
              people_mentioned: parsedData.people_mentioned || e.people_mentioned || [],
              organizations: parsedData.organizations || e.organizations || [],
              schemes_mentioned: parsedData.schemes_mentioned || e.schemes_mentioned || [],
            },
            confidence: parsedData.overall_confidence || e.overall_confidence,
            needs_review: parsedData.needs_review !== undefined ? parsedData.needs_review : e.needs_review,
            review_status: parsedData.review_status || e.review_status,
          };
        } else {
          // Unparsed tweet - minimal structure
          return {
            id: e.tweet_id,
            timestamp: e.tweet_created_at || e.timestamp,
            content: e.tweet_text || e.text || e.content,
            is_parsed: false,
            parsing_status: 'unparsed',
            parsed: {
              event_type: 'other',
              locations: [],
              people_mentioned: [],
              organizations: [],
              schemes_mentioned: [],
            },
            confidence: 0,
            needs_review: true,
            review_status: 'pending',
          };
        }
      });
    }
    // Return empty array if no database data - no mock data fallback
    return [];
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
      const eventTypeDisplay = overlay?.event_type
        ? getEventTypeInHindi(overlay.event_type)
        : (p.parsed.event_type_hi || getEventTypeInHindi(p.parsed.event_type));
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
        what: [eventTypeDisplay],
        which: {
          mentions: people,
          hashtags: [...orgs, ...schemesEff],
        },
        schemes: schemesEff,
        how: p.content || '',
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
      how: p.content || '',
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
          r.what.some((w: string) => matchTextFlexible(w, q)) ||
          r.where.some((w: string) => matchTextFlexible(w, q))
        );
      });
    }
    if (actionFilter.trim()) {
      const q = actionFilter.trim();
      rows = rows.filter((r) => r.what.some((w: string) => w.includes(q)));
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
  
  // Debug logging
  useEffect(() => {
    if (totalCount > 0) {
      console.log(`[Dashboard] Display stats:`, {
        totalCount,
        shownCount,
        serverRowsCount: serverRows?.length || 0,
        parsedCount: parsed.length,
        filteredCount: filtered.length,
        hasFilters: !!(locFilter || tagFilter || actionFilter || fromDate || toDate)
      });
    }
  }, [totalCount, shownCount, serverRows, parsed.length, filtered.length, locFilter, tagFilter, actionFilter, fromDate, toDate]);

  return (
    <section>
      {/* Simple summaries for tests and quick insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 transition-all duration-500 ease-in-out">
        <div className="glassmorphic-card p-4 rounded-2xl">
          <h2 className="text-xl sm:text-2xl font-bold tracking-wide text-white drop-shadow-[0_0_6px_#12005E] mb-2 mt-4 transition-all duration-500 ease-in-out">📍 स्थान सारांश</h2>
          <div className="text-sm sm:text-base text-secondary mt-1">
            {(() => {
              const top = Object.entries(
                filtered.reduce((acc: Record<string, number>, r: any) => {
                  (r.where || []).forEach((w: string) => {
                    acc[w] = (acc[w] || 0) + 1;
                  });
                  return acc;
                }, {})
              ).sort((a, b) => b[1] - a[1]).slice(0, 3);
              return top.length ? top.map(([k, v]) => `${k} (${v})`).join(', ') : '—';
            })()}
          </div>
        </div>
        <div className="glassmorphic-card p-4 rounded-2xl">
          <h2 className="text-xl sm:text-2xl font-bold tracking-wide text-white drop-shadow-[0_0_6px_#12005E] mb-2 mt-4 transition-all duration-500 ease-in-out">🎯 गतिविधि सारांश</h2>
          <div className="text-sm sm:text-base text-secondary mt-1">
            {(() => {
              const top = Object.entries(
                filtered.reduce((acc: Record<string, number>, r: any) => {
                  (r.what || []).forEach((w: string) => {
                    acc[w] = (acc[w] || 0) + 1;
                  });
                  return acc;
                }, {})
              ).sort((a, b) => b[1] - a[1]).slice(0, 3);
              return top.length ? top.map(([k, v]) => `${getEventTypeInHindi(k)} (${v})`).join(', ') : '—';
            })()}
          </div>
        </div>
      </div>
      <div className="mb-4 flex items-end gap-4 flex-wrap glassmorphic-card p-4 rounded-2xl transition-all duration-500 ease-in-out">
        <label className="text-sm sm:text-base font-medium text-white">
          स्थान फ़िल्टर
          <input
            aria-label="स्थान फ़िल्टर"
            className="ml-2 border border-white/20 rounded-lg focus:outline-none focus:border-[#8BF5E6] focus:ring-2 focus:ring-[#8BF5E6]/20 placeholder:text-white/60 bg-white/5 backdrop-blur-sm text-white transition-all duration-500 ease-in-out px-2 py-1 w-full sm:w-40"
            placeholder="जैसे: रायगढ़"
            value={locFilter}
            onChange={(e) => setLocFilter(e.target.value)}
          />
        </label>
        <label className="text-sm sm:text-base font-medium text-white">
          टैग/मेंशन फ़िल्टर
          <input
            aria-label="टैग/मेंशन फ़िल्टर"
            className="ml-2 border border-white/20 rounded-lg focus:outline-none focus:border-[#8BF5E6] focus:ring-2 focus:ring-[#8BF5E6]/20 placeholder:text-white/60 bg-white/5 backdrop-blur-sm text-white transition-all duration-500 ease-in-out px-2 py-1 w-full sm:w-48"
            placeholder="#समारोह, @PMOIndia"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
          />
        </label>
        <label className="text-sm sm:text-base font-medium text-white">
          तिथि से
          <input
            aria-label="तिथि से"
            type="date"
            className="ml-2 border border-white/20 rounded-lg focus:outline-none focus:border-[#8BF5E6] focus:ring-2 focus:ring-[#8BF5E6]/20 placeholder:text-white/60 bg-white/5 backdrop-blur-sm text-white transition-all duration-500 ease-in-out px-2 py-1 w-full sm:w-auto"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </label>
        <label className="text-sm sm:text-base font-medium text-white">
          तिथि तक
          <input
            aria-label="तिथि तक"
            type="date"
            className="ml-2 border border-white/20 rounded-lg focus:outline-none focus:border-[#8BF5E6] focus:ring-2 focus:ring-[#8BF5E6]/20 placeholder:text-white/60 bg-white/5 backdrop-blur-sm text-white transition-all duration-500 ease-in-out px-2 py-1 w-full sm:w-auto"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </label>
        <div className="ml-auto flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          {bulkReviewMode && (
            <div className="text-xs sm:text-sm text-[#8BF5E6] font-semibold px-2 py-1 rounded bg-[#8BF5E6]/10 border border-[#8BF5E6]/30">
              🔍 बल्क रिव्यू मोड: {baseRows.filter((r: any) => r.is_parsed).length} पार्स किए गए, {baseRows.filter((r: any) => !r.is_parsed).length} अपार्स
            </div>
          )}
          <div className="text-secondary text-sm sm:text-base" aria-live="polite">
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
      <div className="overflow-x-auto glassmorphic-card p-2 rounded-2xl transition-all duration-500 ease-in-out">
        <table aria-label="गतिविधि सारणी" className="min-w-full text-sm sm:text-base border-collapse table-fixed text-white">
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[14%]" />
            <col className="w-[18%]" />
            <col className="w-[14%]" />
            <col className="w-[38%]" />
          </colgroup>
          <thead className="text-white">
            <tr>
              <th className="text-left font-bold text-base sm:text-lg p-2 sm:p-3 border-b border-white/20 drop-shadow-[0_0_6px_#12005E] transition-all duration-500 ease-in-out">दिन / दिनांक</th>
              {bulkReviewMode && (
                <th className="text-left font-bold text-base sm:text-lg p-2 sm:p-3 border-b border-l border-white/20 drop-shadow-[0_0_6px_#12005E] transition-all duration-500 ease-in-out">📊 स्थिति</th>
              )}
              <th className="text-left font-bold text-base sm:text-lg p-2 sm:p-3 border-b border-l border-white/20 drop-shadow-[0_0_6px_#12005E] transition-all duration-500 ease-in-out">📍 स्थान</th>
              <th className="text-left font-bold text-base sm:text-lg p-2 sm:p-3 border-b border-l border-white/20 drop-shadow-[0_0_6px_#12005E] transition-all duration-500 ease-in-out">🎯 दौरा / कार्यक्रम</th>
              <th className="text-left font-bold text-base sm:text-lg p-2 sm:p-3 border-b border-l border-white/20 w-[14%] drop-shadow-[0_0_6px_#12005E] transition-all duration-500 ease-in-out">👥 कौन/टैग</th>
              <th className="text-left font-bold text-base sm:text-lg p-2 sm:p-3 border-b border-l border-white/20 w-[38%] drop-shadow-[0_0_6px_#12005E] transition-all duration-500 ease-in-out">📝 विवरण</th>
            </tr>
          </thead>
          <tbody className="text-secondary" data-testid="tbody">
            {filtered.map((row, index) => {
              const baseRow = baseRows.find((r: any) => r.id === row.id);
              const isParsed = baseRow?.is_parsed !== false;
              return (
              <tr key={row.id} className={`align-top hover:bg-white/5 transition-colors`}>
                <td className="p-2 border-b border-white/10 whitespace-nowrap">{row.when}</td>
                {bulkReviewMode && (
                  <td className="p-2 border-b border-l border-white/10">
                    {isParsed ? (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-green-500/20 text-green-300 border border-green-500/30">
                        ✅ पार्स
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                        ⚠️ अपार्स
                      </span>
                    )}
                  </td>
                )}
                <td className="p-2 border-b border-l border-white/10">{row.where.join(', ') || '—'}</td>
                <td className="p-2 border-b border-l border-white/10">
                  {row.what.length ? (
                    row.what.map((w:any) => getEventTypeInHindi(w)).join(', ')
                  ) : (
                    isParsed ? '—' : <span className="text-yellow-300 text-xs">⚠️ अपार्स - समीक्षा आवश्यक</span>
                  )}
                </td>
                <td className="p-2 border-b border-l border-white/10 align-top w-[14%]" aria-label="कौन/टैग">
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
                  className="p-2 border-b border-l border-white/10 align-top whitespace-pre-wrap break-words w-[38%]"
                  aria-label="विवरण"
                  title={row.how || ''}
                >
                  {(() => {
                    const urlRegex = /(https?:\/\/[^\s]+)/g;
                    const howText = row.how || '';
                    const parts = howText.split(urlRegex);
                    return parts.map((part: string, i: number) => {
                      const isUrl = part.startsWith('http://') || part.startsWith('https://');
                      return isUrl ? (
                        <a
                          key={i}
                          href={part}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#8BF5E6] underline break-all hover:text-[#b8fff5] transition-colors"
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
            );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
