'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface NarrativeData {
  theme: string;
  count: number;
  percentage?: number;
}

interface NarrativeClassificationChartProps {
  data: NarrativeData[];
  className?: string;
  width?: number;
  height?: number;
}

export default function NarrativeClassificationChart({
  data,
  className = '',
  width = 800,
  height = 400
}: NarrativeClassificationChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [filteredData, setFilteredData] = useState<NarrativeData[]>([]);

  // Process data and calculate percentages if not provided
  useEffect(() => {
    if (!data || data.length === 0) {
      setFilteredData([]);
      return;
    }

    const total = data.reduce((sum, item) => sum + item.count, 0);
    const processedData = data.map(item => ({
      ...item,
      percentage: item.percentage ?? Math.round((item.count / total) * 100)
    }));

    setFilteredData(processedData);
  }, [data]);

  // Render D3 chart (simplified for testing)
  useEffect(() => {
    if (!svgRef.current || filteredData.length === 0) return;

    const svg = svgRef.current;
    svg.innerHTML = ''; // Clear existing content

    // Create a simple placeholder chart for testing
    const chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    chartGroup.setAttribute('transform', 'translate(40,20)');

    // Add simple bars representation
    const barWidth = (width - 80) / filteredData.length;
    const maxCount = Math.max(...filteredData.map(d => d.count));
    
    filteredData.forEach((item, index) => {
      const barHeight = (item.count / maxCount) * (height - 80);
      const x = index * barWidth;
      const y = height - 60 - barHeight;

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x.toString());
      rect.setAttribute('y', y.toString());
      rect.setAttribute('width', (barWidth - 4).toString());
      rect.setAttribute('height', barHeight.toString());
      
      // Color based on theme type
      const themeColors = {
        'विकास': '#10b981', // green
        'श्रद्धांजलि': '#f59e0b', // amber
        'राजनीति': '#ef4444', // red
        'योजना': '#3b82f6', // blue
        'सामाजिक': '#8b5cf6', // purple
        'आर्थिक': '#06b6d4', // cyan
      };
      
      rect.setAttribute('fill', themeColors[item.theme as keyof typeof themeColors] || '#6b7280');
      rect.setAttribute('rx', '4');

      chartGroup.appendChild(rect);
    });

    svg.appendChild(chartGroup);

  }, [filteredData, width, height]);

  if (!filteredData || filteredData.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border p-6 ${className}`}>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">कथात्मक वर्गीकरण</h3>
          <p className="text-sm text-gray-600">पोस्ट्स को विषयों के अनुसार वर्गीकृत करें</p>
        </div>
        <div className="border rounded-lg p-4 bg-gray-50">
          <svg
            ref={svgRef}
            width={width}
            height={height}
            className="w-full h-auto"
            data-testid="narrative-chart"
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
        <h3 className="text-lg font-semibold text-gray-900">कथात्मक वर्गीकरण</h3>
        <p className="text-sm text-gray-600">पोस्ट्स को विषयों के अनुसार वर्गीकृत करें</p>
      </div>

      <div className="space-y-4">
        {/* Chart */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <svg
            ref={svgRef}
            width={width}
            height={height}
            className="w-full h-auto"
            data-testid="narrative-chart"
          />
        </div>

        {/* Legend/Data Display */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {filteredData.map((item, index) => {
            const themeColors = {
              'विकास': '#10b981',
              'श्रद्धांजलि': '#f59e0b',
              'राजनीति': '#ef4444',
              'योजना': '#3b82f6',
              'सामाजिक': '#8b5cf6',
              'आर्थिक': '#06b6d4',
            };
            
            return (
              <div key={index} className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-900 mb-1">
                  {item.theme}
                </div>
                <div className="text-xs text-gray-600 mb-1">
                  {item.count} ({item.percentage}%)
                </div>
                <div 
                  className="w-full h-2 rounded-full mx-auto"
                  style={{ 
                    backgroundColor: themeColors[item.theme as keyof typeof themeColors] || '#6b7280'
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
              ).theme}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
