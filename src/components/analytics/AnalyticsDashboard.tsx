'use client';

import { useState, useEffect, useMemo } from 'react';
import Card from '../ui/Card';
import { api } from '@/lib/api';
import parsedTweets from '../../../data/parsed_tweets.json';

interface AnalyticsData {
  eventTypes: { label: string; count: number; percentage: number }[];
  locations: { name: string; count: number }[];
  confidence: { range: string; count: number }[];
  tags: { tag: string; count: number; type: string }[];
  timeline: { date: string; count: number }[];
  reviewStatus: { pending: number; approved: number; edited: number; skipped: number };
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAnalyticsData = async () => {
      try {
        setLoading(true);
        
        // Try to fetch from API first
        try {
          const response = await api.get<AnalyticsData>('/api/analytics/dashboard');
          setData(response);
          return;
        } catch (apiError) {
          // console.log('API not available, using static data');
        }

        // Fallback to static data processing
        const analyticsData = processStaticData();
        setData(analyticsData);
      } catch (err) {
        setError('Failed to load analytics data');
        console.error('Analytics data loading error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadAnalyticsData();
  }, []);

  const processStaticData = (): AnalyticsData => {
    const tweets = parsedTweets as any[];
    
    // Process event types
    const eventTypeCounts: Record<string, number> = {};
    tweets.forEach(tweet => {
      const eventType = tweet.parsed?.event_type || 'अन्य';
      eventTypeCounts[eventType] = (eventTypeCounts[eventType] || 0) + 1;
    });
    
    const totalTweets = tweets.length;
    const eventTypes = Object.entries(eventTypeCounts).map(([label, count]) => ({
      label,
      count,
      percentage: Math.round((count / totalTweets) * 100)
    })).sort((a, b) => b.count - a.count);

    // Process locations
    const locationCounts: Record<string, number> = {};
    tweets.forEach(tweet => {
      const locations = tweet.parsed?.locations || [];
      locations.forEach((loc: any) => {
        const locationName = loc.name || loc;
        locationCounts[locationName] = (locationCounts[locationName] || 0) + 1;
      });
    });
    
    const locations = Object.entries(locationCounts).map(([name, count]) => ({
      name,
      count
    })).sort((a, b) => b.count - a.count).slice(0, 10);

    // Process confidence scores
    const confidenceRanges = {
      '0.0-0.2': 0,
      '0.2-0.4': 0,
      '0.4-0.6': 0,
      '0.6-0.8': 0,
      '0.8-1.0': 0
    };
    
    tweets.forEach(tweet => {
      const confidence = tweet.confidence || 0;
      if (confidence < 0.2) confidenceRanges['0.0-0.2']++;
      else if (confidence < 0.4) confidenceRanges['0.2-0.4']++;
      else if (confidence < 0.6) confidenceRanges['0.4-0.6']++;
      else if (confidence < 0.8) confidenceRanges['0.6-0.8']++;
      else confidenceRanges['0.8-1.0']++;
    });
    
    const confidence = Object.entries(confidenceRanges).map(([range, count]) => ({
      range,
      count
    }));

    // Process tags and mentions
    const tagCounts: Record<string, number> = {};
    tweets.forEach(tweet => {
      const people = tweet.parsed?.people_mentioned || [];
      const organizations = tweet.parsed?.organizations || [];
      const schemes = tweet.parsed?.schemes_mentioned || [];
      
      [...people, ...organizations, ...schemes].forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    
    const tags = Object.entries(tagCounts).map(([tag, count]) => ({
      tag,
      count,
      type: 'mention'
    })).sort((a, b) => b.count - a.count).slice(0, 15);

    // Process timeline (last 30 days)
    const timeline: { date: string; count: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayTweets = tweets.filter(tweet => {
        const tweetDate = new Date(tweet.timestamp);
        return tweetDate.toISOString().split('T')[0] === dateStr;
      });
      
      timeline.push({
        date: dateStr,
        count: dayTweets.length
      });
    }

    // Mock review status (since static data doesn't have review info)
    const reviewStatus = {
      pending: Math.floor(totalTweets * 0.3),
      approved: Math.floor(totalTweets * 0.5),
      edited: Math.floor(totalTweets * 0.15),
      skipped: Math.floor(totalTweets * 0.05)
    };

    return {
      eventTypes,
      locations,
      confidence,
      tags,
      timeline,
      reviewStatus
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">लोड हो रहा है...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">⚠️ {error}</div>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
        >
          पुनः प्रयास करें
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">कोई डेटा उपलब्ध नहीं है</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 text-center bg-gradient-to-br from-blue-50 to-white">
          <div className="text-2xl font-bold text-blue-600">{data.eventTypes.length}</div>
          <div className="text-sm text-gray-600">घटना प्रकार</div>
        </Card>
        <Card className="p-4 text-center bg-gradient-to-br from-green-50 to-white">
          <div className="text-2xl font-bold text-green-600">{data.locations.length}</div>
          <div className="text-sm text-gray-600">स्थान</div>
        </Card>
        <Card className="p-4 text-center bg-gradient-to-br from-purple-50 to-white">
          <div className="text-2xl font-bold text-purple-600">{data.tags.length}</div>
          <div className="text-sm text-gray-600">टैग/मेंशन</div>
        </Card>
        <Card className="p-4 text-center bg-gradient-to-br from-orange-50 to-white">
          <div className="text-2xl font-bold text-orange-600">{data.reviewStatus.pending}</div>
          <div className="text-sm text-gray-600">समीक्षा के लिए</div>
        </Card>
      </div>

      {/* Event Types Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">📊 घटना प्रकार वितरण</h3>
        <div className="space-y-2">
          {data.eventTypes.slice(0, 8).map((item, index) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">{item.label}</span>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${item.percentage}%` }}
                  ></div>
                </div>
                <span className="text-sm text-gray-600 w-16 text-right">{item.count}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Locations Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">🗺️ स्थान वितरण</h3>
        <div className="space-y-2">
          {data.locations.slice(0, 8).map((item, index) => (
            <div key={item.name} className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">{item.name}</span>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(item.count / data.locations[0]?.count || 1) * 100}%` }}
                  ></div>
                </div>
                <span className="text-sm text-gray-600 w-16 text-right">{item.count}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Confidence Scores */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">📈 विश्वास स्कोर वितरण</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {data.confidence.map((item, index) => (
            <div key={item.range} className="text-center">
              <div className="text-2xl font-bold text-gray-700">{item.count}</div>
              <div className="text-sm text-gray-600">{item.range}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Tags Cloud */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">🏷️ लोकप्रिय टैग</h3>
        <div className="flex flex-wrap gap-2">
          {data.tags.slice(0, 20).map((item, index) => (
            <span 
              key={item.tag}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors cursor-pointer"
              style={{ fontSize: `${Math.max(12, Math.min(18, 12 + item.count))}px` }}
            >
              {item.tag} ({item.count})
            </span>
          ))}
        </div>
      </Card>

      {/* Review Status */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">📋 समीक्षा स्थिति</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-600">{data.reviewStatus.pending}</div>
            <div className="text-sm text-gray-600">लंबित</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{data.reviewStatus.approved}</div>
            <div className="text-sm text-gray-600">अनुमोदित</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{data.reviewStatus.edited}</div>
            <div className="text-sm text-gray-600">संपादित</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{data.reviewStatus.skipped}</div>
            <div className="text-sm text-gray-600">छोड़े गए</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
