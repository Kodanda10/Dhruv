/**
 * Analytics Dashboard Component - Hindi Layout Specification
 *
 * Implements the exact 9-module layout specified:
 * A-I: इवेंट विश्लेषण through रायगढ़ विधानसभा अनुभाग
 * Hindi-only UI with proper accessibility
 * Export functionality for PDF/Excel/CSV
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';

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

  // Only show for authenticated admin users
  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <div className="text-muted">
          <p className="text-lg mb-4">🔒 व्यवस्थापक पहुंच आवश्यक</p>
          <p className="text-sm">एनालिटिक्स देखने के लिए कृपया लॉगिन करें।</p>
        </div>
      </div>
    );
  }

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

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-muted">एनालिटिक्स डेटा लोड हो रहा है...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">
          <p className="text-lg">⚠️ त्रुटि</p>
          <p className="text-sm">{error}</p>
        </div>
        <button
          onClick={fetchAnalyticsData}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200"
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
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-primary mb-2">सोशल मीडिया एनालिटिक्स डैशबोर्ड</h1>
        <div className="flex justify-center space-x-4 text-sm text-muted">
          <span>[ 🏠 होम ]</span>
          <span>[ ✍️ समीक्षा ]</span>
          <span className="font-bold">[ 📈 एनालिटिक्स ]</span>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          🔍 फ़िल्टर सेक्शन
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              स्थान ▸
            </label>
            <input
              type="text"
              value={filters.location}
              onChange={(e) => handleFilterChange({ location: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="रायगढ़ / छत्तीसगढ़"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              विषय ▸
            </label>
            <input
              type="text"
              value={filters.subject}
              onChange={(e) => handleFilterChange({ subject: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="योजना / रोजगार / आदि"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              दिनांक से ▸
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange({ startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              तक ▸
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange({ endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={clearFilters}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors duration-200"
          >
            फ़िल्टर साफ करें
          </button>
        </div>
      </div>

      {/* Analytics Content */}
      <div className="space-y-8">
        {/* A. इवेंट प्रकार विश्लेषण */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-xl font-semibold mb-4">🧩 A. इवेंट प्रकार विश्लेषण (Event Type Analysis)</h3>
          <p className="text-sm text-gray-600 mb-4">
            बैठक / समीक्षा / दौरा / लोकार्पण / शोक आदि
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Donut Chart Placeholder */}
            <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl mb-2">📊</div>
                <p className="text-sm text-gray-600">चार्ट: डोनट + टाइमलाइन</p>
              </div>
            </div>

            {/* Event Distribution Data */}
            <div className="space-y-2">
              {Object.entries(data.event_distribution).map(([event, count]) => (
                <div key={event} className="flex justify-between items-center">
                  <span className="text-sm">{event}</span>
                  <span className="text-sm font-medium bg-blue-100 px-2 py-1 rounded">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* B. भू-मानचित्रण और माइंडमैप */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-xl font-semibold mb-4">🗺️ B. भू-मानचित्रण और माइंडमैप (Geo-Mapping & Mindmap)</h3>
          <p className="text-sm text-gray-600 mb-4">
            छत्तीसगढ़ → जिला → ब्लॉक → ग्राम पंचायत / वार्ड
          </p>

          <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-2">🗺️</div>
              <p className="text-sm text-gray-600">हाइलाइट: दौरा की संख्या, स्थानों की कनेक्टिविटी</p>
            </div>
          </div>
        </div>

        {/* C. टूर कवरेज विश्लेषण */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-xl font-semibold mb-4">🧭 C. टूर कवरेज विश्लेषण (Tour Coverage Analysis)</h3>
          <p className="text-sm text-gray-600 mb-4">
            कुल जिलों / ग्रामों का कवरेज %
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {data.raigarh_section.coverage_percentage}%
                </div>
                <p className="text-sm text-gray-600">रायगढ़ जिला कवरेज</p>
              </div>

              <div className="h-32 bg-gray-50 rounded-lg flex items-center justify-center">
                <p className="text-sm text-gray-600">हीटमैप + टाइमलाइन स्लाइडर</p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">स्थानवार दौरा संख्या:</h4>
              {Object.entries(data.location_distribution).slice(0, 5).map(([location, count]) => (
                <div key={location} className="flex justify-between items-center">
                  <span className="text-sm">{location}</span>
                  <span className="text-sm font-medium">{count} दौरा</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* D. विकास कार्य और लोकार्पण विश्लेषण */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-xl font-semibold mb-4">🏗️ D. विकास कार्य और लोकार्पण विश्लेषण</h3>
          <p className="text-sm text-gray-600 mb-4">
            कार्य प्रकार / स्थान / योजना नाम
          </p>

          <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-2">🏗️</div>
              <p className="text-sm text-gray-600">ग्राफ: जिलानुसार वितरण</p>
            </div>
          </div>
        </div>

        {/* E. समाज आधारित पहुँच */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-xl font-semibold mb-4">🫱 E. समाज आधारित पहुँच (Caste Equation / Community Outreach)</h3>
          <p className="text-sm text-gray-600 mb-4">
            साहू / तेली / मुस्लिम / यादव / अन्य समाज
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(data.caste_community).map(([caste, count]) => (
              <div key={caste} className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600 mb-1">{count}</div>
                <div className="text-sm text-gray-700">{caste}</div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <p className="text-sm text-gray-600">
              समुदायवार कार्यक्रम संख्या और स्थान
            </p>
          </div>
        </div>

        {/* F. योजनाएँ / स्कीम विश्लेषण */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-xl font-semibold mb-4">🪔 F. योजनाएँ / स्कीम विश्लेषण (Scheme / Yojana)</h3>
          <p className="text-sm text-gray-600 mb-4">
            पीएमएवाई / जल जीवन मिशन / युवा स्वरोजगार आदि
          </p>

          <div className="space-y-3">
            {Object.entries(data.scheme_usage).map(([scheme, count]) => (
              <div key={scheme} className="flex justify-between items-center p-3 bg-green-50 rounded">
                <span className="text-sm font-medium">{scheme}</span>
                <span className="text-sm bg-green-100 px-2 py-1 rounded">
                  {count} ट्वीट
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* G. वर्ग-आधारित विश्लेषण */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-xl font-semibold mb-4">🧠 G. वर्ग-आधारित विश्लेषण (Varg-wise)</h3>
          <p className="text-sm text-gray-600 mb-4">
            महिला / युवा / किसान / वरिष्ठ नागरिक
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(data.target_groups).map(([group, count]) => (
              <div key={group} className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600 mb-1">{count}</div>
                <div className="text-sm text-gray-700">{group}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 h-32 bg-gray-50 rounded-lg flex items-center justify-center">
            <p className="text-sm text-gray-600">चार्ट: वर्ग बनाम इवेंट प्रकार</p>
          </div>
        </div>

        {/* H. विषयगत विश्लेषण */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-xl font-semibold mb-4">📊 H. विषयगत विश्लेषण (Subject / Thematic Analysis)</h3>
          <p className="text-sm text-gray-600 mb-4">
            रोज़गार / शिक्षा / स्वास्थ्य / आधारभूत संरचना
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              {Object.entries(data.thematic_analysis).map(([theme, count]) => (
                <div key={theme} className="flex justify-between items-center">
                  <span className="text-sm">{theme}</span>
                  <span className="text-sm font-medium bg-indigo-100 px-2 py-1 rounded">
                    {count}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div className="h-24 bg-gray-50 rounded-lg flex items-center justify-center">
                <p className="text-sm text-gray-600">वर्डक्लाउड</p>
              </div>
              <div className="h-24 bg-gray-50 rounded-lg flex items-center justify-center">
                <p className="text-sm text-gray-600">सहसंबंध ग्राफ</p>
              </div>
            </div>
          </div>
        </div>

        {/* I. रायगढ़ विधानसभा अनुभाग */}
        <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-xl font-semibold mb-4">🏛️ I. रायगढ़ विधानसभा अनुभाग (Dedicated Raigarh Section)</h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Micro-map */}
            <div>
              <h4 className="font-medium mb-3">🌍 माइक्रो-मैप: रायगढ़ जिला → ब्लॉक → वार्ड/ग्राम</h4>
              <div className="h-48 bg-gray-50 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="text-3xl mb-2">🗺️</div>
                  <p className="text-sm text-gray-600">रायगढ़ जिला का माइक्रो-मैप</p>
                </div>
              </div>
            </div>

            {/* Coverage Progress */}
            <div>
              <h4 className="font-medium mb-3">🧭 कवरेज प्रगति: ग्राम/वार्ड विज़िट प्रतिशत</h4>
              <div className="text-center">
                <div className="text-4xl font-bold text-orange-600 mb-2">
                  {data.raigarh_section.coverage_percentage}%
                </div>
                <p className="text-sm text-gray-600">ग्राम/वार्ड कवरेज</p>
                <div className="mt-3 bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-orange-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${data.raigarh_section.coverage_percentage}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Local Events List */}
          <div className="mt-6">
            <h4 className="font-medium mb-3">📋 लोकल कार्यक्रम सूची (तारीख / स्थान / विवरण)</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {data.raigarh_section.local_events.map((event, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-white rounded border">
                  <div>
                    <span className="text-sm font-medium">{event.location}</span>
                    <span className="text-xs text-gray-500 ml-2">({event.date})</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">{event.type}</div>
                    <div className="text-xs text-gray-600">{event.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Community Data */}
          <div className="mt-6">
            <h4 className="font-medium mb-3">🧬 समुदाय / समाजवार पहुँच डेटा</h4>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              {Object.entries(data.raigarh_section.community_data).map(([community, count]) => (
                <div key={community} className="text-center p-3 bg-orange-50 rounded">
                  <div className="text-lg font-bold text-orange-700">{count}</div>
                  <div className="text-xs text-gray-600">{community}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Public Response */}
          <div className="mt-6">
            <h4 className="font-medium mb-3">💬 पब्लिक रिस्पॉन्स (Likes / Retweets / Replies)</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {data.raigarh_section.engagement_metrics.total_likes.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Likes</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {data.raigarh_section.engagement_metrics.total_retweets.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Retweets</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {data.raigarh_section.engagement_metrics.total_replies.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Replies</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Export Section */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <h3 className="text-lg font-semibold mb-4">📄 रिपोर्ट / निर्यात</h3>
        <div className="flex justify-center gap-4">
          <button
            onClick={() => handleExport('pdf')}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200 font-medium"
          >
            [ PDF ]
          </button>
          <button
            onClick={() => handleExport('excel')}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200 font-medium"
          >
            [ Excel ]
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 font-medium"
          >
            [ CSV ]
          </button>
        </div>
      </div>
    </div>
  );
}
