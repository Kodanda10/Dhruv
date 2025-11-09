"use client";
import { api } from '@/lib/api';
import { logger } from '@/lib/utils/logger';
import { parsePost, formatHindiDate } from '@/utils/parse';
import { isParseEnabled } from '../../config/flags';
import { matchTagFlexible, matchTextFlexible } from '@/utils/tag-search';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getEventTypeHindi } from '@/lib/eventTypes';
// Temporarily disabled - hooks not found
// import { useSortableTable, SortField } from '@/hooks/useSortableTable';
// import { usePolling } from '@/hooks/usePolling';
import type { Route } from 'next';

type Post = { id: string | number; timestamp: string; content: string; parsed?: any; confidence?: number; needs_review?: boolean; review_status?: string };

export default function DashboardDark() {
  logger.debug('DashboardDark: Component mounting...');
  
  // Move useEffect to the very beginning
  const [serverRows, setServerRows] = useState<any[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<string>('loading'); // Track data source for debugging

  logger.debug('DashboardDark: About to call useEffect');

  useEffect(() => {
    logger.debug('DashboardDark: useEffect triggered');
    const fetchData = async () => {
      logger.debug('DashboardDark: Simple fetch starting...');
      setIsPolling(true);
      try {
        // Fetch ALL parsed events - no limit to show complete dataset
        const res = await api.get<{ success: boolean; data: any[]; error?: string; details?: string }>(`/api/parsed-events?limit=5000`);
        logger.debug('DashboardDark: Simple fetch response:', { 
          success: res.success, 
          count: res.data?.length, 
          source: (res as any).source,
          error: (res as any).error,
          details: (res as any).details
        });
        
        if (res.success && res.data && Array.isArray(res.data) && res.data.length > 0) {
          setServerRows(res.data);
          setError(null);
          setDataSource((res as any).source || 'database');
          logger.info(`DashboardDark: Loaded ${res.data.length} events from ${(res as any).source || 'database'}`);
        } else {
          logger.warn('DashboardDark: No data received:', res);
          setServerRows([]);
          setDataSource((res as any).source || 'empty');
          
          // Provide detailed error message
          if ((res as any).error) {
            const errorMsg = (res as any).error;
            const details = (res as any).details;
            setError(details ? `${errorMsg}: ${details}` : errorMsg);
          } else if (!res.success) {
            setError('API returned unsuccessful response');
          } else {
            setError('No data available in database');
          }
        }
      } catch (error) {
        logger.error('DashboardDark: Simple fetch error:', error as Error);
        setServerRows([]);
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch data';
        setError(errorMessage);
        setDataSource('error');
      } finally {
        setIsPolling(false);
        setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  logger.debug('DashboardDark: After useEffect');
  
  const [locFilter, setLocFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const searchParams = useSearchParams() || new URLSearchParams();
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
  const fetchParsedEvents = useCallback(async () => {
    try {
      logger.debug('DashboardDark: Fetching parsed events...');
      // Fetch ALL parsed events - no limit to show complete dataset
      const res = await api.get<{ success: boolean; data: any[] }>(`/api/parsed-events?limit=5000`);
      logger.debug('DashboardDark: API response:', res);
      if (res.success) return res.data;
      logger.warn('DashboardDark: API response not successful');
      return [];
    } catch (error) {
      logger.error('DashboardDark: API fetch error:', error as Error);
      return [];
    }
  }, []);

  logger.debug('DashboardDark: Simple fetch result:', { serverRows: serverRows?.length, isPolling });

  const parsed = useMemo(() => {
    // Use real database data from serverRows, fallback to parsedTweets if empty
    const source = serverRows.length > 0 ? serverRows : [];
    logger.debug('DashboardDark: Using data source:', serverRows.length > 0 ? 'serverRows (real data from database)' : 'empty (no fallback)', 'length:', source.length);
    
    return source.map((p: any, index: number) => {
      // Handle both old parsed structure and new database structure
      const isDbData = p.locations !== undefined; // Database data has locations directly
      
      if (isDbData) {
        // Database structure - ensure locations are always strings
        const locations: string[] = (p.locations || [])
          .map((l: any) => {
            if (typeof l === 'string') return l.trim();
            if (l && typeof l === 'object' && l !== null) {
              const name = l.name || l.location || '';
              return typeof name === 'string' ? name.trim() : '';
            }
            return '';
          })
          .filter((loc: string): loc is string => typeof loc === 'string' && loc.length > 0);
        const people = p.people_mentioned || [];
        const orgs = p.organizations || [];
        const schemes = p.schemes_mentioned || [];
        
        // Handle timestamp field - try multiple possible field names
        const timestamp = p.event_date || p.parsed_at || p.timestamp || p.created_at || new Date().toISOString();
        
        return {
          id: p.id || p.tweet_id || `tweet-${index}`,
          ts: timestamp,
          when: formatHindiDate(timestamp),
          where: locations,
          what: [p.event_type || 'अन्य'].filter(Boolean),
          which: {
            mentions: Array.isArray(people) ? people : [],
            hashtags: [...(Array.isArray(orgs) ? orgs : []), ...(Array.isArray(schemes) ? schemes : [])],
          },
          schemes: Array.isArray(schemes) ? schemes : [],
          how: p.content || p.text || `Tweet ID: ${p.tweet_id || p.id}`,
          confidence: p.confidence || 0,
          needs_review: p.needs_review || false,
          review_status: p.review_status || 'pending',
        };
      } else if (p.parsed && p.parsed.event_type) {
        // Old parsed structure
        const locations: string[] = (p.parsed.locations || [])
          .map((l: any) => {
            if (typeof l === 'string') return l.trim();
            if (l && typeof l === 'object' && l !== null) {
              const name = l.name || l.location || '';
              return typeof name === 'string' ? name.trim() : '';
            }
            return '';
          })
          .filter((loc: string): loc is string => typeof loc === 'string' && loc.length > 0);
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
    logger.debug('DashboardDark: parsed length:', parsed.length);
    logger.debug('DashboardDark: first parsed item:', parsed[0]);
    
    // Include ALL rows including skipped - home page table shows everything
    let rows = parsed;
    logger.debug('DashboardDark: rows (including skipped):', rows.length);
    if (locFilter.trim()) {
      const q = locFilter.trim();
      rows = rows.filter((r) => {
        if (!Array.isArray(r.where)) return false;
        return r.where.some((w: any) => {
          const wStr = typeof w === 'string' ? w : (w?.name || String(w || ''));
          return matchTextFlexible(wStr, q);
        });
      });
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
          r.where.some((w: any) => {
            const wStr = typeof w === 'string' ? w : (w?.name || String(w || ''));
            return matchTextFlexible(wStr, q);
          })
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

  // Sanitize data before rendering to ensure no objects slip through
  const sanitizedData = useMemo(() => {
    return filtered.map((row: any) => {
      // Ensure where is always string[]
      const where: string[] = Array.isArray(row.where) 
        ? row.where.map((w: any) => {
            if (typeof w === 'string') return w;
            if (w && typeof w === 'object' && w !== null) {
              const name = w.name || w.location || '';
              return typeof name === 'string' ? name.trim() : '';
            }
            return '';
          }).filter((loc: string): loc is string => typeof loc === 'string' && loc.length > 0)
        : [];
      
      // Ensure what is always string[]
      const what: string[] = Array.isArray(row.what)
        ? row.what.map((w: any) => {
            if (typeof w === 'string') return w;
            if (w && typeof w === 'object' && w !== null) {
              const name = w.name || '';
              return typeof name === 'string' ? name.trim() : '';
            }
            return '';
          }).filter((evt: string): evt is string => typeof evt === 'string' && evt.length > 0)
        : [];
      
      // Ensure how is always string
      const how: string = typeof row.how === 'string' ? row.how : String(row.how || '');
      
      // Ensure when is always string
      const when: string = typeof row.when === 'string' ? row.when : String(row.when || '');
      
      // Ensure which.mentions and hashtags are string[]
      const mentions: string[] = Array.isArray(row.which?.mentions)
        ? row.which.mentions.map((m: any) => {
            if (typeof m === 'string') return m;
            return String(m || '');
          }).filter((m: string): m is string => typeof m === 'string' && m.length > 0)
        : [];
      const hashtags: string[] = Array.isArray(row.which?.hashtags)
        ? row.which.hashtags.map((h: any) => {
            if (typeof h === 'string') return h;
            return String(h || '');
          }).filter((h: string): h is string => typeof h === 'string' && h.length > 0)
        : [];
      
      // Return only safe properties - don't spread ...row to avoid carrying over objects
      return {
        id: row.id,
        ts: row.ts,
        when,
        where,
        what,
        which: {
          mentions,
          hashtags
        },
        schemes: Array.isArray(row.schemes) ? row.schemes.map((s: any) => typeof s === 'string' ? s : String(s || '')).filter(Boolean) : [],
        how,
        confidence: typeof row.confidence === 'number' ? row.confidence : 0,
        needs_review: typeof row.needs_review === 'boolean' ? row.needs_review : false,
        review_status: typeof row.review_status === 'string' ? row.review_status : 'pending',
      };
    });
  }, [filtered]);

  // Add sorting functionality - use sanitized data
  type SortField = 'date' | 'location' | 'event_type' | 'tags' | 'content' | 'confidence';
  const getFieldValue = (item: any, field: SortField) => {
    switch (field) {
      case 'date':
        return new Date(item.ts).getTime();
      case 'location':
        return (Array.isArray(item.where) && item.where[0]) ? String(item.where[0]) : '';
      case 'event_type':
        return (Array.isArray(item.what) && item.what[0]) ? String(item.what[0]) : '';
      case 'tags':
        const tags = [...(item.which?.hashtags || []), ...(item.which?.mentions || [])];
        return tags.join(', ');
      case 'content':
        return typeof item.how === 'string' ? item.how : String(item.how || '');
      case 'confidence':
        return item.confidence || 0;
      default:
        return '';
    }
  };

  // Sorting state (temporarily disabled - hooks not found)
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // ✅ Corrected function definition
  const handleSort = (field: string) => {
    setSortField(field);
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  // Fix count discrepancy: Use actual data source count, not parsed length
  const totalCount = serverRows.length > 0 ? serverRows.length : 0;

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortField) return serverRows;
    return [...serverRows].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal === bVal) return 0;
      const comparison = aVal > bVal ? 1 : -1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [serverRows, sortField, sortDirection]);

  // Get sort icon
  const getSortIcon = (field: string) => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };
  const shownCount = filtered.length;

  // Show loading state
  if (isLoading) {
    return (
      <section>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-mint-green mb-4"></div>
          <p className="text-gray-400 text-lg">डेटा लोड हो रहा है...</p>
          <p className="text-gray-500 text-sm mt-2">कृपया प्रतीक्षा करें</p>
        </div>
      </section>
    );
  }

  // Show error state
  if (error) {
    return (
      <section>
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-6 text-center">
          <span className="material-symbols-outlined text-red-400 text-4xl mb-3 block">error</span>
          <h3 className="text-red-300 text-lg font-semibold mb-2">डेटा लोड करने में त्रुटि</h3>
          <p className="text-red-400 text-sm mb-4">{error}</p>
          <p className="text-gray-400 text-xs mb-4">
            डेटा स्रोत: {dataSource}
          </p>
          <button
            onClick={() => {
              setIsLoading(true);
              setError(null);
              // Trigger re-fetch
              const event = new Event('refresh');
              window.dispatchEvent(event);
            }}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            पुनः प्रयास करें
          </button>
        </div>
      </section>
    );
  }

  // Show empty state
  if (serverRows.length === 0 && !isLoading && !error) {
    return (
      <section>
        <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-6 text-center">
          <span className="material-symbols-outlined text-yellow-400 text-4xl mb-3 block">info</span>
          <h3 className="text-yellow-300 text-lg font-semibold mb-2">कोई डेटा उपलब्ध नहीं</h3>
          <p className="text-yellow-400 text-sm mb-4">
            डेटाबेस में अभी तक कोई पार्स किए गए इवेंट नहीं हैं।
          </p>
          <p className="text-gray-400 text-xs">
            डेटा स्रोत: {dataSource}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      {/* New Data Notification - Temporarily disabled */}
      {false && (
        <div className="mb-4 bg-green-900/50 border border-green-700 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-green-400">refresh</span>
            <span className="text-green-300 text-sm font-medium">
              नए ट्वीट उपलब्ध हैं! पेज रिफ्रेश करें या नीचे स्क्रॉल करें।
            </span>
          </div>
          <button
            onClick={() => {}}
            className="text-green-400 hover:text-green-300 text-sm underline"
          >
            छुपाएं
          </button>
        </div>
      )}

      <div className="mb-4 flex items-end gap-4 flex-wrap glassmorphic-card glassmorphic-hover rounded-xl p-4">
        <label className="text-sm font-medium text-secondary">
          स्थान फ़िल्टर
          <input
            aria-label="स्थान फ़िल्टर"
            className="ml-2 border border-white border-opacity-20 bg-white bg-opacity-5 text-primary placeholder:text-muted px-2 py-1 rounded-md w-40 focus:outline-none focus:ring-2 focus:ring-mint-green focus:border-mint-green"
            placeholder="जैसे: रायगढ़"
            value={locFilter}
            onChange={(e) => setLocFilter(e.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-secondary">
          टैग/मेंशन फ़िल्टर
          <input
            aria-label="टैग/मेंशन फ़िल्टर"
            className="ml-2 border border-white border-opacity-20 bg-white bg-opacity-5 text-primary placeholder:text-muted px-2 py-1 rounded-md w-48 focus:outline-none focus:ring-2 focus:ring-mint-green focus:border-mint-green"
            placeholder="#समारोह, @PMOIndia"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-secondary">
          तिथि से
          <input
            aria-label="तिथि से"
            type="date"
            className="ml-2 border border-white border-opacity-20 bg-white bg-opacity-5 text-primary placeholder:text-muted px-2 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-mint-green focus:border-mint-green"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-secondary">
          तिथि तक
          <input
            aria-label="तिथि तक"
            type="date"
            className="ml-2 border border-white border-opacity-20 bg-white bg-opacity-5 text-primary placeholder:text-muted px-2 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-mint-green focus:border-mint-green"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </label>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-muted text-sm" aria-live="polite">
            {`दिखा रहे हैं: ${shownCount} / ${totalCount}`}
          </div>
          <button
            aria-label="डेटा रिफ्रेश करें"
            onClick={async () => {
              setIsPolling(true);
              try {
                // Fetch ALL parsed events - no limit to show complete dataset
                const res = await api.get<{ success: boolean; data: any[] }>(`/api/parsed-events?limit=5000`);
                if (res.success) {
                  setServerRows(res.data);
                }
              } catch (error) {
                logger.error('DashboardDark: Refresh error:', error as Error);
              } finally {
                setIsPolling(false);
              }
            }}
            disabled={isPolling}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-mint-green bg-opacity-20 text-mint-green border border-mint-green border-opacity-40 hover:bg-opacity-30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span className={`material-symbols-outlined text-base ${isPolling ? 'animate-spin' : ''}`}>
              {isPolling ? 'hourglass_empty' : 'refresh'}
            </span>
            {isPolling ? 'रिफ्रेश हो रहा है...' : 'रिफ्रेश करें'}
          </button>
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
            className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-white bg-opacity-10 text-primary border border-white border-opacity-20 hover:bg-opacity-15 transition-colors"
          >
            फ़िल्टर साफ़ करें
          </button>
        </div>
      </div>
      <div className="overflow-x-auto glassmorphic-card rounded-xl p-2">
        <table aria-label="गतिविधि सारणी" className="min-w-full text-sm border-collapse table-fixed text-primary">
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[14%]" />
            <col className="w-[18%]" />
            <col className="w-[14%]" />
            <col className="w-[38%]" />
          </colgroup>
          <thead className="bg-white bg-opacity-5 text-secondary">
            <tr>
              <th 
                className="text-center font-semibold p-2 border-b border-white border-opacity-20 cursor-pointer hover:bg-white hover:bg-opacity-10 transition-colors"
                onClick={() => handleSort('date' as any)}
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
          <tbody className="bg-transparent" data-testid="tbody">
            {!sanitizedData || sortedData.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted">
                  <div className="flex flex-col items-center gap-2">
                    <span className="material-symbols-outlined text-4xl text-muted opacity-70">inbox</span>
                    <p className="text-lg font-medium text-primary">कोई डेटा नहीं मिला</p>
                    <p className="text-sm text-secondary">कृपया फ़िल्टर सेटिंग्स जांचें या बाद में पुनः प्रयास करें।</p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedData.map((row, index) => (
              <tr key={row.id || index} className={`align-top hover:bg-white hover:bg-opacity-5 transition-colors`}>
                <td className="p-2 border-b border-white border-opacity-10 whitespace-nowrap">
                  {typeof row.when === 'string' ? row.when : String(row.when || '')}
                </td>
                <td className="p-2 border-b border-l border-white border-opacity-10">
                  {(() => {
                    const locations = Array.isArray(row.where) 
                      ? row.where.map((w: any) => {
                          if (typeof w === 'string') return w;
                          if (w && typeof w === 'object') return w.name || w.location || '';
                          return String(w || '');
                        }).filter((loc: string) => loc && loc.trim())
                      : [];
                    return locations.length > 0 ? locations.join(', ') : '—';
                  })()}
                </td>
                <td className="p-2 border-b border-l border-white border-opacity-10">
                  {(() => {
                    const events = Array.isArray(row.what) 
                      ? row.what.map((w: any) => {
                          const evt = typeof w === 'string' ? w : (w?.name || String(w || ''));
                          return getEventTypeHindi(evt);
                        }).filter(Boolean)
                      : [];
                    return events.length > 0 ? events.join(', ') : '—';
                  })()}
                </td>
                <td className="p-2 border-b border-l border-gray-700 align-top w-[14%]" aria-label="कौन/टैग">
                  {(() => {
                    const tags = [...row.which.mentions, ...row.which.hashtags];
                    if (!tags.length) return '—';
                    return (
                      <div className="flex gap-2 flex-wrap max-w-[14rem]">
                        {tags.map((t: string, i: number) => {
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
                                  ? 'bg-mint-green bg-opacity-20 text-mint-green border border-mint-green border-opacity-40' 
                                  : 'bg-white bg-opacity-10 text-secondary border border-white border-opacity-20 hover:bg-opacity-15'
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
                  title={typeof row.how === 'string' ? row.how : String(row.how || '')}
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
            )))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
