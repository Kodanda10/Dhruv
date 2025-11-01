'use client';

import React from 'react';

export type LocationViewType = 'bar' | 'leaflet' | 'svg';

interface LocationToggleProps {
  currentView: LocationViewType;
  onViewChange: (view: LocationViewType) => void;
  className?: string;
}

export default function LocationToggle({
  currentView,
  onViewChange,
  className = ''
}: LocationToggleProps) {
  const viewOptions = [
    {
      id: 'bar' as LocationViewType,
      label: 'बार चार्ट',
      description: 'सरल बार चार्ट के साथ स्थान वितरण देखें',
      icon: '📊'
    },
    {
      id: 'leaflet' as LocationViewType,
      label: 'इंटरैक्टिव मानचित्र',
      description: 'इंटरैक्टिव मानचित्र के साथ स्थान देखें',
      icon: '🗺️'
    },
    {
      id: 'svg' as LocationViewType,
      label: 'SVG मानचित्र',
      description: 'SVG मानचित्र के साथ जिला दृश्य देखें',
      icon: '🗺️'
    }
  ];

  const handleKeyDown = (event: React.KeyboardEvent, view: LocationViewType) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onViewChange(view);
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-6 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">स्थान दृश्य विकल्प</h3>
        <p className="text-sm text-gray-600">स्थान डेटा देखने के लिए दृश्य प्रकार चुनें</p>
      </div>

      <div 
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
        data-testid="location-toggle"
        role="group"
        aria-label="स्थान दृश्य विकल्प"
      >
        {viewOptions.map((option) => (
          <button
            key={option.id}
            onClick={() => onViewChange(option.id)}
            onKeyDown={(e) => handleKeyDown(e, option.id)}
            className={`
              p-4 rounded-lg border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              ${currentView === option.id 
                ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                : 'bg-gray-200 text-gray-700 border-gray-300 hover:bg-gray-300'
              }
            `}
            aria-pressed={currentView === option.id}
            aria-describedby={`${option.id}-description`}
          >
            <div className="text-center">
              <div className="text-2xl mb-2">{option.icon}</div>
              <div className="font-semibold mb-1">{option.label}</div>
              <div 
                id={`${option.id}-description`}
                className="text-xs opacity-75"
              >
                {option.description}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <div className="text-sm text-blue-800">
          <strong>वर्तमान दृश्य:</strong> {viewOptions.find(opt => opt.id === currentView)?.label}
        </div>
        <div className="text-xs text-blue-600 mt-1">
          {viewOptions.find(opt => opt.id === currentView)?.description}
        </div>
      </div>
    </div>
  );
}
