'use client';
import React, { useState, useEffect } from 'react';

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
  keyInsights: { title: string; value: string; trend: string; color: string }[];
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
          keyInsights: [
            {
              title: 'कुल ट्वीट्स',
              value: analytics.total_tweets.toString(),
              trend: '+12%',
              color: 'text-blue-400'
            },
            {
              title: 'अद्वितीय स्थान',
              value: Object.keys(analytics.location_distribution || {}).length.toString(),
              trend: '+5%',
              color: 'text-green-400'
            },
            {
              title: 'सबसे आम घटना',
              value: Object.entries(analytics.event_distribution || {})
                .sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] || 'N/A',
              trend: 'stable',
              color: 'text-purple-400'
            },
            {
              title: 'उल्लिखित योजनाएं',
              value: Object.keys(analytics.scheme_usage || {}).length.toString(),
              trend: '+8%',
              color: 'text-orange-400'
            }
          ]
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
          <p className="text-gray-400">डेटा विश्लेषण और अंतर्दृष्टि ({analyticsData.keyInsights[0].value} ट्वीट)</p>
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
                <label className="block text-sm font-medium text-gray-300 mb-2">घटना प्रकार</label>
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

          {/* Key Insights */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {analyticsData.keyInsights.map((insight, index) => (
              <div key={index} className="bg-[#192734] border border-gray-800 rounded-xl p-6 text-center">
                <div className={`text-3xl font-bold mb-2 ${
                  insight.color === 'blue' ? 'text-blue-400' :
                  insight.color === 'green' ? 'text-green-400' :
                  insight.color === 'purple' ? 'text-purple-400' :
                  'text-orange-400'
                }`}>
                  {insight.value}
                </div>
                <div className="text-sm text-gray-400 mb-1">{insight.title}</div>
                <div className="text-xs text-green-400">{insight.trend}</div>
              </div>
            ))}
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Time Series Chart */}
            <div className="lg:col-span-2">
              <div className="bg-[#192734] border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-white">समय के साथ गतिविधि (30 दिन)</h3>
                <div className="h-64 bg-[#0d1117] rounded-lg p-4 overflow-y-auto">
                  <div className="space-y-2">
                    {analyticsData.timeSeriesData.slice(-10).map((d, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-800 rounded">
                        <span className="text-sm text-gray-300">{d.date}</span>
                        <div className="flex items-center">
                          <div className="w-20 bg-gray-700 rounded-full h-2 mr-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full" 
                              style={{ width: `${(d.count / Math.max(...analyticsData.timeSeriesData.map(t => t.count))) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-white font-medium">{d.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Event Type Distribution */}
            <div className="bg-[#192734] border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 text-white">घटना प्रकार वितरण</h3>
              <div className="h-64 bg-[#0d1117] rounded-lg p-4 overflow-y-auto">
                <div className="space-y-3">
                  {analyticsData.eventTypeData.map((d, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full mr-3" 
                          style={{ backgroundColor: d.color }}
                        ></div>
                        <span className="text-sm text-gray-300">{d.label}</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-700 rounded-full h-2 mr-2">
                          <div 
                            className="h-2 rounded-full" 
                            style={{ 
                              width: `${(d.value / analyticsData.keyInsights[0].value) * 100}%`,
                              backgroundColor: d.color
                            }}
                          ></div>
                        </div>
                        <span className="text-sm text-white font-medium">{d.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Day of Week Chart */}
            <div className="bg-[#192734] border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 text-white">सप्ताह के दिन के अनुसार गतिविधि</h3>
              <div className="h-64 bg-[#0d1117] rounded-lg p-4">
                <div className="space-y-3">
                  {analyticsData.dayOfWeekData.map((d, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">{d.day}</span>
                      <div className="flex items-center">
                        <div className="w-20 bg-gray-700 rounded-full h-2 mr-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{ width: `${(d.count / Math.max(...analyticsData.dayOfWeekData.map(day => day.count))) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-white font-medium">{d.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Location Distribution */}
          <div className="bg-[#192734] border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 text-white">स्थान वितरण (Top 10)</h3>
            <div className="h-64 bg-[#0d1117] rounded-lg p-4 overflow-y-auto">
              <div className="space-y-3">
                {analyticsData.locationData.slice(0, 10).map((d, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">{d.location}</span>
                    <div className="flex items-center">
                      <div className="w-20 bg-gray-700 rounded-full h-2 mr-2">
                        <div 
                          className="bg-purple-500 h-2 rounded-full" 
                          style={{ width: `${(d.count / Math.max(...analyticsData.locationData.map(loc => loc.count))) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-white font-medium">{d.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Scheme Usage */}
          <div className="bg-[#192734] border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 text-white">योजना उपयोग (Top 10)</h3>
            <div className="h-64 bg-[#0d1117] rounded-lg p-4 overflow-y-auto">
              <div className="space-y-3">
                {Object.entries(analyticsData.scheme_usage || {})
                  .sort((a, b) => (b[1] as number) - (a[1] as number))
                  .slice(0, 10)
                  .map(([scheme, count], index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">{scheme}</span>
                      <div className="flex items-center">
                        <div className="w-20 bg-gray-700 rounded-full h-2 mr-2">
                          <div 
                            className="bg-orange-500 h-2 rounded-full" 
                            style={{ width: `${(count as number / Math.max(...Object.values(analyticsData.scheme_usage || {}))) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-white font-medium">{count}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
