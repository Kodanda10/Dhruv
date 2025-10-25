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
      const response = await fetch('/api/parsed-events?limit=200');
      const result = await response.json();
      
      if (result.success && result.data) {
        const processedData = processAnalyticsData(result.data);
        setAnalyticsData(processedData);
      } else {
        throw new Error('Failed to fetch data');
      }
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const processAnalyticsData = (tweets: TweetData[]): AnalyticsData => {
    // Process time series data
    const timeSeriesMap = new Map<string, number>();
    const eventTypeMap = new Map<string, number>();
    const dayOfWeekMap = new Map<string, number>();
    const locationMap = new Map<string, number>();
    
    tweets.forEach(tweet => {
      const date = new Date(tweet.timestamp).toISOString().split('T')[0];
      timeSeriesMap.set(date, (timeSeriesMap.get(date) || 0) + 1);
      
      const dayOfWeek = new Date(tweet.timestamp).toLocaleDateString('hi-IN', { weekday: 'long' });
      dayOfWeekMap.set(dayOfWeek, (dayOfWeekMap.get(dayOfWeek) || 0) + 1);
      
      // Handle locations from parsed data
      if (tweet.parsed && tweet.parsed.locations && tweet.parsed.locations.length > 0) {
        tweet.parsed.locations.forEach((loc: any) => {
          const locationName = loc.name || loc;
          if (locationName && locationName !== '—') {
            locationMap.set(locationName, (locationMap.get(locationName) || 0) + 1);
          }
        });
      }
      
      // Handle event type from parsed data
      if (tweet.parsed && tweet.parsed.event_type && tweet.parsed.event_type !== 'अन्य') {
        eventTypeMap.set(tweet.parsed.event_type, (eventTypeMap.get(tweet.parsed.event_type) || 0) + 1);
      }
    });

    // Convert to arrays
    const timeSeriesData = Array.from(timeSeriesMap.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const eventTypeData = Array.from(eventTypeMap.entries())
      .map(([label, value], index) => ({
        label,
        value: Math.round((value / tweets.length) * 100),
        color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]
      }))
      .sort((a, b) => b.value - a.value);

    const dayOfWeekData = [
      { day: 'सोमवार', count: dayOfWeekMap.get('सोमवार') || 0 },
      { day: 'मंगलवार', count: dayOfWeekMap.get('मंगलवार') || 0 },
      { day: 'बुधवार', count: dayOfWeekMap.get('बुधवार') || 0 },
      { day: 'गुरुवार', count: dayOfWeekMap.get('गुरुवार') || 0 },
      { day: 'शुक्रवार', count: dayOfWeekMap.get('शुक्रवार') || 0 },
      { day: 'शनिवार', count: dayOfWeekMap.get('शनिवार') || 0 },
      { day: 'रविवार', count: dayOfWeekMap.get('रविवार') || 0 }
    ];

    const locationData = Array.from(locationMap.entries())
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const keyInsights = [
      { title: 'कुल ट्वीट', value: tweets.length.toString(), trend: '+0%', color: 'blue' },
      { title: 'समीक्षित', value: tweets.filter(t => t.review_status === 'approved').length.toString(), trend: '+0%', color: 'green' },
      { title: 'सक्रिय स्थान', value: locationMap.size.toString(), trend: '+0', color: 'purple' },
      { title: 'घटना प्रकार', value: eventTypeMap.size.toString(), trend: '+0', color: 'orange' }
    ];

    return {
      timeSeriesData,
      eventTypeData,
      dayOfWeekData,
      locationData,
      keyInsights
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
                <h3 className="text-lg font-semibold mb-4 text-white">समय के साथ गतिविधि</h3>
                     <div className="h-64 bg-[#0d1117] rounded-lg flex items-center justify-center">
                       <div className="text-center">
                         <p className="text-gray-400 mb-2">समय के साथ गतिविधि</p>
                         <div className="text-sm text-gray-500">
                           {analyticsData.timeSeriesData.slice(-5).map(d => `${d.date}: ${d.value}`).join(', ')}
                         </div>
                         <div className="text-xs text-gray-600 mt-2">
                           कुल {analyticsData.timeSeriesData.length} दिनों का डेटा
                         </div>
                       </div>
                     </div>
              </div>
            </div>

            {/* Event Type Pie Chart */}
            <div className="bg-[#192734] border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 text-white">घटना प्रकार वितरण</h3>
                     <div className="h-64 bg-[#0d1117] rounded-lg flex items-center justify-center">
                       <div className="text-center">
                         <p className="text-gray-400 mb-2">घटना प्रकार वितरण</p>
                         <div className="text-sm text-gray-500">
                           {analyticsData.eventTypeData.map(d => `${d.label}: ${d.value}%`).join(', ')}
                         </div>
                         <div className="text-xs text-gray-600 mt-2">
                           कुल {analyticsData.eventTypeData.length} प्रकार
                         </div>
                       </div>
                     </div>
            </div>

            {/* Day of Week Chart */}
            <div className="bg-[#192734] border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 text-white">सप्ताह के दिन के अनुसार गतिविधि</h3>
                     <div className="h-64 bg-[#0d1117] rounded-lg flex items-center justify-center">
                       <div className="text-center">
                         <p className="text-gray-400 mb-2">सप्ताह के दिन के अनुसार गतिविधि</p>
                         <div className="text-sm text-gray-500">
                           {analyticsData.dayOfWeekData.map(d => `${d.day}: ${d.count}`).join(', ')}
                         </div>
                         <div className="text-xs text-gray-600 mt-2">
                           सबसे अधिक: {analyticsData.dayOfWeekData.reduce((max, day) => day.count > max.count ? day : max).day}
                         </div>
                       </div>
                     </div>
            </div>
          </div>

          {/* Location Section */}
          <div className="bg-[#192734] border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 text-white">स्थान वितरण</h3>
                   <div className="h-64 bg-[#0d1117] rounded-lg flex items-center justify-center">
                     <div className="text-center">
                       <p className="text-gray-400 mb-2">स्थान वितरण</p>
                       <div className="text-sm text-gray-500">
                         {analyticsData.locationData.map(d => `${d.location}: ${d.count}`).join(', ')}
                       </div>
                       <div className="text-xs text-gray-600 mt-2">
                         कुल {analyticsData.locationData.length} स्थान
                       </div>
                     </div>
                   </div>
          </div>
        </div>
      </div>
    </div>
  );
}
