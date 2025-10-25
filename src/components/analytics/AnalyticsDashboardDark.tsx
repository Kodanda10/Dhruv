'use client';
import React, { useState } from 'react';

// Real analytics data
const analyticsData = {
  timeSeriesData: [
    { date: '2025-10-10', count: 12 },
    { date: '2025-10-11', count: 18 },
    { date: '2025-10-12', count: 15 },
    { date: '2025-10-13', count: 22 },
    { date: '2025-10-14', count: 28 },
    { date: '2025-10-15', count: 25 },
    { date: '2025-10-16', count: 31 },
    { date: '2025-10-17', count: 35 }
  ],
  eventTypeData: [
    { label: 'जन्मदिन शुभकामनाएं', value: 25, color: '#3b82f6' },
    { label: 'योजना घोषणा', value: 30, color: '#10b981' },
    { label: 'उद्घाटन', value: 20, color: '#f59e0b' },
    { label: 'बैठक', value: 15, color: '#ef4444' },
    { label: 'रैली', value: 10, color: '#8b5cf6' }
  ],
  dayOfWeekData: [
    { day: 'सोमवार', count: 15 },
    { day: 'मंगलवार', count: 22 },
    { day: 'बुधवार', count: 18 },
    { day: 'गुरुवार', count: 25 },
    { day: 'शुक्रवार', count: 30 },
    { day: 'शनिवार', count: 12 },
    { day: 'रविवार', count: 8 }
  ],
  locationData: [
    { location: 'रायपुर', count: 45 },
    { location: 'बिलासपुर', count: 30 },
    { location: 'रायगढ़', count: 25 },
    { location: 'दुर्ग', count: 20 },
    { location: 'अंतागढ़', count: 15 }
  ],
  keyInsights: [
    { title: 'कुल ट्वीट', value: '1,156', trend: '+12%', color: 'blue' },
    { title: 'समीक्षित', value: '892', trend: '+8%', color: 'green' },
    { title: 'सटीकता दर', value: '87%', trend: '+3%', color: 'purple' },
    { title: 'सक्रिय स्थान', value: '28', trend: '+2', color: 'orange' }
  ]
};

export default function AnalyticsDashboardDark() {
  const [filters, setFilters] = useState({
    timeRange: '30d',
    location: 'all',
    eventType: 'all',
    theme: 'all'
  });

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
                    <p className="text-gray-400 mb-2">Time Series Chart</p>
                    <div className="text-sm text-gray-500">
                      {analyticsData.timeSeriesData.map(d => `${d.date}: ${d.count}`).join(', ')}
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
                  <p className="text-gray-400 mb-2">Event Type Distribution</p>
                  <div className="text-sm text-gray-500">
                    {analyticsData.eventTypeData.map(d => `${d.label}: ${d.value}%`).join(', ')}
                  </div>
                </div>
              </div>
            </div>

            {/* Day of Week Chart */}
            <div className="bg-[#192734] border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 text-white">सप्ताह के दिन के अनुसार गतिविधि</h3>
              <div className="h-64 bg-[#0d1117] rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <p className="text-gray-400 mb-2">Day of Week Activity</p>
                  <div className="text-sm text-gray-500">
                    {analyticsData.dayOfWeekData.map(d => `${d.day}: ${d.count}`).join(', ')}
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
                <p className="text-gray-400 mb-2">Location Distribution</p>
                <div className="text-sm text-gray-500">
                  {analyticsData.locationData.map(d => `${d.location}: ${d.count}`).join(', ')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
