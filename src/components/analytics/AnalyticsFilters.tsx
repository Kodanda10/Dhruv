'use client';

import React from 'react';

export interface AnalyticsFiltersState {
  timeRange: string;
  location: string;
  eventType: string;
  theme: string;
}

interface AnalyticsFiltersProps {
  filters: AnalyticsFiltersState;
  onFiltersChange: (filters: AnalyticsFiltersState) => void;
  className?: string;
}

export default function AnalyticsFilters({
  filters,
  onFiltersChange,
  className = ''
}: AnalyticsFiltersProps) {
  const timeRangeOptions = [
    { value: '7d', label: '7 दिन' },
    { value: '30d', label: '30 दिन' },
    { value: '90d', label: '90 दिन' },
    { value: '1y', label: '1 वर्ष' },
    { value: 'all', label: 'सभी समय' },
    { value: 'custom', label: 'कस्टम' }
  ];

  const locationOptions = [
    { value: 'all', label: 'सभी स्थान' },
    { value: 'raipur', label: 'रायपुर' },
    { value: 'bilaspur', label: 'बिलासपुर' },
    { value: 'raigarh', label: 'रायगढ़' },
    { value: 'durg', label: 'दुर्ग' },
    { value: 'korba', label: 'कोरबा' }
  ];

  const eventTypeOptions = [
    { value: 'all', label: 'सभी प्रकार' },
    { value: 'scheme', label: 'योजना' },
    { value: 'tribute', label: 'श्रद्धांजलि' },
    { value: 'meeting', label: 'बैठक' },
    { value: 'rally', label: 'रैली' },
    { value: 'inspection', label: 'निरीक्षण' }
  ];

  const themeOptions = [
    { value: 'all', label: 'सभी विषय' },
    { value: 'development', label: 'विकास' },
    { value: 'politics', label: 'राजनीति' },
    { value: 'social', label: 'सामाजिक' },
    { value: 'economic', label: 'आर्थिक' },
    { value: 'education', label: 'शिक्षा' }
  ];

  const handleFilterChange = (filterType: keyof AnalyticsFiltersState, value: string) => {
    onFiltersChange({
      ...filters,
      [filterType]: value
    });
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.timeRange !== '30d') count++;
    if (filters.location !== 'all') count++;
    if (filters.eventType !== 'all') count++;
    if (filters.theme !== 'all') count++;
    return count;
  };

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-6 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">एनालिटिक्स फिल्टर</h3>
        <p className="text-sm text-gray-600">डेटा को फिल्टर करने के लिए विकल्प चुनें</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="analytics-filters">
        {/* Time Range Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            समय सीमा
          </label>
          <select
            value={filters.timeRange}
            onChange={(e) => handleFilterChange('timeRange', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {timeRangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Location Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            स्थान
          </label>
          <select
            value={filters.location}
            onChange={(e) => handleFilterChange('location', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {locationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Event Type Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            घटना प्रकार
          </label>
          <select
            value={filters.eventType}
            onChange={(e) => handleFilterChange('eventType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {eventTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Theme Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            विषय
          </label>
          <select
            value={filters.theme}
            onChange={(e) => handleFilterChange('theme', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {themeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter Summary */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            <strong>सक्रिय फिल्टर:</strong> {activeFiltersCount} फिल्टर लागू
          </div>
          <div className="text-xs text-gray-500">
            डेटा को फिल्टर करने के लिए विकल्प चुनें
          </div>
        </div>
      </div>
    </div>
  );
}
