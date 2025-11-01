'use client';

import React, { useEffect, useRef, useState } from 'react';

interface LocationData {
  location: string;
  count: number;
  district?: string;
}

interface LocationSVGMapProps {
  data: LocationData[];
  title: string;
  className?: string;
  width?: number;
  height?: number;
}

export default function LocationSVGMap({
  data,
  title,
  className = '',
  width = 800,
  height = 400
}: LocationSVGMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [filteredData, setFilteredData] = useState<LocationData[]>([]);

  // Process data
  useEffect(() => {
    if (!data || data.length === 0) {
      setFilteredData([]);
      return;
    }

    setFilteredData(data);
  }, [data]);

  // Mock SVG map rendering for testing
  useEffect(() => {
    if (!svgRef.current || filteredData.length === 0) return;

    const svg = svgRef.current;
    svg.innerHTML = ''; // Clear existing content

    // Create a simple placeholder SVG map for testing
    const mapGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    mapGroup.setAttribute('transform', 'translate(40,20)');

    // Add simple district representation
    const districtWidth = (width - 80) / filteredData.length;
    const maxCount = Math.max(...filteredData.map(d => d.count));
    
    filteredData.forEach((item, index) => {
      const districtHeight = (item.count / maxCount) * (height - 80);
      const x = index * districtWidth;
      const y = height - 60 - districtHeight;

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x.toString());
      rect.setAttribute('y', y.toString());
      rect.setAttribute('width', (districtWidth - 4).toString());
      rect.setAttribute('height', districtHeight.toString());
      
      // Color based on district
      const districtColors = {
        'raipur': '#3b82f6', // blue
        'bilaspur': '#10b981', // green
        'raigarh': '#f59e0b', // amber
        'durg': '#ef4444', // red
        'korba': '#8b5cf6', // purple
        'jagdalpur': '#06b6d4', // cyan
      };
      
      rect.setAttribute('fill', districtColors[item.district as keyof typeof districtColors] || '#6b7280');
      rect.setAttribute('rx', '4');

      mapGroup.appendChild(rect);
    });

    svg.appendChild(mapGroup);

  }, [filteredData, width, height]);

  if (!filteredData || filteredData.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border p-6 ${className}`}>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="border rounded-lg p-4 bg-gray-50">
          <svg
            ref={svgRef}
            width={width}
            height={height}
            className="w-full h-auto"
            data-testid="location-svg-map"
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
          <svg
            ref={svgRef}
            width={width}
            height={height}
            className="w-full h-auto"
            data-testid="location-svg-map"
          />
        </div>

        {/* Legend/Data Display */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {filteredData.map((item, index) => {
            const districtColors = {
              'raipur': '#3b82f6',
              'bilaspur': '#10b981',
              'raigarh': '#f59e0b',
              'durg': '#ef4444',
              'korba': '#8b5cf6',
              'jagdalpur': '#06b6d4',
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
                    backgroundColor: districtColors[item.district as keyof typeof districtColors] || '#6b7280'
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
