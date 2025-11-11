/**
 * Analytics Dashboard Component - Hindi Layout Specification
 *
 * Implements the exact 9-module layout specified:
 * A-I: इवेंट विश्लेषण through रायगढ़ विधानसभा अनुभाग
 * Hindi-only UI with proper accessibility
 * Export functionality for PDF/Excel/CSV
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { formatHindiDate } from '@/utils/parse';
import FaissSearchCard from './FaissSearchCard';
import AIAssistantCard from './AIAssistantCard';
import DynamicLearningCard from './DynamicLearningCard';
import MapboxCard from './MapboxCard';
import D3MindmapCard from './D3MindmapCard';

interface AnalyticsData {
  total_tweets: number;
  event_distribution: Record<string, number>;
  location_distribution: Record<string, number>;
  scheme_usage: Record<string, number>;
  timeline: { date: string; count: number }[];
  day_of_week: Record<string, number>;
  caste_community: Record<string, number>;
  target_groups: Record<string, number>;
  thematic_analysis: Record<string, number>;
  raigarh_section: {
    coverage_percentage: number;
    local_events: {
      date: string;
      location: string;
      type: string;
      description: string;
    }[];
    community_data: Record<string, number>;
    engagement_metrics: {
      total_likes: number;
      total_retweets: number;
      total_replies: number;
    };
  };
}

interface FilterState {
  location: string;
  subject: string;
  startDate: string;
  endDate: string;
}

export default function AnalyticsDashboard() {
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    location: 'रायगढ़ / छत्तीसगढ़',
    subject: 'योजना / रोजगार / आदि',
    startDate: '',
    endDate: ''
  });

  // Analytics is now public - no authentication required

  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.startDate) params.append('start_date', filters.startDate);
      if (filters.endDate) params.append('end_date', filters.endDate);
      if (filters.location && filters.location !== 'रायगढ़ / छत्तीसगढ़') {
        params.append('location', filters.location);
      }

      const response = await fetch(`/api/analytics?${params}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError('एनालिटिक्स डेटा लोड करने में त्रुटि');
      }
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError('नेटवर्क त्रुटि');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  const handleFilterChange = useCallback((newFilters: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      location: 'रायगढ़ / छत्तीसगढ़',
      subject: 'योजना / रोजगार / आदि',
      startDate: '',
      endDate: ''
    });
  }, []);

  const handleExport = useCallback(async (format: 'pdf' | 'excel' | 'csv') => {
    try {
      const params = new URLSearchParams({ format });
      if (filters.startDate) params.append('start_date', filters.startDate);
      if (filters.endDate) params.append('end_date', filters.endDate);

      const response = await fetch(`/api/analytics/export?${params}`);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-report.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        setError(`${format.toUpperCase()} निर्यात विफल`);
      }
    } catch (err) {
      console.error('Export error:', err);
      setError('निर्यात में त्रुटि');
    }
  }, [filters]);

  const raigarhSection =
    data?.raigarh_section ?? {
      coverage_percentage: 0,
      local_events: [],
      community_data: {},
      engagement_metrics: { total_likes: 0, total_retweets: 0, total_replies: 0 },
    };

  const timelinePreview = useMemo(() => {
    if (!data?.timeline?.length) return [];
    return [...data.timeline].sort((a, b) => a.date.localeCompare(b.date)).slice(-10);
  }, [data?.timeline]);

  const dayOfWeekEntries = useMemo(
    () => Object.entries(data?.day_of_week || {}).sort(([, a], [, b]) => Number(b) - Number(a)),
    [data?.day_of_week],
  );

  const topEvent = useMemo(() => {
    const entries = Object.entries(data?.event_distribution || {}).sort(([, a], [, b]) => Number(b) - Number(a));
    return entries[0];
  }, [data?.event_distribution]);

  const locationEntries = useMemo(
    () => Object.entries(data?.location_distribution || {}).sort(([, a], [, b]) => Number(b) - Number(a)),
    [data?.location_distribution],
  );

  const topLocations = useMemo(() => locationEntries.slice(0, 4), [locationEntries]);

  const topSchemes = useMemo(() => {
    const entries = Object.entries(data?.scheme_usage || {}).sort(([, a], [, b]) => Number(b) - Number(a));
    return entries.slice(0, 6);
  }, [data?.scheme_usage]);

  const casteEntries = useMemo(() => {
    const entries = Object.entries(data?.caste_community || {}).sort(([, a], [, b]) => Number(b) - Number(a));
    return entries.slice(0, 10);
  }, [data?.caste_community]);

  const targetEntries = useMemo(
    () => Object.entries(data?.target_groups || {}).sort(([, a], [, b]) => Number(b) - Number(a)),
    [data?.target_groups],
  );

  const raigarhVisitCount = raigarhSection.local_events.length;
  const themeEntries = useMemo(
    () => Object.entries(data?.thematic_analysis || {}).sort(([, a], [, b]) => Number(b) - Number(a)),
    [data?.thematic_analysis],
  );

  const totalCommunityMentions = useMemo(
    () => Object.values(data?.caste_community || {}).reduce((sum, value) => sum + Number(value || 0), 0),
    [data?.caste_community],
  );

  const totalSchemeMentions = useMemo(
    () => Object.values(data?.scheme_usage || {}).reduce((sum, value) => sum + Number(value || 0), 0),
    [data?.scheme_usage],
  );

  const totalEngagement =
    raigarhSection.engagement_metrics.total_likes +
    raigarhSection.engagement_metrics.total_retweets +
    raigarhSection.engagement_metrics.total_replies;

  const raigarhDateRange = useMemo(() => {
    if (!raigarhSection.local_events.length) return null;
    const sorted = raigarhSection.local_events
      .map((event) => event.date)
      .filter(Boolean)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    if (!sorted.length) return null;
    return { start: sorted[0], end: sorted[sorted.length - 1] };
  }, [raigarhSection.local_events]);

  const DEVELOPMENT_KEYS = useMemo(
    () => ['विकास', 'विकास कार्य', 'development', 'development_work', 'उद्घाटन', 'लोकार्पण', 'inauguration', 'inspection', 'निरीक्षण'],
    [],
  );

  const developmentEventStats = useMemo(() => {
    const entries = Object.entries(data?.event_distribution || {});
    return entries
      .filter(([event]) => DEVELOPMENT_KEYS.some((key) => event.toLowerCase().includes(key.toLowerCase())))
      .sort(([, a], [, b]) => Number(b) - Number(a));
  }, [DEVELOPMENT_KEYS, data?.event_distribution]);

  const fallbackDevelopment = developmentEventStats.length
    ? developmentEventStats
    : Object.entries(data?.event_distribution || {}).slice(0, 5);

  const locationChartData = useMemo(
    () => locationEntries.slice(0, 8).map(([name, value]) => ({ name, value })),
    [locationEntries],
  );

  const coveragePieData = useMemo(() => {
    const covered = raigarhSection.coverage_percentage || 0;
    return [
      { name: 'कवर्ड', value: covered || 0 },
      { name: 'शेष', value: Math.max(0, 100 - covered) },
    ];
  }, [raigarhSection.coverage_percentage]);

  const developmentChartData = useMemo(
    () => fallbackDevelopment.map(([name, value]) => ({ name, value })),
    [fallbackDevelopment],
  );

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-blue-600 mx-auto mb-6"></div>
        <p className="text-xl font-semibold text-white">एनालिटिक्स डेटा लोड हो रहा है...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-300 mb-4">
          <p className="text-lg font-semibold">⚠️ त्रुटि</p>
          <p className="text-base">{error}</p>
        </div>
        <button
          onClick={fetchAnalyticsData}
          className="neon-button px-6 py-3 text-base font-semibold rounded-lg"
          tabIndex={0}
        >
          पुनः प्रयास करें
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <div className="text-muted">
          <p className="text-lg">📊 कोई डेटा नहीं मिला</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Filter Section - Glassmorphic Purple */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="glassmorphic-card rounded-2xl p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8 lg:mb-10 transition-all duration-500 ease-in-out"
      >
        <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 flex items-center gap-2 text-white drop-shadow-[0_0_6px_#12005E] transition-all duration-500 ease-in-out">
          <span className="text-xl sm:text-2xl">🔍</span> फ़िल्टर सेक्शन
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 transition-all duration-500 ease-in-out">
          <div>
            <label className="block text-sm sm:text-base font-semibold text-white mb-2 drop-shadow-[0_0_6px_#12005E]">
              स्थान ▸
            </label>
            <input
              type="text"
              value={filters.location}
              onChange={(e) => handleFilterChange({ location: e.target.value })}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-white/20 rounded-lg focus:outline-none focus:border-[#8BF5E6] focus:ring-2 focus:ring-[#8BF5E6]/20 placeholder:text-white/60 bg-white/5 backdrop-blur-sm text-white transition-all duration-500 ease-in-out"
              placeholder="रायगढ़ / छत्तीसगढ़"
            />
          </div>

          <div>
            <label className="block text-sm sm:text-base font-semibold text-white mb-2 drop-shadow-[0_0_6px_#12005E]">
              विषय ▸
            </label>
            <input
              type="text"
              value={filters.subject}
              onChange={(e) => handleFilterChange({ subject: e.target.value })}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-white/20 rounded-lg focus:outline-none focus:border-[#8BF5E6] focus:ring-2 focus:ring-[#8BF5E6]/20 placeholder:text-white/60 bg-white/5 backdrop-blur-sm text-white transition-all duration-500 ease-in-out"
              placeholder="योजना / रोजगार / आदि"
            />
          </div>

          <div>
            <label className="block text-sm sm:text-base font-semibold text-white mb-2 drop-shadow-[0_0_6px_#12005E]">
              दिनांक से ▸
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange({ startDate: e.target.value })}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-white/20 rounded-lg focus:outline-none focus:border-[#6ef0d8] focus:ring-2 focus:ring-[#6ef0d8]/30 bg-white/5 backdrop-blur-sm text-white transition-all duration-500 ease-in-out"
            />
          </div>

          <div>
            <label className="block text-sm sm:text-base font-semibold text-white mb-2 drop-shadow-[0_0_6px_#12005E]">
              तक ▸
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange({ endDate: e.target.value })}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-white/20 rounded-lg focus:outline-none focus:border-[#6ef0d8] focus:ring-2 focus:ring-[#6ef0d8]/30 bg-white/5 backdrop-blur-sm text-white transition-all duration-500 ease-in-out"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={clearFilters}
            className="neon-button px-6 py-3 text-base font-semibold rounded-lg"
          >
            फ़िल्टर साफ करें
          </button>
        </div>
      </motion.div>

      {/* Analytics Content */}
      <div className="space-y-10">
        {/* A. इवेंट प्रकार विश्लेषण - Donut Chart */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="glassmorphic-card rounded-lg p-8 mb-10"
        >
          <h2 className="text-2xl font-bold mb-3 text-white">🧩 A. इवेंट प्रकार विश्लेषण (Event Type Analysis)</h2>
          <p className="text-base text-white/90 mb-6 font-medium">
            बैठक / समीक्षा / दौरा / लोकार्पण / शोक आदि
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Donut Chart */}
            <div className="flex flex-col items-center justify-center">
              <h4 className="text-lg font-semibold mb-4 text-white">
                <span role="img" aria-label="Event Distribution">📊</span> इवेंट वितरण
              </h4>
              {Object.keys(data.event_distribution).length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={Object.entries(data.event_distribution).map(([name, value]) => ({ name, value }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={120}
                      paddingAngle={2}
                      dataKey="value"
                      label={(entry: any) => {
                        const name = entry.name || '';
                        const percent = entry.percent || 0;
                        return `${name} – ${(percent * 100).toFixed(0)}%`;
                      }}
                      labelLine={false}
                    >
                      {Object.entries(data.event_distribution).map((entry, index) => {
                        const colors = ['#8B5CF6', '#3B82F6', '#8BF5E6', '#F59E0B', '#EF4444', '#EC4899', '#6366F1', '#14B8A6'];
                        return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                      })}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [value, 'कुल']}
                      labelFormatter={(label) => `इवेंट: ${label}`}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-white/70">
                  कोई डेटा उपलब्ध नहीं
                </div>
              )}
            </div>

            {/* Event List with Totals */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold mb-4 text-white">
                <span role="img" aria-label="Event List">📋</span> इवेंट सूची
              </h4>
              <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                {Object.entries(data.event_distribution)
                  .sort(([, a], [, b]) => b - a)
                  .map(([event, count]) => (
                    <div key={event} className="flex justify-between items-center p-3 bg-white/5 backdrop-blur-sm rounded-lg border border-white/20">
                      <span className="text-base text-white">{event}</span>
                      <span className="text-base font-bold text-mint-green bg-white/10 px-3 py-1 rounded">
                        {count}
                      </span>
                    </div>
                  ))}
              </div>

              <div className="mt-4 p-4 bg-white/5 backdrop-blur-sm rounded-lg border border-white/20">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-white">कुल इवेंट:</span>
                  <span className="text-2xl font-bold text-mint-green">
                    {Object.values(data.event_distribution).reduce((sum, val) => sum + val, 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* B. भू-मानचित्रण और माइंडमैप */}
        <div className="glassmorphic-card rounded-lg p-8 mb-10">
          <h2 className="text-2xl font-bold mb-3 text-white">🗺️ B. भू-मानचित्रण और माइंडमैप (Geo-Mapping & Mindmap)</h2>
          <p className="text-base text-white/90 mb-6 font-medium">
            छत्तीसगढ़ → जिला → ब्लॉक → ग्राम पंचायत / वार्ड
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <MapboxCard />
             <D3MindmapCard />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Geographic Hierarchy */}
            <div>
              <h4 className="text-lg font-semibold mb-4 text-white">
                <span role="img" aria-label="Geographic Hierarchy">🌍</span> भौगोलिक पदानुक्रम
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-mint-green text-lg">📍</span>
                  <span className="text-white"><strong>छत्तीसगढ़</strong> ({Object.keys(data.location_distribution).length} जिलों में उपस्थिति)</span>
                </div>
                <div className="h-60 bg-white/5 backdrop-blur-sm rounded-lg p-3 border border-white/10">
                  {locationChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={locationChartData}
                        layout="vertical"
                        margin={{ top: 8, right: 16, bottom: 8, left: 40 }}
                      >
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={110} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#8BF5E6" radius={[0, 6, 6, 0]}>
                          {locationChartData.map((entry, index) => (
                            <Cell key={entry.name} fill={index % 2 === 0 ? '#8BF5E6' : '#b8fff5'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-base text-white/70">
                      स्थान डेटा उपलब्ध नहीं
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Coverage Statistics */}
            <div>
              <h4 className="text-lg font-semibold mb-4 text-white">
                <span role="img" aria-label="Coverage Statistics">📊</span> कवरेज आँकड़े
              </h4>
              <div className="space-y-4">
                <div className="text-center p-6 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
                  <div className="text-4xl font-bold text-mint-green mb-2">
                    {locationEntries.length}
                  </div>
                  <div className="text-base font-semibold text-white">कुल जिलों में उपस्थिति</div>
                </div>

                <div className="text-center p-6 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
                  <div className="text-4xl font-bold text-mint-green mb-2">
                    {data.raigarh_section.coverage_percentage}%
                  </div>
                  <div className="text-base font-semibold text-white">रायगढ़ जिला कवरेज</div>
                </div>

                <div className="text-center p-6 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
                  <div className="text-4xl font-bold text-mint-green mb-2">
                    {raigarhVisitCount}
                  </div>
                  <div className="text-base font-semibold text-white">ग्राम दौरों की संख्या</div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Districts */}
          <div className="mt-6">
            <h4 className="text-lg font-semibold mb-4 text-white">🏆 शीर्ष जिलों में उपस्थिति</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(data.location_distribution)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 8)
                .map(([district, mentions]) => (
                  <div key={district} className="text-center p-4 bg-white/5 backdrop-blur-sm rounded-lg border border-white/20">
                    <div className="text-xl font-bold text-mint-green">{mentions}</div>
                    <div className="text-sm text-white/90">{district}</div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* C. टूर कवरेज विश्लेषण */}
        <div className="glassmorphic-card rounded-lg p-8 mb-10">
          <h2 className="text-2xl font-bold mb-3 text-white">🧭 C. टूर कवरेज विश्लेषण (Tour Coverage Analysis)</h2>
          <p className="text-base text-white/90 mb-6 font-medium">
            कुल जिलों / ग्रामों का कवरेज %
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="text-center p-6 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
                <div className="text-5xl font-bold text-mint-green mb-3">
                  {data.raigarh_section.coverage_percentage}%
                </div>
                <p className="text-lg font-semibold text-white">रायगढ़ जिला कवरेज</p>
              </div>

              <div className="text-center p-6 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
                <div className="text-5xl font-bold text-mint-green mb-3">
                  {locationEntries.length}
                </div>
                <p className="text-lg font-semibold text-white">कुल जिलों में उपस्थिति</p>
              </div>

              <div className="text-center p-6 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
                <div className="text-5xl font-bold text-mint-green mb-3">
                  {raigarhVisitCount}
                </div>
                <p className="text-lg font-semibold text-white">ग्राम दौरों की संख्या</p>
              </div>

              <div
                className="h-32 bg-white/5 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/10"
                aria-label="हीटमैप और टाइमलाइन स्लाइडर - दौरा कवरेज का विज़ुअल एनालिसिस"
              >
                <p className="text-base text-white/90">ग्राम दौरा हीटमैप</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-lg font-semibold text-white">📍 शीर्ष दौरा किए गए स्थान:</h4>
              {Object.entries(data.location_distribution)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 8)
                .map(([location, count]) => (
                  <div key={location} className="flex justify-between items-center p-3 bg-white/5 backdrop-blur-sm rounded-lg border border-white/20">
                    <span className="text-base text-white">{location}</span>
                    <span className="text-base font-bold text-mint-green px-3 py-1 rounded">
                      {count} दौरा
                    </span>
                  </div>
                ))}

              <div className="mt-4 p-4 bg-white/5 backdrop-blur-sm rounded-lg border border-white/20">
                <h5 className="font-semibold text-base mb-3 text-white">🎯 दौरा प्रभाव:</h5>
                <div className="text-sm text-white/90 space-y-2">
                  <div>
                    • औसत प्रतिदौरा:{' '}
                    {raigarhVisitCount ? Math.round(totalEngagement / raigarhVisitCount).toLocaleString() : 'अभी उपलब्ध नहीं'} engagements
                  </div>
                  <div>• कुल ग्राम कवरेज: {data.raigarh_section.coverage_percentage}% रायगढ़ जिला</div>
                  <div>
                    • सक्रिय दौरा अवधि:{' '}
                    {raigarhDateRange
                      ? `${formatHindiDate(raigarhDateRange.start)} – ${formatHindiDate(raigarhDateRange.end)}`
                      : 'डेटा संग्रह जारी'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* D. विकास कार्य और लोकार्पण विश्लेषण */}
        <div className="glassmorphic-card rounded-lg p-8 mb-10">
          <h2 className="text-2xl font-bold mb-3 text-white">🏗️ D. विकास कार्य और लोकार्पण विश्लेषण</h2>
          <p className="text-base text-white/90 mb-6 font-medium">
            कार्य प्रकार / स्थान / योजना नाम
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64">
              {developmentChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={developmentChartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-10} textAnchor="end" height={60} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8BF5E6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-base text-white/70">
                  विकास डेटा उपलब्ध नहीं
                </div>
              )}
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4 text-white">📍 फोकस जिले</h4>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {locationEntries.length === 0 && <p className="text-base text-white/90">स्थान डेटा उपलब्ध नहीं</p>}
                {locationEntries.slice(0, 10).map(([district, count]) => (
                  <div key={district} className="flex justify-between items-center p-3 bg-white/5 backdrop-blur-sm rounded-lg border border-white/20">
                    <span className="text-base font-medium text-white">{district}</span>
                    <span className="text-base font-bold text-mint-green bg-white/10 px-3 py-1 rounded">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* E. समाज आधारित पहुँच */}
        <div className="glassmorphic-card rounded-lg p-8 mb-10">
          <h2 className="text-2xl font-bold mb-3 text-white">🫱 E. समाज आधारित पहुँच (Caste Equation / Community Outreach)</h2>
          <p className="text-base text-white/90 mb-6 font-medium">
            साहू / तेली / मुस्लिम / यादव / अन्य समाज
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Society Statistics */}
            <div>
              <h4 className="text-lg font-semibold mb-4 text-white">📊 समाजवार विश्लेषण</h4>
              <div className="space-y-4">
                <div className="text-center p-6 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
                  <div className="text-4xl font-bold text-mint-green mb-2">
                    {Object.keys(data.caste_community || {}).length}
                  </div>
                  <div className="text-base font-semibold text-white">अनोखे समाज पहचाने गए</div>
                </div>

                <div className="text-center p-6 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
                  <div className="text-4xl font-bold text-mint-green mb-2">
                    {totalCommunityMentions.toLocaleString()}
                  </div>
                  <div className="text-base font-semibold text-white">समाज संदर्भ उल्लेख</div>
                </div>

                <div className="text-center p-6 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
                  <div className="text-4xl font-bold text-mint-green mb-2">
                    {themeEntries.length}
                  </div>
                  <div className="text-base font-semibold text-white">अनोखे विषय/कार्यक्रम</div>
                </div>
              </div>
            </div>

            {/* Top Societies */}
            <div>
              <h4 className="text-lg font-semibold mb-4 text-white">🏆 शीर्ष समाज उल्लेख</h4>
              <div className="space-y-3">
                {casteEntries.length === 0 && <p className="text-base text-white/90">समाज डेटा उपलब्ध नहीं</p>}
                {casteEntries.map(([society, count]) => (
                  <div key={society} className="flex justify-between items-center p-3 bg-white/5 backdrop-blur-sm rounded-lg border border-white/20">
                    <span className="text-base font-medium text-white">{society}</span>
                    <span className="text-base font-bold bg-white/10 text-mint-green px-3 py-1 rounded">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Keywords */}
          <div className="mt-8">
            <h4 className="text-lg font-semibold mb-4 text-white">🔍 शीर्ष समाज संदर्भ कीवर्ड</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {themeEntries.length === 0 && <p className="text-base text-white/90 col-span-full">कीवर्ड उपलब्ध नहीं</p>}
              {themeEntries.slice(0, 12).map(([keyword, count]) => (
                <div key={keyword} className="text-center p-4 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
                  <div className="text-2xl font-bold text-mint-green mb-1">{count}</div>
                  <div className="text-sm font-medium text-white">{keyword}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <p className="text-base text-white/90 font-medium">
              समुदायवार कार्यक्रम संख्या और स्थान: {Object.keys(data.caste_community || {}).length} समाजों में {themeEntries.length} विभिन्न प्रकार के कार्यक्रम पहचाने गए
            </p>
          </div>
        </div>

        {/* F. योजनाएँ / स्कीम विश्लेषण */}
        <div className="glassmorphic-card rounded-lg p-8 mb-10">
          <h2 className="text-2xl font-bold mb-3 text-white">🪔 F. योजनाएँ / स्कीम विश्लेषण (Scheme / Yojana)</h2>
          <p className="text-base text-white/90 mb-6 font-medium">
            पीएमएवाई / जल जीवन मिशन / युवा स्वरोजगार आदि
          </p>

          <div className="space-y-4">
            {topSchemes.length === 0 && <p className="text-base text-white/90">योजना डेटा उपलब्ध नहीं</p>}
            {topSchemes.map(([scheme, count]) => (
              <div key={scheme} className="flex justify-between items-center p-4 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
                <span className="text-base font-semibold text-white">{scheme}</span>
                <span className="text-base font-bold bg-white/10 text-mint-green px-4 py-2 rounded">
                  {count} उल्लेख
                </span>
              </div>
            ))}
            {totalSchemeMentions > 0 && (
              <p className="text-base text-white/90 font-semibold text-right">
                कुल {totalSchemeMentions.toLocaleString()} योजना संदर्भ
              </p>
            )}
          </div>
        </div>

        {/* G. वर्ग-आधारित विश्लेषण */}
        <div className="glassmorphic-card rounded-lg p-8 mb-10">
          <h2 className="text-2xl font-bold mb-3 text-white">🧠 G. वर्ग-आधारित विश्लेषण (Varg-wise)</h2>
          <p className="text-base text-white/90 mb-6 font-medium">
            महिला / युवा / किसान / वरिष्ठ नागरिक
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {targetEntries.length === 0 && <p className="text-base text-white/90 col-span-full">डेटा उपलब्ध नहीं</p>}
            {targetEntries.map(([group, count]) => (
              <div key={group} className="text-center p-6 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
                <div className="text-4xl font-bold text-mint-green mb-2">{count}</div>
                <div className="text-base font-semibold text-white">{group}</div>
              </div>
            ))}
          </div>

          <div 
            className="mt-4 h-32 bg-white/5 backdrop-blur-sm rounded-lg flex items-center justify-center"
            aria-label="वर्ग विश्लेषण चार्ट - महिला, युवा, किसान आदि वर्गों के इवेंट प्रकारों का विश्लेषण"
          >
            <p className="text-base text-white/90">चार्ट: वर्ग बनाम इवेंट प्रकार</p>
          </div>
        </div>

        {/* H. विषयगत विश्लेषण */}
        <div className="glassmorphic-card rounded-lg p-8 mb-10">
          <h2 className="text-2xl font-bold mb-3 text-white">📊 H. विषयगत विश्लेषण (Subject / Thematic Analysis)</h2>
          <p className="text-base text-white/90 mb-6 font-medium">
            रोज़गार / शिक्षा / स्वास्थ्य / आधारभूत संरचना
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              {themeEntries.length === 0 && <p className="text-base text-white/90">विषयगत डेटा उपलब्ध नहीं</p>}
              {themeEntries.map(([theme, count]) => (
                <div key={theme} className="flex justify-between items-center p-3 bg-white/5 backdrop-blur-sm rounded-lg border border-white/20">
                  <span className="text-base font-medium text-white">{theme}</span>
                  <span className="text-base font-bold bg-white/10 text-mint-green px-4 py-1 rounded">
                    {count}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-6">
              <div 
                className="h-32 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-gray-300"
                aria-label="वर्डक्लाउड - विषयगत विश्लेषण के लिए प्रमुख शब्द दिखाता है"
              >
                <p className="text-base font-semibold text-white">
                  शीर्ष विषय: {themeEntries.slice(0, 5).map(([theme]) => theme).join(', ') || '—'}
                </p>
              </div>
              <div 
                className="h-32 bg-white/5 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/10"
                aria-label="सहसंबंध ग्राफ - विषयों के बीच संबंध दिखाता है"
              >
                <p className="text-base font-semibold text-white">अगले संस्करण में सहसंबंध ग्राफ उपलब्ध होगा</p>
              </div>
            </div>
          </div>
        </div>

        {/* I. रायगढ़ विधानसभा अनुभाग */}
        <div className="glassmorphic-card rounded-lg p-8 mb-10">
          <h2 className="text-2xl font-bold mb-3 text-white">🏛️ I. रायगढ़ विधानसभा अनुभाग (Dedicated Raigarh Section)</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Micro-map */}
            <div>
              <h4 className="text-lg font-semibold mb-4 text-white">🌍 माइक्रो-मैप: रायगढ़ जिला → ब्लॉक → वार्ड/ग्राम</h4>
              <div 
                className="h-56 bg-white/5 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/10"
                aria-label="रायगढ़ जिला माइक्रो-मैप - ब्लॉकों और वार्डों का विस्तृत नक्शा"
              >
                <div className="text-center">
                  <div className="text-5xl mb-3">🗺️</div>
                  <p className="text-base font-semibold text-white">रायगढ़ जिला का माइक्रो-मैप</p>
                </div>
              </div>
            </div>

            {/* Coverage Progress */}
            <div>
              <h4 className="text-lg font-semibold mb-4 text-white">🧭 कवरेज प्रगति: ग्राम/वार्ड विज़िट प्रतिशत</h4>
              <div className="text-center">
                <div className="text-5xl font-bold text-mint-green mb-3">
                  {data.raigarh_section.coverage_percentage}%
                </div>
                <p className="text-lg font-semibold text-white">ग्राम/वार्ड कवरेज</p>
                <div className="h-40 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={coveragePieData}
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {coveragePieData.map((entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={index === 0 ? '#8BF5E6' : 'rgba(255, 255, 255, 0.1)'}
                            stroke="none"
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Local Events List */}
          <div className="mt-8">
            <h4 className="text-lg font-semibold mb-4 text-white">📋 लोकल कार्यक्रम सूची (तारीख / स्थान / विवरण)</h4>
            <div className="space-y-3 max-h-56 overflow-y-auto">
              {data.raigarh_section.local_events.map((event, index) => (
                <div key={index} className="flex justify-between items-center p-4 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
                  <div>
                    <span className="text-base font-semibold text-white">{event.location}</span>
                    <span className="text-sm text-white/90 ml-2">({event.date})</span>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-medium text-white">{event.type}</div>
                    <div className="text-sm text-white/90">{event.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Community Data */}
          <div className="mt-8">
            <h4 className="text-lg font-semibold mb-4 text-white">🧬 समुदाय / समाजवार पहुँच डेटा</h4>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
              {Object.entries(data.raigarh_section.community_data).map(([community, count]) => (
                <div key={community} className="text-center p-4 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
                  <div className="text-2xl font-bold text-mint-green mb-1">{count}</div>
                  <div className="text-sm font-medium text-white">{community}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Public Response */}
          <div className="mt-8">
            <h4 className="text-lg font-semibold mb-4 text-white">💬 पब्लिक रिस्पॉन्स (Likes / Retweets / Replies)</h4>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center p-6 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
                <div className="text-4xl font-bold text-mint-green mb-2">
                  {data.raigarh_section.engagement_metrics.total_likes.toLocaleString()}
                </div>
                <div className="text-base font-semibold text-white">Likes</div>
              </div>
              <div className="text-center p-6 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
                <div className="text-4xl font-bold text-mint-green mb-2">
                  {data.raigarh_section.engagement_metrics.total_retweets.toLocaleString()}
                </div>
                <div className="text-base font-semibold text-white">Retweets</div>
              </div>
              <div className="text-center p-6 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
                <div className="text-4xl font-bold text-mint-green mb-2">
                  {data.raigarh_section.engagement_metrics.total_replies.toLocaleString()}
                </div>
                <div className="text-base font-semibold text-white">Replies</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Export Section */}
      <div className="glassmorphic-card rounded-lg p-8 text-center shadow-lg">
        <h3 className="text-2xl font-bold mb-6 text-white">📄 रिपोर्ट / निर्यात</h3>
        <div className="flex justify-center gap-6">
          <button
            onClick={() => handleExport('pdf')}
            className="neon-button px-8 py-4 text-lg font-bold rounded-lg"
          >
            [ PDF ]
          </button>
          <button
            onClick={() => handleExport('excel')}
            className="neon-button px-8 py-4 text-lg font-bold rounded-lg"
          >
            [ Excel ]
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="neon-button px-8 py-4 text-lg font-bold rounded-lg"
          >
            [ CSV ]
          </button>
        </div>
      </div>
    </div>
  );
}
