'use client';

import React, { useState, useMemo } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';

interface GeoHierarchyMindmapProps {
  data?: any;
  filters?: any;
  onFilterChange?: (filters: any) => void;
  className?: string;
}

interface DrilldownState {
  level: 'district' | 'assembly' | 'block';
  selectedPath: string[];
  currentData: any[];
}

export default function GeoHierarchyMindmap({
  data,
  filters,
  onFilterChange,
  className = '',
}: GeoHierarchyMindmapProps) {
  // Drilldown state management
  const [drilldown, setDrilldown] = useState<DrilldownState | null>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  // Enhanced mock data with hierarchical structure
  const mockDistrictData = [
    { name: 'रायपुर', value: 450, level: 'district', district: 'रायपुर' },
    { name: 'बिलासपुर', value: 320, level: 'district', district: 'बिलासपुर' },
    { name: 'रायगढ़', value: 280, level: 'district', district: 'रायगढ़' },
    { name: 'कोरबा', value: 190, level: 'district', district: 'कोरबा' },
    { name: 'रायपुर ग्रामीण', value: 150, level: 'district', district: 'रायपुर ग्रामीण' }
  ];

  // Assembly data for each district
  const mockAssemblyData = {
    'रायपुर': [
      { name: 'रायपुर शहर', value: 280, level: 'assembly', district: 'रायपुर', assembly: 'रायपुर शहर' },
      { name: 'रायपुर ग्रामीण', value: 170, level: 'assembly', district: 'रायपुर', assembly: 'रायपुर ग्रामीण' }
    ],
    'बिलासपुर': [
      { name: 'बिलासपुर', value: 200, level: 'assembly', district: 'बिलासपुर', assembly: 'बिलासपुर' },
      { name: 'मस्तूरी', value: 120, level: 'assembly', district: 'बिलासपुर', assembly: 'मस्तूरी' }
    ],
    'रायगढ़': [
      { name: 'रायगढ़', value: 180, level: 'assembly', district: 'रायगढ़', assembly: 'रायगढ़' },
      { name: 'खरसिया', value: 100, level: 'assembly', district: 'रायगढ़', assembly: 'खरसिया' }
    ],
    'कोरबा': [
      { name: 'कोरबा', value: 120, level: 'assembly', district: 'कोरबा', assembly: 'कोरबा' },
      { name: 'कटघोरा', value: 70, level: 'assembly', district: 'कोरबा', assembly: 'कटघोरा' }
    ],
    'रायपुर ग्रामीण': [
      { name: 'अरंग', value: 80, level: 'assembly', district: 'रायपुर ग्रामीण', assembly: 'अरंग' },
      { name: 'धरसींवा', value: 70, level: 'assembly', district: 'रायपुर ग्रामीण', assembly: 'धरसींवा' }
    ]
  };

  // Determine display data based on drilldown state
  const displayData = useMemo(() => {
    if (drilldown) {
      return drilldown.currentData;
    }
    return data || mockDistrictData;
  }, [data, drilldown]);

  const getColor = (value: number) => {
    const intensity = Math.min(value / 500, 1);
    return `hsl(${200 - intensity * 60}, 70%, ${50 + intensity * 20}%)`;
  };

  // Handle node click for drilldown
  const handleNodeClick = (node: any) => {
    if (node.level === 'district') {
      // Drill down to assemblies in this district
      const assemblies = mockAssemblyData[node.district] || [];
      setDrilldown({
        level: 'assembly',
        selectedPath: [node.district],
        currentData: assemblies,
      });
      setSelectedNode(node);
    } else if (node.level === 'assembly') {
      // Could drill down further to blocks, but keeping it simple for now
      setSelectedNode(node);
    }
  };

  // Handle breadcrumb navigation
  const handleBreadcrumbClick = (pathIndex: number) => {
    if (!drilldown || pathIndex < 0) {
      // Go back to root
      setDrilldown(null);
      setSelectedNode(null);
      return;
    }

    const newPath = drilldown.selectedPath.slice(0, pathIndex + 1);

    if (newPath.length === 1) {
      // Back to district level
      setDrilldown(null);
      setSelectedNode(null);
    } else {
      // Navigate to specific level (could be enhanced for deeper navigation)
      const district = newPath[0];
      const assemblies = mockAssemblyData[district] || [];
      setDrilldown({
        level: 'assembly',
        selectedPath: newPath,
        currentData: assemblies,
      });
    }
  };

  const renderCell = (entry: any) => {
    const { x, y, width: w, height: h, payload } = entry;
    const node = payload;
    const hasChildren = node.level === 'district' && mockAssemblyData[node.district]?.length > 0;
    const isSelected = selectedNode?.name === node.name;

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill={getColor(node.value)}
          stroke={isSelected ? "#FFD700" : "#1E293B"}
          strokeWidth={isSelected ? 3 : 2}
          style={{
            cursor: hasChildren ? 'pointer' : 'default',
            filter: isSelected ? 'brightness(1.2)' : 'none'
          }}
          onClick={() => handleNodeClick(node)}
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
        {/* Expand indicator */}
        {hasChildren && w > 50 && h > 30 && (
          <g>
            <circle
              cx={x + w - 12}
              cy={y + 12}
              r={8}
              fill="#1E293B"
              opacity={0.8}
            />
            <text
              x={x + w - 12}
              y={y + 16}
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize={10}
              fontWeight="bold"
              pointerEvents="none"
            >
              +
            </text>
          </g>
        )}
      </g>
    );
  };

  return (
    <div className={`bg-[#192734] border border-gray-800 rounded-xl p-6 ${className}`}>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-white">
            भू-पदानुक्रम माइंडमैप
          </h3>
          {/* Export buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                const csvData = [
                  ['Location', 'Level', 'Event Count', 'District', 'Assembly'].join(','),
                  ...displayData.map((node: any) =>
                    [node.name, node.level, node.value, node.district || '', node.assembly || ''].join(',')
                  )
                ].join('\n');

                const blob = new Blob([csvData], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `geo-hierarchy-${Date.now()}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
            >
              CSV
            </button>
            <button
              onClick={() => {
                const jsonData = JSON.stringify({
                  level: drilldown?.level || 'district',
                  path: drilldown?.selectedPath || [],
                  data: displayData,
                  exportedAt: new Date().toISOString(),
                }, null, 2);

                const blob = new Blob([jsonData], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `geo-hierarchy-${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
            >
              JSON
            </button>
          </div>
        </div>

        {/* Breadcrumb navigation */}
        {drilldown && (
          <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
            <button
              onClick={() => handleBreadcrumbClick(-1)}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
            >
              🏠 Root
            </button>
            <span className="text-gray-500">→</span>
            {drilldown.selectedPath.map((segment, index) => (
              <React.Fragment key={index}>
                <button
                  onClick={() => handleBreadcrumbClick(index)}
                  className="px-2 py-1 bg-blue-700 hover:bg-blue-600 rounded text-xs transition-colors"
                >
                  {segment}
                </button>
                {index < drilldown.selectedPath.length - 1 && (
                  <span className="text-gray-500">→</span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        <p className="text-gray-400 text-sm">
          {drilldown
            ? `${drilldown.level === 'assembly' ? 'विधानसभा' : 'जिला'} स्तर पर घटनाओं का वितरण`
            : 'जिलों के अनुसार घटनाओं का वितरण'
          }
        </p>
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
                    {node.district && (
                      <p className="text-gray-400 text-xs">जिला: {node.district}</p>
                    )}
                    {node.assembly && (
                      <p className="text-gray-400 text-xs">विधानसभा: {node.assembly}</p>
                    )}
                    {node.level && (
                      <p className="text-gray-400 text-xs">स्तर: {node.level}</p>
                    )}
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
          {drilldown && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-yellow-400 rounded"></div>
              <span>चयनित</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span>
            {drilldown ? `${drilldown.level === 'assembly' ? 'विधानसभा' : 'जिला'} स्तर:` : 'जिला स्तर:'} {displayData.length} क्षेत्र
          </span>
          <span>
            कुल: {displayData.reduce((sum: number, node: any) => sum + node.value, 0)} घटनाएं
          </span>
        </div>
      </div>
    </div>
  );
}
