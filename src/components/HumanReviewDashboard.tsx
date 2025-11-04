'use client';
import { parsePost, formatHindiDate } from '@/utils/parse';
// Feature flags - hardcoded for production
const isParseEnabled = () => true;
import { matchTagFlexible, matchTextFlexible } from '@/utils/tag-search';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Route } from 'next';
import Card from './Card';
import SoftButton from './SoftButton';
import Chip from './Chip';

type Post = { id: string | number; timestamp: string; content: string };

type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'corrected';

interface ParsedPost extends Post {
  when: string;
  where: string[];
  what: string[];
  which: { mentions: string[]; hashtags: string[] };
  how: string;
  enriched?: Array<{ tag: string; domain: 'tags' | 'locations'; canonical: string }>;
  confidence?: {
    theme: number;
    sentiment: number;
    location: number;
  };
  reviewStatus?: ReviewStatus;
}

export default function HumanReviewDashboard() {
  const [locFilter, setLocFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [corrections, setCorrections] = useState<Record<string, any>>({});
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<ReviewStatus | ''>('');
  const [showConfidence, setShowConfidence] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'reviewed'>('pending');
  const [reviewedPosts, setReviewedPosts] = useState<any[]>([]);
  const [isLoadingReviewed, setIsLoadingReviewed] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
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

  // Fetch processed posts
  useEffect(() => {
    const fetchPosts = async () => {
      setIsLoadingPosts(true);
      try {
        const response = await fetch('/api/processed-posts');
        const data = await response.json();
        if (data.success) {
          setPosts(data.data);
          console.log(`Loaded ${data.total} processed posts from ${data.source} source`);
        } else {
          console.error('Failed to load posts:', data.error);
        }
      } catch (error) {
        console.error('Error fetching posts:', error);
      } finally {
        setIsLoadingPosts(false);
      }
    };
    fetchPosts();
  }, []);

  // Fetch reviewed posts
  useEffect(() => {
    const fetchReviewedPosts = async () => {
      if (activeTab === 'reviewed') {
        setIsLoadingReviewed(true);
        try {
          const response = await fetch('/api/reviewed-posts');
          const data = await response.json();
          if (data.success) {
            setReviewedPosts(data.data);
          }
        } catch (error) {
          console.error('Error fetching reviewed posts:', error);
        } finally {
          setIsLoadingReviewed(false);
        }
      }
    };
    fetchReviewedPosts();
  }, [activeTab]);

  const parsed = useMemo(() => (posts as Post[]).map((p) => {
    if (isParseEnabled()) {
      const parsedData = parsePost(p);
      return {
        ...p,
        ...parsedData,
        // Add mock confidence scores and review status for demo
        confidence: {
          theme: Math.random() * 0.4 + 0.6, // 0.6-1.0
          sentiment: Math.random() * 0.3 + 0.7, // 0.7-1.0
          location: Math.random() * 0.5 + 0.5, // 0.5-1.0
        },
        reviewStatus: (Math.random() > 0.7 ? 'pending' : Math.random() > 0.3 ? 'approved' : 'corrected') as ReviewStatus,
      } as ParsedPost;
    }
    return {
      ...p,
      when: formatHindiDate(p.timestamp),
      where: [] as string[],
      what: [] as string[],
      which: { mentions: [] as string[], hashtags: [] as string[] },
      how: p.content,
      enriched: [] as Array<{ tag: string; domain: 'tags' | 'locations'; canonical: string }>,
      confidence: { theme: 0, sentiment: 0, location: 0 },
      reviewStatus: 'pending' as ReviewStatus,
    } as ParsedPost;
  }), [posts]);

  const truncate = (s: string, max: number) => {
    if (s.length <= max) return { display: s, title: s };
    return { display: s.slice(0, Math.max(0, max - 1)) + '…', title: s };
  };

  const filtered = useMemo(() => {
    let rows = parsed;
    if (locFilter.trim()) {
      const q = locFilter.trim();
      rows = rows.filter((r) => r.where.some((w) => matchTextFlexible(w, q)));
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
          r.where.some((w) => matchTextFlexible(w, q))
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
        const d = new Date(r.timestamp);
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

  const reviewStats = useMemo(() => {
    const stats = {
      total: filtered.length,
      pending: filtered.filter(p => p.reviewStatus === 'pending').length,
      approved: filtered.filter(p => p.reviewStatus === 'approved').length,
      corrected: filtered.filter(p => p.reviewStatus === 'corrected').length,
      rejected: filtered.filter(p => p.reviewStatus === 'rejected').length,
    };
    return stats;
  }, [filtered]);

  const handleBulkAction = async () => {
    if (!bulkAction || selectedPosts.size === 0) return;

    try {
      const response = await fetch('/api/bulk-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          posts: Array.from(selectedPosts).map(id => ({ id })),
          action: bulkAction,
          corrections: {}
        }),
      });

      if (response.ok) {
        // Remove processed posts from the current view
        setSelectedPosts(new Set());
        setBulkAction('');
        alert(`${selectedPosts.size} पोस्ट्स को ${bulkAction} मार्क किया गया और हटा दिया गया!`);
        
        // Dispatch custom event to refresh main dashboard
        window.dispatchEvent(new CustomEvent('correctionsUpdated'));
        
        // Refresh reviewed posts if we're on the reviewed tab
        if (activeTab === 'reviewed') {
          const reviewedResponse = await fetch('/api/reviewed-posts');
          const reviewedData = await reviewedResponse.json();
          if (reviewedData.success) {
            setReviewedPosts(reviewedData.data);
          }
        }
      } else {
        alert('बल्क एक्शन विफल रहा!');
      }
    } catch (error) {
      console.error('Error in bulk action:', error);
      alert('बल्क एक्शन में त्रुटि हुई!');
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'text-green-400';
    if (score >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStatusColor = (status: ReviewStatus) => {
    switch (status) {
      case 'approved': return 'bg-green-500/20 text-green-300 border-green-500/40';
      case 'rejected': return 'bg-red-500/20 text-red-300 border-red-500/40';
      case 'corrected': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      default: return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    }
  };

  return (
    <section className="p-4">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-teal-100 mb-4">मानव समीक्षा डैशबोर्ड</h2>

        {/* Review Status */}
        <ReviewStatus />

        {/* Review Statistics and Feedback */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card className="text-center">
                <div className="text-2xl font-bold text-teal-100">{reviewStats.total}</div>
                <div className="text-sm text-teal-300">कुल पोस्ट्स</div>
              </Card>
              <Card className="text-center">
                <div className="text-2xl font-bold text-yellow-400">{reviewStats.pending}</div>
                <div className="text-sm text-teal-300">लंबित</div>
              </Card>
              <Card className="text-center">
                <div className="text-2xl font-bold text-green-400">{reviewStats.approved}</div>
                <div className="text-sm text-teal-300">स्वीकृत</div>
              </Card>
              <Card className="text-center">
                <div className="text-2xl font-bold text-blue-400">{reviewStats.corrected}</div>
                <div className="text-sm text-teal-300">सुधारित</div>
              </Card>
              <Card className="text-center">
                <div className="text-2xl font-bold text-red-400">{reviewStats.rejected}</div>
                <div className="text-sm text-teal-300">अस्वीकृत</div>
              </Card>
            </div>
          </div>
          <div className="lg:col-span-1">
            <FeedbackSummary />
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-4 items-center mb-4">
          <SoftButton
            onClick={() => setEditMode(!editMode)}
            className={editMode ? 'bg-teal-600/40' : ''}
          >
            {editMode ? '✏️ संपादन मोड बंद' : '✏️ संपादन मोड चालू'}
          </SoftButton>

          <SoftButton
            onClick={() => setShowConfidence(!showConfidence)}
            className={showConfidence ? 'bg-teal-600/40' : ''}
          >
            {showConfidence ? '📊 विश्वास स्कोर छुपाएं' : '📊 विश्वास स्कोर दिखाएं'}
          </SoftButton>

          {editMode && selectedPosts.size > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value as ReviewStatus)}
                className="px-3 py-1 bg-teal-900/50 border border-teal-600/40 text-teal-100 rounded"
              >
                <option value="">बल्क एक्शन चुनें</option>
                <option value="approved">✅ स्वीकृत करें</option>
                <option value="rejected">❌ अस्वीकृत करें</option>
                <option value="pending">⏳ लंबित करें</option>
              </select>
              <SoftButton onClick={handleBulkAction} disabled={!bulkAction}>
                लागू करें ({selectedPosts.size})
              </SoftButton>
            </div>
          )}

          {editMode && Object.keys(corrections).length > 0 && (
            <SoftButton
              onClick={async () => {
                try {
                  for (const [postId, corr] of Object.entries(corrections)) {
                    await fetch('/api/feedback', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ post_id: postId, corrections: corr }),
                    });
                  }
                  setCorrections({});
                  alert('फीडबैक सबमिट किया गया और पोस्ट हटा दिए गए!');
                  
                  // Dispatch custom event to refresh main dashboard
                  window.dispatchEvent(new CustomEvent('correctionsUpdated'));
                  
                  // Refresh reviewed posts if we're on the reviewed tab
                  if (activeTab === 'reviewed') {
                    const reviewedResponse = await fetch('/api/reviewed-posts');
                    const reviewedData = await reviewedResponse.json();
                    if (reviewedData.success) {
                      setReviewedPosts(reviewedData.data);
                    }
                  }
                } catch (error) {
                  console.error('Error submitting feedback:', error);
                  alert('फीडबैक सबमिट करने में त्रुटि हुई!');
                }
              }}
              className="bg-green-600/20 hover:bg-green-600/30"
            >
              💾 सेव करें ({Object.keys(corrections).length})
            </SoftButton>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="flex space-x-1 bg-teal-900/20 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'pending'
                ? 'bg-teal-600/40 text-teal-100 shadow-sm'
                : 'text-teal-300 hover:text-teal-100 hover:bg-teal-600/20'
            }`}
          >
            लंबित पोस्ट ({reviewStats.pending})
          </button>
          <button
            onClick={() => setActiveTab('reviewed')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'reviewed'
                ? 'bg-teal-600/40 text-teal-100 shadow-sm'
                : 'text-teal-300 hover:text-teal-100 hover:bg-teal-600/20'
            }`}
          >
            समीक्षित पोस्ट ({reviewedPosts.length})
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex items-end gap-4 flex-wrap card-soft p-4">
        <label className="text-sm font-medium text-teal-100">
          स्थान फ़िल्टर
          <input
            aria-label="स्थान फ़िल्टर"
            className="ml-2 border border-teal-600/40 bg-transparent text-teal-50 placeholder-teal-300 px-2 py-1 rounded-md w-40"
            placeholder="जैसे: रायगढ़"
            value={locFilter}
            onChange={(e) => setLocFilter(e.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-teal-100">
          टैग/मेंशन फ़िल्टर
          <input
            aria-label="टैग/मेंशन फ़िल्टर"
            className="ml-2 border border-teal-600/40 bg-transparent text-teal-50 placeholder-teal-300 px-2 py-1 rounded-md w-48"
            placeholder="#समारोह, @PMOIndia"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-teal-100">
          तिथि से
          <input
            aria-label="तिथि से"
            type="date"
            className="ml-2 border border-teal-600/40 bg-transparent text-teal-50 placeholder-teal-300 px-2 py-1 rounded-md"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-teal-100">
          तिथि तक
          <input
            aria-label="तिथि तक"
            type="date"
            className="ml-2 border border-teal-600/40 bg-transparent text-teal-50 placeholder-teal-300 px-2 py-1 rounded-md"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </label>
        <SoftButton
          ariaLabel="फ़िल्टर साफ़ करें"
          onClick={() => {
            setLocFilter('');
            setTagFilter('');
            setFromDate('');
            setToDate('');
            setActionFilter('');
            router.push('/review' as Route);
          }}
        >
          फ़िल्टर साफ़ करें
        </SoftButton>
      </div>

      {/* Table */}
      <div className="overflow-x-auto card-soft p-2">
        {isLoadingPosts ? (
          <div className="text-center py-8">
            <div className="text-teal-300">प्रोसेस किए गए पोस्ट लोड हो रहे हैं...</div>
          </div>
        ) : activeTab === 'pending' ? (
          <>
            <table aria-label="मानव समीक्षा सारणी" className="min-w-full text-sm border-collapse table-fixed text-teal-50">
              <colgroup>
                <col className="w-[3%]" />
                <col className="w-[12%]" />
                <col className="w-[10%]" />
                <col className="w-[15%]" />
                <col className="w-[12%]" />
                <col className="w-[30%]" />
                <col className="w-[8%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead className="bg-transparent text-teal-100">
                <tr>
                  <th className="text-center font-semibold p-2 border-b">
                    <input
                      type="checkbox"
                      checked={selectedPosts.size === filtered.length && filtered.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPosts(new Set(filtered.map(p => String(p.id))));
                        } else {
                          setSelectedPosts(new Set());
                        }
                      }}
                      className="rounded border-teal-600/40 bg-transparent"
                    />
                  </th>
                  <th className="text-left font-semibold p-2 border-b">दिन / दिनांक</th>
                  <th className="text-left font-semibold p-2 border-b">स्थान</th>
                  <th className="text-left font-semibold p-2 border-b">दौरा / कार्यक्रम</th>
                  <th className="text-left font-semibold p-2 border-b w-[12%]">कौन/टैग</th>
                  <th className="text-left font-semibold p-2 border-b w-[30%]">विवरण</th>
                  {showConfidence && <th className="text-left font-semibold p-2 border-b">विश्वास</th>}
                  <th className="text-left font-semibold p-2 border-b">स्थिति</th>
                </tr>
              </thead>
              <tbody className="bg-transparent" data-testid="tbody">
                {filtered.map((row, index) => (
                  <tr key={row.id} className={`align-top hover:bg-white/5 ${selectedPosts.has(String(row.id)) ? 'bg-teal-600/10' : ''}`}>
                    <td className="p-2 border-b border-teal-800/40 text-center">
                      <input
                        type="checkbox"
                        checked={selectedPosts.has(String(row.id))}
                        onChange={(e) => {
                          const newSelected = new Set(selectedPosts);
                          if (e.target.checked) {
                            newSelected.add(String(row.id));
                          } else {
                            newSelected.delete(String(row.id));
                          }
                          setSelectedPosts(newSelected);
                        }}
                        className="rounded border-teal-600/40 bg-transparent"
                      />
                    </td>
                    <td className="p-2 border-b border-teal-800/40 whitespace-nowrap text-teal-50">
                      {editMode ? (
                        <input
                          type="text"
                          className="w-full border border-teal-600/40 bg-transparent text-teal-50 px-1 py-0.5 text-sm rounded"
                          value={corrections[row.id]?.when ?? row.when}
                          onChange={(e) => setCorrections(prev => ({
                            ...prev,
                            [row.id]: { ...prev[row.id], when: e.target.value }
                          }))}
                        />
                      ) : (
                        row.when
                      )}
                    </td>
                    <td className="p-2 border-b border-teal-800/40 text-teal-50">
                      {editMode ? (
                        <input
                          type="text"
                          className="w-full border border-teal-600/40 bg-transparent text-teal-50 px-1 py-0.5 text-sm rounded"
                          value={corrections[row.id]?.where ?? row.where.join(', ')}
                          onChange={(e) => setCorrections(prev => ({
                            ...prev,
                            [row.id]: { ...prev[row.id], where: e.target.value.split(',').map(s => s.trim()) }
                          }))}
                        />
                      ) : (
                        row.where.join(', ') || '—'
                      )}
                    </td>
                    <td className="p-2 border-b border-teal-800/40 text-teal-50">
                      {editMode ? (
                        <input
                          type="text"
                          className="w-full border border-teal-600/40 bg-transparent text-teal-50 px-1 py-0.5 text-sm rounded"
                          value={corrections[row.id]?.what ?? row.what.join(', ')}
                          onChange={(e) => setCorrections(prev => ({
                            ...prev,
                            [row.id]: { ...prev[row.id], what: e.target.value.split(',').map(s => s.trim()) }
                          }))}
                        />
                      ) : (
                        row.what.join(', ') || '—'
                      )}
                    </td>
                    <td className="p-2 border-b border-teal-800/40 align-top w-[12%]" aria-label="कौन/टैग">
                      {editMode ? (
                        <input
                          type="text"
                          className="w-full border border-teal-600/40 bg-transparent text-teal-50 px-1 py-0.5 text-sm rounded"
                          value={corrections[row.id]?.which ?? [...row.which.mentions, ...row.which.hashtags].join(' ')}
                          onChange={(e) => setCorrections(prev => ({
                            ...prev,
                            [row.id]: { ...prev[row.id], which: e.target.value }
                          }))}
                        />
                      ) : (
                        (() => {
                          const tags = [...row.which.mentions, ...row.which.hashtags];
                          if (!tags.length) return '—';
                          return (
                            <div className="flex gap-2 flex-wrap max-w-[12rem]">
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
                        })()
                      )}
                    </td>
                    <td
                      className="p-2 border-b border-teal-800/40 align-top whitespace-pre-wrap break-words w-[30%] text-teal-50"
                      aria-label="विवरण"
                      title={row.how}
                    >
                      {editMode ? (
                        <textarea
                          className="w-full border border-teal-600/40 bg-transparent text-teal-50 px-1 py-0.5 text-sm rounded min-h-[60px]"
                          value={corrections[row.id]?.how ?? row.how}
                          onChange={(e) => setCorrections(prev => ({
                            ...prev,
                            [row.id]: { ...prev[row.id], how: e.target.value }
                          }))}
                        />
                      ) : (
                        (() => {
                          const content = corrections[row.id]?.how ?? row.how;
                          const t = truncate(content, 100);
                          return <span title={t.title}>{t.display}</span>;
                        })()
                      )}
                    </td>
                    {showConfidence && (
                      <td className="p-2 border-b border-teal-800/40 text-xs">
                        <div className="space-y-1">
                          <div className={getConfidenceColor(row.confidence?.theme || 0)}>
                            थीम: {((row.confidence?.theme || 0) * 100).toFixed(0)}%
                          </div>
                          <div className={getConfidenceColor(row.confidence?.sentiment || 0)}>
                            भाव: {((row.confidence?.sentiment || 0) * 100).toFixed(0)}%
                          </div>
                          <div className={getConfidenceColor(row.confidence?.location || 0)}>
                            स्थान: {((row.confidence?.location || 0) * 100).toFixed(0)}%
                          </div>
                        </div>
                      </td>
                    )}
                    <td className="p-2 border-b border-teal-800/40">
                      <span className={`px-2 py-1 rounded-full text-xs border ${getStatusColor(row.reviewStatus || 'pending')}`}>
                        {row.reviewStatus === 'approved' && '✅ स्वीकृत'}
                        {row.reviewStatus === 'rejected' && '❌ अस्वीकृत'}
                        {row.reviewStatus === 'corrected' && '🔧 सुधारित'}
                        {row.reviewStatus === 'pending' && '⏳ लंबित'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <>
            {isLoadingReviewed ? (
              <div className="text-center py-8">
                <div className="text-teal-300">समीक्षित पोस्ट लोड हो रहे हैं...</div>
              </div>
            ) : reviewedPosts.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-teal-300">कोई समीक्षित पोस्ट नहीं मिली</div>
              </div>
            ) : (
              <table aria-label="समीक्षित पोस्ट सारणी" className="min-w-full text-sm border-collapse table-fixed text-teal-50">
                <colgroup>
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                  <col className="w-[15%]" />
                  <col className="w-[12%]" />
                  <col className="w-[30%]" />
                  <col className="w-[8%]" />
                  <col className="w-[13%]" />
                </colgroup>
                <thead className="bg-transparent text-teal-100">
                  <tr>
                    <th className="text-left font-semibold p-2 border-b">दिन / दिनांक</th>
                    <th className="text-left font-semibold p-2 border-b">स्थान</th>
                    <th className="text-left font-semibold p-2 border-b">दौरा / कार्यक्रम</th>
                    <th className="text-left font-semibold p-2 border-b w-[12%]">कौन/टैग</th>
                    <th className="text-left font-semibold p-2 border-b w-[30%]">विवरण</th>
                    <th className="text-left font-semibold p-2 border-b">स्थिति</th>
                    <th className="text-left font-semibold p-2 border-b">समीक्षा तिथि</th>
                  </tr>
                </thead>
                <tbody className="bg-transparent">
                  {reviewedPosts.map((post: any, index: number) => (
                    <tr key={post.id || index} className="align-top hover:bg-white/5">
                      <td className="p-2 border-b border-teal-800/40 whitespace-nowrap text-teal-50">
                        {post.when || '—'}
                      </td>
                      <td className="p-2 border-b border-teal-800/40 text-teal-50">
                        {post.where?.join(', ') || '—'}
                      </td>
                      <td className="p-2 border-b border-teal-800/40 text-teal-50">
                        {post.what?.join(', ') || '—'}
                      </td>
                      <td className="p-2 border-b border-teal-800/40 align-top w-[12%]" aria-label="कौन/टैग">
                        {(() => {
                          const tags = [...(post.which?.mentions || []), ...(post.which?.hashtags || [])];
                          if (!tags.length) return '—';
                          return (
                            <div className="flex gap-2 flex-wrap max-w-[12rem]">
                              {tags.map((t: string, i: number) => (
                                <Chip
                                  key={`${t}-${i}`}
                                  label={t}
                                  selected={false}
                                  onClick={() => {}}
                                />
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                      <td
                        className="p-2 border-b border-teal-800/40 align-top whitespace-pre-wrap break-words w-[30%] text-teal-50"
                        aria-label="विवरण"
                        title={post.how}
                      >
                        {(() => {
                          const content = post.how || '';
                          const t = truncate(content, 100);
                          return <span title={t.title}>{t.display}</span>;
                        })()}
                      </td>
                      <td className="p-2 border-b border-teal-800/40">
                        <span className={`px-2 py-1 rounded-full text-xs border ${getStatusColor(post.feedback?.corrections?.reviewStatus || 'pending')}`}>
                          {post.feedback?.corrections?.reviewStatus === 'approved' && '✅ स्वीकृत'}
                          {post.feedback?.corrections?.reviewStatus === 'rejected' && '❌ अस्वीकृत'}
                          {post.feedback?.corrections?.reviewStatus === 'corrected' && '🔧 सुधारित'}
                          {(!post.feedback?.corrections?.reviewStatus || post.feedback?.corrections?.reviewStatus === 'pending') && '⏳ लंबित'}
                        </span>
                      </td>
                      <td className="p-2 border-b border-teal-800/40 text-xs text-teal-300">
                        {post.reviewed_at ? new Date(post.reviewed_at).toLocaleDateString('hi-IN') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </section>
  );
}
