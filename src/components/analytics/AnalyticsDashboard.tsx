'use client';

import React, { useState } from 'react';
import TimeSeriesChart from './TimeSeriesChart';
import EventTypePieChart from './EventTypePieChart';
import DayOfWeekChart from './DayOfWeekChart';
import LocationBarChart from './LocationBarChart';
import LocationLeafletMap from './LocationLeafletMap';
import LocationSVGMap from './LocationSVGMap';
import LocationToggle, { LocationViewType } from './LocationToggle';
import NarrativeClassificationChart from './NarrativeClassificationChart';
import KeyInsightsCards, { KeyInsight } from './KeyInsightsCards';
import AnalyticsFilters, { AnalyticsFiltersState } from './AnalyticsFilters';

interface AnalyticsDashboardProps {
  data: {
    tweets: any[];
    insights: KeyInsight[];
  };
  className?: string;
}

export default function AnalyticsDashboard({
  data,
  className = ''
}: AnalyticsDashboardProps) {
  const [filters, setFilters] = useState<AnalyticsFiltersState>({
    timeRange: '30d',
    location: 'all',
    eventType: 'all',
    theme: 'all'
  });

  const [locationView, setLocationView] = useState<LocationViewType>('bar');

  const handleFiltersChange = (newFilters: AnalyticsFiltersState) => {
    setFilters(newFilters);
  };

  const handleLocationViewChange = (view: LocationViewType) => {
    setLocationView(view);
  };

  // Mock data for charts (in real app, this would come from API)
  const timeSeriesData = [
    { date: '2024-01-01', value: 10 },
    { date: '2024-01-02', value: 15 },
    { date: '2024-01-03', value: 12 },
    { date: '2024-01-04', value: 18 },
    { date: '2024-01-05', value: 22 }
  ];

  const eventTypeData = [
    { label: 'योजना', value: 45, color: '#3b82f6' },
    { label: 'श्रद्धांजलि', value: 30, color: '#ef4444' },
    { label: 'बैठक', value: 25, color: '#10b981' }
  ];

  const dayOfWeekData = [
    { day: 'सोमवार', count: 10 },
    { day: 'मंगलवार', count: 15 },
    { day: 'बुधवार', count: 20 },
    { day: 'गुरुवार', count: 25 },
    { day: 'शुक्रवार', count: 30 },
    { day: 'शनिवार', count: 12 },
    { day: 'रविवार', count: 8 }
  ];

  const locationData = [
    { location: 'रायपुर', count: 45 },
    { location: 'बिलासपुर', count: 30 },
    { location: 'रायगढ़', count: 25 },
    { location: 'दुर्ग', count: 20 }
  ];

  const narrativeData = [
    { theme: 'विकास', count: 45, percentage: 30 },
    { theme: 'श्रद्धांजलि', count: 38, percentage: 25 },
    { theme: 'राजनीति', count: 35, percentage: 23 },
    { theme: 'योजना', count: 32, percentage: 22 }
  ];

  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">एनालिटिक्स डैशबोर्ड</h1>
          <p className="text-gray-600">डेटा विश्लेषण और अंतर्दृष्टि</p>
        </div>

        <div className="space-y-8" data-testid="analytics-dashboard">
          {/* Filters Section */}
          <AnalyticsFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
          />

          {/* Key Insights Section */}
          <KeyInsightsCards insights={data.insights || []} />

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Time Series Chart */}
            <div className="lg:col-span-2">
              <TimeSeriesChart
                data={timeSeriesData}
                title="समय के साथ गतिविधि"
                dateField="date"
                valueField="value"
                width={800}
                height={400}
              />
            </div>

            {/* Event Type Pie Chart */}
            <EventTypePieChart
              data={eventTypeData}
              title="घटना प्रकार वितरण"
              width={400}
              height={400}
            />

            {/* Day of Week Chart */}
            <DayOfWeekChart
              data={dayOfWeekData}
              title="सप्ताह के दिन के अनुसार गतिविधि"
            />
          </div>

          {/* Location Section */}
          <div className="space-y-6">
            <LocationToggle
              currentView={locationView}
              onViewChange={handleLocationViewChange}
            />

            {locationView === 'bar' && (
              <LocationBarChart
                data={locationData}
                title="स्थान वितरण"
              />
            )}

            {locationView === 'leaflet' && (
              <LocationLeafletMap
                data={locationData}
                title="इंटरैक्टिव स्थान मानचित्र"
              />
            )}

            {locationView === 'svg' && (
              <LocationSVGMap
                data={locationData}
                title="SVG स्थान मानचित्र"
              />
            )}
          </div>

          {/* Narrative Classification */}
          <NarrativeClassificationChart
            data={narrativeData}
          />
        </div>
      </div>
    </div>
  );
}
