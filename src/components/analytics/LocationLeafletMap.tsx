'use client';

import React, { useEffect, useRef, useState } from 'react';

interface LocationData {
  location: string;
  count: number;
  lat?: number;
  lng?: number;
}

interface LocationLeafletMapProps {
  data: LocationData[];
  title: string;
  className?: string;
  width?: number;
  height?: number;
}

export default function LocationLeafletMap({
  data,
  title,
  className = '',
  width = 800,
  height = 400
}: LocationLeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [filteredData, setFilteredData] = useState<LocationData[]>([]);

  // Process data
  useEffect(() => {
    if (!data || data.length === 0) {
      setFilteredData([]);
      return;
    }

    setFilteredData(data);
  }, [data]);

  // Mock Leaflet map rendering for testing
  useEffect(() => {
    if (!mapRef.current || filteredData.length === 0) return;

    // Create a simple placeholder map for testing
    const mapElement = mapRef.current;
    mapElement.innerHTML = ''; // Clear existing content

    const mapPlaceholder = document.createElement('div');
    mapPlaceholder.className = 'w-full h-full bg-green-100 border-2 border-green-300 rounded-lg flex items-center justify-center text-green-700';
    mapPlaceholder.textContent = 'Leaflet Map Placeholder';
    mapElement.appendChild(mapPlaceholder);

  }, [filteredData, width, height]);

  if (!filteredData || filteredData.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border p-6 ${className}`}>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="border rounded-lg p-4 bg-gray-50">
          <div
            ref={mapRef}
            className="w-full h-80"
            data-testid="location-leaflet-map"
          />
        </div>
        <div className="flex items-center justify-center h-64 text-gray-500">
          कोई डेटा उपलब्ध नहीं
        </div>
      </div>
    );
  }

  const totalCount = filteredData.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-6 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>

      <div className="space-y-4">
        {/* Map */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <div
            ref={mapRef}
            className="w-full h-80"
            data-testid="location-leaflet-map"
          />
        </div>

        {/* Legend/Data Display */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {filteredData.map((item, index) => {
            const locationColors = {
              'रायपुर': '#3b82f6',
              'बिलासपुर': '#10b981',
              'रायगढ़': '#f59e0b',
              'दुर्ग': '#ef4444',
              'कोरबा': '#8b5cf6',
              'जगदलपुर': '#06b6d4',
            };
            
            return (
              <div key={index} className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-900 mb-1">
                  {item.location}
                </div>
                <div className="text-xs text-gray-600 mb-1">
                  {item.count} पोस्ट्स
                </div>
                <div 
                  className="w-full h-2 rounded-full mx-auto"
                  style={{ 
                    backgroundColor: locationColors[item.location as keyof typeof locationColors] || '#6b7280'
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>कुल: {totalCount}</span>
            <span>
              सबसे अधिक: {filteredData.reduce((max, item) => 
                item.count > max.count ? item : max
              ).location}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
