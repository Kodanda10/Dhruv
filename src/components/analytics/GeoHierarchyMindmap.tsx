'use client';

import React, { useState, useMemo } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';

interface GeoHierarchyMindmapProps {
  data?: any;
  className?: string;
}

export default function GeoHierarchyMindmap({
  data,
  className = '',
}: GeoHierarchyMindmapProps) {
  const [selectedLevel, setSelectedLevel] = useState<'district' | 'assembly' | 'block'>('district');

  // Mock data for demonstration
  const mockData = [
    { name: 'रायपुर', value: 450, level: 'district' },
    { name: 'बिलासपुर', value: 320, level: 'district' },
    { name: 'रायगढ़', value: 280, level: 'district' },
    { name: 'कोरबा', value: 190, level: 'district' },
    { name: 'रायपुर ग्रामीण', value: 150, level: 'district' }
  ];

  const displayData = data || mockData;

  const getColor = (value: number) => {
    const intensity = Math.min(value / 500, 1);
    return `hsl(${200 - intensity * 60}, 70%, ${50 + intensity * 20}%)`;
  };

  const renderCell = (entry: any) => {
    const { x, y, width: w, height: h, payload } = entry;
    const node = payload;

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill={getColor(node.value)}
          stroke="#1E293B"
          strokeWidth={2}
        />
        {w > 60 && h > 30 && (
          <text
            x={x + w / 2}
            y={y + h / 2}
            textAnchor="middle"
            fill="#1E293B"
            fontSize={Math.min(w / 10, 14)}
            fontWeight="bold"
          >
            {node.value}
          </text>
        )}
        {w > 80 && h > 40 && (
          <text
            x={x + w / 2}
            y={y + h / 2 + 16}
            textAnchor="middle"
            fill="#1E293B"
            fontSize={Math.min(w / 15, 12)}
          >
            {node.name.length > 15 ? `${node.name.substring(0, 15)}...` : node.name}
          </text>
        )}
      </g>
    );
  };

  return (
    <div className={`bg-[#192734] border border-gray-800 rounded-xl p-6 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-2">
          भू-पदानुक्रम माइंडमैप
        </h3>
        <p className="text-gray-400 text-sm">जिलों के अनुसार घटनाओं का वितरण</p>
      </div>

      <div style={{ width: '100%', height: 400 }}>
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={displayData}
            dataKey="value"
            content={renderCell}
          >
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const node = payload[0].payload;
                return (
                  <div className="bg-[#1F2937] border border-gray-700 rounded-lg p-3 shadow-lg">
                    <p className="text-white font-semibold mb-1">{node.name}</p>
                    <p className="text-gray-300 text-sm">घटनाएं: {node.value}</p>
                  </div>
                );
              }}
            />
          </Treemap>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span>कम गतिविधि</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-cyan-400 rounded"></div>
            <span>अधिक गतिविधि</span>
          </div>
        </div>
        <div>
          कुल: {displayData.reduce((sum: number, node: any) => sum + node.value, 0)} घटनाएं
        </div>
      </div>
    </div>
  );
}
