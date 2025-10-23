'use client';

import React, { useEffect, useState } from 'react';

interface LocationData {
  location: string;
  count: number;
  percentage?: number;
  district?: string;
  state?: string;
}

interface LocationSVGMapProps {
  data: LocationData[];
  className?: string;
  width?: number;
  height?: number;
}

export default function LocationSVGMap({
  data,
  className = '',
  width = 800,
  height = 600
}: LocationSVGMapProps) {
  const [filteredData, setFilteredData] = useState<LocationData[]>([]);

  // Process data and group by district
  useEffect(() => {
    if (!data || data.length === 0) {
      setFilteredData([]);
      return;
    }

    // Group data by district and sum counts
    const districtMap = new Map<string, LocationData>();
    
    data.forEach(item => {
      const district = item.district || item.location;
      if (districtMap.has(district)) {
        const existing = districtMap.get(district)!;
        existing.count += item.count;
      } else {
        districtMap.set(district, { ...item, district });
      }
    });

    const processedData = Array.from(districtMap.values());
    setFilteredData(processedData);
  }, [data]);

  // Get color intensity based on count
  const getColorIntensity = (count: number, maxCount: number) => {
    if (maxCount === 0) return 0.1;
    const intensity = count / maxCount;
    return Math.max(0.1, intensity); // Minimum 10% opacity
  };

  // Get district color
  const getDistrictColor = (count: number, maxCount: number) => {
    const intensity = getColorIntensity(count, maxCount);
    const hue = 200 + (intensity * 60); // Blue to green gradient
    return `hsla(${hue}, 70%, 50%, ${0.3 + intensity * 0.7})`;
  };

  if (!filteredData || filteredData.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border p-6 ${className}`}>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">स्थान के अनुसार गतिविधि</h3>
          <p className="text-sm text-gray-600">छत्तीसगढ़ जिलों में पोस्टिंग वितरण - SVG मानचित्र</p>
        </div>
        <div className="border rounded-lg p-4 bg-gray-50">
          <svg
            width={width}
            height={height}
            viewBox="0 0 800 600"
            className="w-full h-auto"
            data-testid="svg-map"
          >
            {/* Simplified Chhattisgarh outline */}
            <path
              d="M 100 100 L 700 100 L 700 500 L 100 500 Z"
              fill="#f3f4f6"
              stroke="#6b7280"
              strokeWidth="2"
            />
            <text x="400" y="300" textAnchor="middle" className="text-gray-500">
              कोई डेटा उपलब्ध नहीं
            </text>
          </svg>
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...filteredData.map(d => d.count));
  const totalCount = filteredData.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-6 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">स्थान के अनुसार गतिविधि</h3>
        <p className="text-sm text-gray-600">छत्तीसगढ़ जिलों में पोस्टिंग वितरण - SVG मानचित्र</p>
      </div>

      <div className="space-y-4">
        {/* SVG Map */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <svg
            width={width}
            height={height}
            viewBox="0 0 800 600"
            className="w-full h-auto"
            data-testid="svg-map"
          >
            {/* Simplified Chhattisgarh districts */}
            <g>
              {/* Raigarh */}
              <path
                d="M 150 150 L 250 150 L 250 250 L 150 250 Z"
                fill={getDistrictColor(filteredData.find(d => d.district === 'रायगढ़')?.count || 0, maxCount)}
                stroke="#374151"
                strokeWidth="1"
                className="district-path"
                data-district="रायगढ़"
              />
              <text x="200" y="200" textAnchor="middle" className="text-xs fill-gray-700">
                रायगढ़
              </text>

              {/* Bilaspur */}
              <path
                d="M 250 150 L 350 150 L 350 250 L 250 250 Z"
                fill={getDistrictColor(filteredData.find(d => d.district === 'बिलासपुर')?.count || 0, maxCount)}
                stroke="#374151"
                strokeWidth="1"
                className="district-path"
                data-district="बिलासपुर"
              />
              <text x="300" y="200" textAnchor="middle" className="text-xs fill-gray-700">
                बिलासपुर
              </text>

              {/* Raipur */}
              <path
                d="M 350 150 L 450 150 L 450 250 L 350 250 Z"
                fill={getDistrictColor(filteredData.find(d => d.district === 'रायपुर')?.count || 0, maxCount)}
                stroke="#374151"
                strokeWidth="1"
                className="district-path"
                data-district="रायपुर"
              />
              <text x="400" y="200" textAnchor="middle" className="text-xs fill-gray-700">
                रायपुर
              </text>

              {/* Bastar */}
              <path
                d="M 150 250 L 250 250 L 250 350 L 150 350 Z"
                fill={getDistrictColor(filteredData.find(d => d.district === 'बस्तर')?.count || 0, maxCount)}
                stroke="#374151"
                strokeWidth="1"
                className="district-path"
                data-district="बस्तर"
              />
              <text x="200" y="300" textAnchor="middle" className="text-xs fill-gray-700">
                बस्तर
              </text>

              {/* Sarguja */}
              <path
                d="M 250 250 L 350 250 L 350 350 L 250 350 Z"
                fill={getDistrictColor(filteredData.find(d => d.district === 'सरगुजा')?.count || 0, maxCount)}
                stroke="#374151"
                strokeWidth="1"
                className="district-path"
                data-district="सरगुजा"
              />
              <text x="300" y="300" textAnchor="middle" className="text-xs fill-gray-700">
                सरगुजा
              </text>

              {/* Durg */}
              <path
                d="M 350 250 L 450 250 L 450 350 L 350 350 Z"
                fill={getDistrictColor(filteredData.find(d => d.district === 'दुर्ग')?.count || 0, maxCount)}
                stroke="#374151"
                strokeWidth="1"
                className="district-path"
                data-district="दुर्ग"
              />
              <text x="400" y="300" textAnchor="middle" className="text-xs fill-gray-700">
                दुर्ग
              </text>

              {/* Other districts */}
              <path
                d="M 150 350 L 250 350 L 250 450 L 150 450 Z"
                fill={getDistrictColor(0, maxCount)}
                stroke="#374151"
                strokeWidth="1"
                className="district-path"
                data-district="अन्य"
              />
              <text x="200" y="400" textAnchor="middle" className="text-xs fill-gray-700">
                अन्य
              </text>

              <path
                d="M 250 350 L 350 350 L 350 450 L 250 450 Z"
                fill={getDistrictColor(0, maxCount)}
                stroke="#374151"
                strokeWidth="1"
                className="district-path"
                data-district="अन्य2"
              />
              <text x="300" y="400" textAnchor="middle" className="text-xs fill-gray-700">
                अन्य
              </text>

              <path
                d="M 350 350 L 450 350 L 450 450 L 350 450 Z"
                fill={getDistrictColor(0, maxCount)}
                stroke="#374151"
                strokeWidth="1"
                className="district-path"
                data-district="अन्य3"
              />
              <text x="400" y="400" textAnchor="middle" className="text-xs fill-gray-700">
                अन्य
              </text>
            </g>
          </svg>
        </div>

        {/* Legend */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">जिला लेजेंड</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredData.map((item, index) => (
              <div key={index} className="flex items-center space-x-2 text-sm">
                <div 
                  className="w-4 h-4 rounded border border-white shadow-sm"
                  style={{ 
                    backgroundColor: getDistrictColor(item.count, maxCount)
                  }}
                />
                <span className="text-gray-900">{item.district}</span>
                <span className="text-gray-600">({item.count})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>कुल: {totalCount}</span>
            <span>
              सबसे अधिक: {filteredData.reduce((max, item) => 
                item.count > max.count ? item : max
              ).district}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
