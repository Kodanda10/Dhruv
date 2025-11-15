'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import { formatHindiDate } from '@/utils/parse';
import { getEventTypeInHindi } from '@/lib/i18n/event-types-hi';
import SoftButton from '@/components/SoftButton';
import Chip from '@/components/Chip';
import GlassSectionCard from '@/components/GlassSectionCard';

type Post = { id: string | number; timestamp: string; content: string; parsed?: any; confidence?: number; needs_review?: boolean; review_status?: string };

export default function ReviewDashboard() {
  const [serverRows, setServerRows] = useState<any[] | null>(null);
  const [locFilter, setLocFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [reviewStatusFilter, setReviewStatusFilter] = useState('');

  // Fetch all tweets for review
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get<{
          success: boolean;
          tweets: any[];
          events?: any[];
          data?: any[];
          count?: number;
          total?: number;
          parsed?: number;
          unparsed?: number;
        }>('/api/all-tweets');

        if (mounted && res.success) {
          const tweets = res.tweets || res.events || res.data || [];
          console.log('[ReviewDashboard] Fetched tweets for review:', {
            total: res.total,
            parsed: res.parsed,
            unparsed: res.unparsed,
            tweets_length: tweets.length
          });
          setServerRows(tweets);
        } else if (mounted) {
          console.warn('[ReviewDashboard] No tweets received from API', res);
          setServerRows([]);
        }
      } catch (error) {
        console.error('[ReviewDashboard] Failed to fetch tweets:', error);
        if (mounted) setServerRows([]);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Process tweets for display
  const baseRows: any[] = useMemo(() => {
    if (serverRows && Array.isArray(serverRows) && serverRows.length > 0) {
      return serverRows.map((e: any) => {
        const isParsed = e.is_parsed !== undefined ? e.is_parsed : true;
        const parsedData = e.parsed_data || e;

        if (isParsed && parsedData) {
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
    return [];
  }, [serverRows]);

  const parsed = useMemo(() => baseRows.map((p: any) => {
    if (p.parsed && p.parsed.event_type) {
      const schemes = p.parsed.schemes_mentioned || p.parsed.schemes || [];
      const organizations = p.parsed.organizations || [];

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

    if (p.is_parsed === false) {
      return {
        id: p.id,
        ts: p.timestamp,
        when: formatHindiDate(p.timestamp),
        where: [],
        what: [],
        which: { mentions: [], hashtags: [] },
        schemes: [],
        how: p.content || '',
        confidence: 0,
        needs_review: true,
        review_status: 'pending',
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
      how: p.content || '',
    };
  }), [baseRows]);

  const filtered = useMemo(() => {
    let rows = parsed.filter((r: any) => r.review_status !== 'skipped');

    // Filter by review status if specified
    if (reviewStatusFilter) {
      rows = rows.filter((r) => r.review_status === reviewStatusFilter);
    } else {
      // Default: show tweets that need review (pending or have issues)
      rows = rows.filter((r) => r.needs_review || r.review_status === 'pending');
    }

    if (locFilter.trim()) {
      const q = locFilter.trim();
      rows = rows.filter((r) => r.where.some((w: string) => w.toLowerCase().includes(q.toLowerCase())));
    }
    if (tagFilter.trim()) {
      const tokens = tagFilter.split(/[#,\s]+/).map((t) => t.trim()).filter(Boolean);
      rows = rows.filter((r) => {
        const tags = [...r.which.hashtags, ...r.which.mentions];
        return tokens.some((q) =>
          tags.some((t) => t.toLowerCase().includes(q.toLowerCase())) ||
          r.how.toLowerCase().includes(q.toLowerCase()) ||
          r.what.some((w: string) => w.toLowerCase().includes(q.toLowerCase())) ||
          r.where.some((w: string) => w.toLowerCase().includes(q.toLowerCase()))
        );
      });
    }
    if (actionFilter.trim()) {
      const q = actionFilter.trim();
      rows = rows.filter((r) => r.what.some((w: string) => w.toLowerCase().includes(q.toLowerCase())));
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
  }, [parsed, locFilter, tagFilter, actionFilter, fromDate, toDate, reviewStatusFilter]);

  const truncate = (s: string, max: number) => {
    if (s.length <= max) return { display: s, title: s };
    return { display: s.slice(0, Math.max(0, max - 1)) + '…', title: s };
  };

  const totalCount = parsed.length;
  const shownCount = filtered.length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassSectionCard className="p-4">
          <h2 className="text-xl font-bold text-white mb-2">📊 रिव्यू स्टेटस</h2>
          <div className="text-sm text-secondary">
            {(() => {
              const stats = parsed.reduce((acc: any, r: any) => {
                const status = r.review_status || 'pending';
                acc[status] = (acc[status] || 0) + 1;
                return acc;
              }, {});
              return Object.entries(stats).map(([status, count]) => `${status}: ${count}`).join(', ');
            })()}
          </div>
        </GlassSectionCard>
        <GlassSectionCard className="p-4">
          <h2 className="text-xl font-bold text-white mb-2">📈 रिव्यू मीट्रिक्स</h2>
          <div className="text-sm text-secondary">
            कुल: {totalCount} | दिखा रहे: {shownCount}
          </div>
        </GlassSectionCard>
      </div>

      <GlassSectionCard className="p-4">
        <div className="mb-4 flex items-end gap-4 flex-wrap">
          <label className="text-sm font-medium text-white">
            रिव्यू स्टेटस
            <select
              className="ml-2 border border-white/20 rounded-lg focus:outline-none focus:border-[#8BF5E6] focus:ring-2 focus:ring-[#8BF5E6]/20 bg-white/5 backdrop-blur-sm text-white px-2 py-1"
              value={reviewStatusFilter}
              onChange={(e) => setReviewStatusFilter(e.target.value)}
            >
              <option value="">सभी (ज़रूरतमंद)</option>
              <option value="pending">लंबित</option>
              <option value="approved">मंजूर</option>
              <option value="rejected">अस्वीकृत</option>
              <option value="review">रिव्यू में</option>
            </select>
          </label>
          <label className="text-sm font-medium text-white">
            स्थान
            <input
              className="ml-2 border border-white/20 rounded-lg focus:outline-none focus:border-[#8BF5E6] focus:ring-2 focus:ring-[#8BF5E6]/20 bg-white/5 backdrop-blur-sm text-white px-2 py-1 w-32"
              placeholder="जैसे: रायगढ़"
              value={locFilter}
              onChange={(e) => setLocFilter(e.target.value)}
            />
          </label>
          <label className="text-sm font-medium text-white">
            टैग/मेंशन
            <input
              className="ml-2 border border-white/20 rounded-lg focus:outline-none focus:border-[#8BF5E6] focus:ring-2 focus:ring-[#8BF5E6]/20 bg-white/5 backdrop-blur-sm text-white px-2 py-1 w-40"
              placeholder="#समारोह, @PMOIndia"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
            />
          </label>
          <SoftButton
            onClick={() => {
              setLocFilter('');
              setTagFilter('');
              setFromDate('');
              setToDate('');
              setActionFilter('');
              setReviewStatusFilter('');
            }}
          >
            फ़िल्टर साफ़ करें
          </SoftButton>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-collapse table-fixed text-white">
            <thead className="text-white">
              <tr>
                <th className="text-left font-bold p-2 border-b border-white/20">दिनांक</th>
                <th className="text-left font-bold p-2 border-b border-l border-white/20">स्थिति</th>
                <th className="text-left font-bold p-2 border-b border-l border-white/20">स्थान</th>
                <th className="text-left font-bold p-2 border-b border-l border-white/20">कार्यक्रम</th>
                <th className="text-left font-bold p-2 border-b border-l border-white/20">टैग</th>
                <th className="text-left font-bold p-2 border-b border-l border-white/20">ट्वीट</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const baseRow = baseRows.find((r: any) => r.id === row.id);
                const isParsed = baseRow?.is_parsed !== false;
                return (
                  <tr key={row.id} className="hover:bg-white/5">
                    <td className="p-2 border-b border-white/10 whitespace-nowrap">{row.when}</td>
                    <td className="p-2 border-b border-l border-white/10">
                      {isParsed ? (
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                          row.review_status === 'approved' ? 'bg-green-500/20 text-green-300' :
                          row.review_status === 'rejected' ? 'bg-red-500/20 text-red-300' :
                          row.review_status === 'review' ? 'bg-yellow-500/20 text-yellow-300' :
                          'bg-blue-500/20 text-blue-300'
                        }`}>
                          {row.review_status === 'approved' ? '✅ मंजूर' :
                           row.review_status === 'rejected' ? '❌ अस्वीकृत' :
                           row.review_status === 'review' ? '🔄 रिव्यू' : '⏳ लंबित'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-gray-500/20 text-gray-300">
                          📝 अपार्स
                        </span>
                      )}
                    </td>
                    <td className="p-2 border-b border-l border-white/10">{row.where.join(', ') || '—'}</td>
                    <td className="p-2 border-b border-l border-white/10">
                      {row.what.length ? row.what.join(', ') : (isParsed ? '—' : 'अपार्स')}
                    </td>
                    <td className="p-2 border-b border-l border-white/10">
                      {(() => {
                        const tags = [...row.which.mentions, ...row.which.hashtags];
                        return tags.length ? tags.join(', ') : '—';
                      })()}
                    </td>
                    <td className="p-2 border-b border-l border-white/10 max-w-xs">
                      <div className="truncate" title={row.how}>
                        {row.how}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassSectionCard>
    </div>
  );
}
