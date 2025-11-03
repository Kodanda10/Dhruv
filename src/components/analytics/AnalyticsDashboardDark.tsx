'use client';
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import GeoHierarchyMindmap from './GeoHierarchyMindmap';
import type { GeoAnalyticsFilters } from '@/types/geo-analytics';

interface TweetData {
  id: string;
  timestamp: string;
  content: string;
  parsed?: {
    event_type?: string;
    locations?: Array<{ name: string; confidence: number } | string>;
    people?: string[];
    organizations?: string[];
    schemes?: string[];
  };
  confidence?: number;
  needs_review?: boolean;
  review_status?: string;
}

interface AnalyticsData {
  timeSeriesData: { date: string; value: number }[];
  eventTypeData: { label: string; value: number; color: string }[];
  dayOfWeekData: { day: string; count: number }[];
  locationData: { location: string; count: number }[];
  schemeData: { scheme: string; count: number }[];
}

export default function AnalyticsDashboardDark() {
  const [filters, setFilters] = useState({
    timeRange: '30d',
    location: 'all',
    eventType: 'all',
    theme: 'all'
  });
  
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalyticsData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/analytics');
      const result = await response.json();
      
      if (result.success && result.analytics) {
        const { analytics, raw_data } = result;
        
        // Process analytics data
        const processedData: AnalyticsData = {
          timeSeriesData: analytics.timeline || [],
          eventTypeData: Object.entries(analytics.event_distribution || {}).map(([name, count]) => ({
            label: name,
            value: count as number,
            color: getEventTypeColor(name)
          })),
          dayOfWeekData: Object.entries(analytics.day_of_week || {}).map(([day, count]) => ({
            day,
            count: count as number
          })),
          locationData: Object.entries(analytics.location_distribution || {}).slice(0, 10).map(([location, count]) => ({
            location,
            count: count as number
          })),
          schemeData: Object.entries(analytics.scheme_usage || {}).map(([scheme, count]) => ({
            scheme,
            count: count as number
          }))
        };
        
        setAnalyticsData(processedData);
      } else {
        setError('विश्लेषण डेटा लोड करने में विफल');
      }
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const getEventTypeColor = (eventType: string): string => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    const hash = eventType.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const getHindiDayName = (day: string): string => {
    const hindiDays: Record<string, string> = {
      'Sunday': 'रविवार',
      'Monday': 'सोमवार',
      'Tuesday': 'मंगलवार',
      'Wednesday': 'बुधवार',
      'Thursday': 'गुरुवार',
      'Friday': 'शुक्रवार',
      'Saturday': 'शनिवार',
      'रविवार': 'रविवार',
      'सोमवार': 'सोमवार',
      'मंगलवार': 'मंगलवार',
      'बुधवार': 'बुधवार',
      'गुरुवार': 'गुरुवार',
      'शुक्रवार': 'शुक्रवार',
      'शनिवार': 'शनिवार'
    };
    return hindiDays[day] || day;
  };

  // Convert dashboard filters to geo-analytics filter format
  const convertFiltersToGeoAnalyticsFilters = (
    dashboardFilters: { timeRange: string; location: string; eventType: string; theme: string }
  ): GeoAnalyticsFilters => {
    const now = new Date();
    let startDate: string | null = null;
    let endDate: string | null = null;

    // Convert timeRange to dates
    if (dashboardFilters.timeRange !== 'all') {
      const days = dashboardFilters.timeRange === '7d' ? 7 :
                   dashboardFilters.timeRange === '30d' ? 30 :
                   dashboardFilters.timeRange === '90d' ? 90 :
                   dashboardFilters.timeRange === '1y' ? 365 : 30;
      
      const start = new Date(now);
      start.setDate(start.getDate() - days);
      startDate = start.toISOString().split('T')[0];
      endDate = now.toISOString().split('T')[0];
    }

    return {
      start_date: startDate,
      end_date: endDate,
      event_type: dashboardFilters.eventType !== 'all' ? dashboardFilters.eventType : null,
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#101922] text-gray-200 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">एनालिटिक्स डेटा लोड हो रहा है...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#101922] text-gray-200 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">❌ {error}</p>
          <button 
            onClick={fetchAnalyticsData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            पुनः प्रयास करें
          </button>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="min-h-screen bg-[#101922] text-gray-200 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400">कोई डेटा उपलब्ध नहीं है</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101922] text-gray-200">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">एनालिटिक्स डैशबोर्ड</h1>
          <p className="text-gray-400">डेटा विश्लेषण और अंतर्दृष्टि</p>
        </div>

        <div className="space-y-8" data-testid="analytics-dashboard">
          {/* Filters Section */}
          <div className="bg-[#192734] border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 text-white">फ़िल्टर</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">समय सीमा</label>
                <select 
                  value={filters.timeRange} 
                  onChange={(e) => setFilters({...filters, timeRange: e.target.value})}
                  className="w-full rounded-md border border-gray-700 bg-[#0d1117] text-gray-100 py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="7d">7 दिन</option>
                  <option value="30d">30 दिन</option>
                  <option value="90d">90 दिन</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">स्थान</label>
                <select 
                  value={filters.location} 
                  onChange={(e) => setFilters({...filters, location: e.target.value})}
                  className="w-full rounded-md border border-gray-700 bg-[#0d1117] text-gray-100 py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">सभी</option>
                  <option value="raipur">रायपुर</option>
                  <option value="bilaspur">बिलासपुर</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">दौरा/कार्यक्रम</label>
                <select 
                  value={filters.eventType} 
                  onChange={(e) => setFilters({...filters, eventType: e.target.value})}
                  className="w-full rounded-md border border-gray-700 bg-[#0d1117] text-gray-100 py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">सभी</option>
                  <option value="meeting">बैठक</option>
                  <option value="rally">रैली</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">थीम</label>
                <select 
                  value={filters.theme} 
                  onChange={(e) => setFilters({...filters, theme: e.target.value})}
                  className="w-full rounded-md border border-gray-700 bg-[#0d1117] text-gray-100 py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">सभी</option>
                  <option value="development">विकास</option>
                  <option value="politics">राजनीति</option>
                </select>
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Time Series Chart */}
            <div className="lg:col-span-2">
              <div className="bg-[#192734] border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-white">समय के साथ गतिविधि (30 दिन)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analyticsData.timeSeriesData.slice(-30)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#9CA3AF"
                        fontSize={12}
                        tickFormatter={(value) => new Date(value).toLocaleDateString('hi-IN', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis stroke="#9CA3AF" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1F2937', 
                          border: '1px solid #374151', 
                          borderRadius: '8px',
                          color: '#F9FAFB'
                        }}
                        labelFormatter={(value) => new Date(value).toLocaleDateString('hi-IN')}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#3B82F6" 
                        strokeWidth={2}
                        dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Event Type Distribution */}
            <div className="bg-[#192734] border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 text-white">दौरा/कार्यक्रम वितरण</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analyticsData.eventTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ label, value }) => `${label}\n${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {analyticsData.eventTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1F2937', 
                        border: '1px solid #374151', 
                        borderRadius: '8px',
                        color: '#F9FAFB'
                      }}
                      formatter={(value: number, name: string) => [
                        `${value}`,
                        name
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Day of Week Chart */}
            <div className="bg-[#192734] border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 text-white">सप्ताह के दिन के अनुसार गतिविधि</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.dayOfWeekData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="day" 
                      stroke="#9CA3AF"
                      fontSize={12}
                      tickFormatter={(value) => getHindiDayName(value)}
                    />
                    <YAxis stroke="#9CA3AF" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1F2937', 
                        border: '1px solid #374151', 
                        borderRadius: '8px',
                        color: '#F9FAFB'
                      }}
                      labelFormatter={(value) => getHindiDayName(value)}
                    />
                    <Bar dataKey="count" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Location Distribution */}
          <div className="bg-[#192734] border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 text-white">स्थान वितरण (Top 10)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticsData.locationData.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="location" 
                    stroke="#9CA3AF"
                    fontSize={12}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: '1px solid #374151', 
                      borderRadius: '8px',
                      color: '#F9FAFB'
                    }}
                  />
                  <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Geo-Hierarchy Mindmap */}
          <div className="lg:col-span-2">
            <GeoHierarchyMindmap
              filters={convertFiltersToGeoAnalyticsFilters(filters)}
              height={600}
            />
          </div>

          {/* Scheme Usage */}
          <div className="bg-[#192734] border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 text-white">योजना उपयोग</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analyticsData.schemeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                    label={({ scheme, value }) => `${scheme} (${value})`}
                  >
                    {analyticsData.schemeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`hsl(${index * 60}, 70%, 50%)`} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: '1px solid #374151', 
                      borderRadius: '8px',
                      color: '#F9FAFB'
                    }}
                    formatter={(value: number, name: string) => [
                      `${value} ट्वीट्स`,
                      name
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
