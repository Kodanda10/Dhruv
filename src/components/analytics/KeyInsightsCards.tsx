'use client';

import React from 'react';

export interface KeyInsight {
  id: string;
  title: string;
  value: string;
  description: string;
  trend: 'up' | 'down' | 'neutral';
  change: string;
  icon: string;
}

interface KeyInsightsCardsProps {
  insights: KeyInsight[];
  className?: string;
}

export default function KeyInsightsCards({
  insights,
  className = ''
}: KeyInsightsCardsProps) {
  const getTrendColor = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return 'text-green-600 bg-green-50';
      case 'down':
        return 'text-red-600 bg-red-50';
      case 'neutral':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return '↗️';
      case 'down':
        return '↘️';
      case 'neutral':
        return '➡️';
      default:
        return '➡️';
    }
  };

  if (!insights || insights.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border p-6 ${className}`}>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">मुख्य अंतर्दृष्टि</h3>
          <p className="text-sm text-gray-600">डेटा से प्राप्त मुख्य अंतर्दृष्टि</p>
        </div>
        <div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
          data-testid="key-insights-cards"
        >
          <div className="flex items-center justify-center h-32 text-gray-500">
            कोई अंतर्दृष्टि उपलब्ध नहीं
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-6 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">मुख्य अंतर्दृष्टि</h3>
        <p className="text-sm text-gray-600">डेटा से प्राप्त मुख्य अंतर्दृष्टि</p>
      </div>

      <div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        data-testid="key-insights-cards"
      >
        {insights.map((insight) => (
          <div
            key={insight.id}
            className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow duration-200"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-2xl">{insight.icon}</div>
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${getTrendColor(insight.trend)}`}>
                <span className="mr-1">{getTrendIcon(insight.trend)}</span>
                {insight.change}
              </div>
            </div>
            
            <div className="mb-2">
              <h4 className="text-sm font-medium text-gray-900 mb-1">
                {insight.title}
              </h4>
              <div className="text-2xl font-bold text-gray-800">
                {insight.value}
              </div>
            </div>
            
            <div className="text-xs text-gray-600">
              {insight.description}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          <strong>कुल अंतर्दृष्टि:</strong> {insights.length} मुख्य मेट्रिक्स
        </div>
      </div>
    </div>
  );
}
