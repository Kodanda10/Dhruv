'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface DayOfWeekData {
  day: string;
  count: number;
  percentage?: number;
}

interface DayOfWeekChartProps {
  data: DayOfWeekData[];
  className?: string;
  width?: number;
  height?: number;
}

export default function DayOfWeekChart({
  data,
  className = '',
  width = 800,
  height = 400
}: DayOfWeekChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [filteredData, setFilteredData] = useState<DayOfWeekData[]>([]);

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
      rect.setAttribute('fill', '#3b82f6');
      rect.setAttribute('rx', '4');

      chartGroup.appendChild(rect);
    });

    svg.appendChild(chartGroup);

  }, [filteredData, width, height]);

  if (!filteredData || filteredData.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border p-6 ${className}`}>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">दिन के अनुसार गतिविधि</h3>
          <p className="text-sm text-gray-600">सप्ताह के दिनों में पोस्टिंग पैटर्न</p>
        </div>
        <div className="border rounded-lg p-4 bg-gray-50">
          <svg
            ref={svgRef}
            width={width}
            height={height}
            className="w-full h-auto"
            data-testid="day-of-week-chart"
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
        <h3 className="text-lg font-semibold text-gray-900">दिन के अनुसार गतिविधि</h3>
        <p className="text-sm text-gray-600">सप्ताह के दिनों में पोस्टिंग पैटर्न</p>
      </div>

      <div className="space-y-4">
        {/* Chart */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <svg
            ref={svgRef}
            width={width}
            height={height}
            className="w-full h-auto"
            data-testid="day-of-week-chart"
          />
        </div>

        {/* Legend/Data Display */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {filteredData.map((item, index) => (
            <div key={index} className="text-center">
              <div className="text-sm font-medium text-gray-900 mb-1">
                {item.day}
              </div>
              <div className="text-xs text-gray-600">
                {item.count} ({item.percentage}%)
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>कुल: {totalCount}</span>
            <span>
              सबसे अधिक: {filteredData.reduce((max, item) => 
                item.count > max.count ? item : max
              ).day}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
