'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Treemap, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type {
  GeoHierarchyMindmapProps,
  GeoHierarchyNode,
  DrilldownState,
  GeoAnalyticsSummaryResponse,
  GeoHierarchyExportData,
} from '@/types/geo-analytics';

/**
 * GeoHierarchyMindmap Component
 * 
 * Interactive treemap visualization of geo-hierarchy data.
 * Shows districts, assemblies, blocks, and villages/ULBs in a hierarchical treemap.
 * 
 * Features:
 * - Root level: Districts sized by event count
 * - Click to drill down through hierarchy
 * - Color gradient based on event count
 * - Breadcrumb navigation
 * - Export capabilities
 */
export default function GeoHierarchyMindmap({
  data: propData,
  filters,
  onFilterChange,
  className = '',
  height = 600,
  width,
}: GeoHierarchyMindmapProps) {
  // Internal state
  const [data, setData] = useState(propData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Drilldown state
  const [drilldown, setDrilldown] = useState<DrilldownState | null>(null);
  const [selectedNode, setSelectedNode] = useState<GeoHierarchyNode | null>(null);

  // Fetch data from API when filters change
  useEffect(() => {
    // If propData is provided, use it (controlled mode)
    if (propData) {
      setData(propData);
      return;
    }

    // Otherwise, fetch from API (uncontrolled mode)
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Build query parameters
        const params = new URLSearchParams();
        if (filters?.start_date) {
          params.append('startDate', filters.start_date);
        }
        if (filters?.end_date) {
          params.append('endDate', filters.end_date);
        }
        if (filters?.event_type) {
          params.append('event_type', filters.event_type);
        }

        const url = `/api/geo-analytics/summary${params.toString() ? `?${params.toString()}` : ''}`;
        const response = await fetch(url);
        const result: GeoAnalyticsSummaryResponse = await response.json();

        if (result.success && result.data) {
          setData(result.data);
        } else {
          setError(result.message || 'Failed to load geo analytics data');
        }
      } catch (err) {
        console.error('Error fetching geo analytics:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filters, propData]);

  // Transform API data into treemap-compatible format
  const treemapData = useMemo(() => {
    if (!data) return [];

    // Build hierarchical structure from API data
    const hierarchyMap = new Map<string, GeoHierarchyNode>();

    // Process districts (root level)
    data.by_district.forEach((district) => {
      const node: GeoHierarchyNode = {
        name: district.district,
        value: district.event_count,
        level: 'district',
        district: district.district,
        path: [district.district],
        children: [],
      };
      hierarchyMap.set(district.district, node);
    });

    // Process assemblies (second level)
    data.by_assembly.forEach((assembly: { district: string; assembly: string; event_count: number }) => {
      const districtNode = hierarchyMap.get(assembly.district);
      if (districtNode) {
        const assemblyNode: GeoHierarchyNode = {
          name: assembly.assembly,
          value: assembly.event_count,
          level: 'assembly',
          district: assembly.district,
          assembly: assembly.assembly,
          path: [assembly.district, assembly.assembly],
          children: [],
        };
        if (!districtNode.children) {
          districtNode.children = [];
        }
        districtNode.children.push(assemblyNode);
      }
    });

    // Process blocks (third level)
    data.by_block.forEach((block: { district: string; assembly: string; block: string; event_count: number }) => {
      const districtNode = hierarchyMap.get(block.district);
      if (districtNode && districtNode.children) {
        const assemblyNode = districtNode.children.find(
          (child) => child.assembly === block.assembly
        );
        if (assemblyNode) {
          const blockNode: GeoHierarchyNode = {
            name: block.block,
            value: block.event_count,
            level: 'block',
            district: block.district,
            assembly: block.assembly,
            block: block.block,
            path: [block.district, block.assembly, block.block],
            children: [],
          };
          if (!assemblyNode.children) {
            assemblyNode.children = [];
          }
          assemblyNode.children.push(blockNode);
        }
      }
    });

    // Convert map to array for recharts
    return Array.from(hierarchyMap.values());
  }, [data]);

  // Get current data to display based on drilldown state
  const displayData = useMemo(() => {
    if (!drilldown || drilldown.selectedPath.length === 0) {
      // Root level: show districts
      return treemapData;
    }

    // Find the selected node's children by traversing the path
    const findNodeByPath = (
      nodes: GeoHierarchyNode[],
      path: string[],
      currentIndex: number = 0
    ): GeoHierarchyNode | null => {
      if (currentIndex >= path.length) return null;

      const targetName = path[currentIndex];
      const node = nodes.find((n) => n.name === targetName);

      if (!node) return null;

      if (currentIndex === path.length - 1) {
        // Found the target node
        return node;
      }

      // Continue searching in children
      if (node.children && node.children.length > 0) {
        return findNodeByPath(node.children, path, currentIndex + 1);
      }

      return null;
    };

    const targetNode = findNodeByPath(treemapData, drilldown.selectedPath);
    return targetNode?.children || [];
  }, [drilldown, treemapData]);

  // Calculate color based on event count
  const getColor = (value: number, maxValue: number): string => {
    if (maxValue === 0) return '#10B981';
    const intensity = Math.min(value / maxValue, 1);
    // Gradient from light green (#D1FAE5) to dark green (#10B981)
    const r = Math.round(209 - (209 - 16) * intensity);
    const g = Math.round(250 - (250 - 185) * intensity);
    const b = Math.round(229 - (229 - 129) * intensity);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const maxValue = useMemo(() => {
    if (displayData.length === 0) return 1;
    return Math.max(...displayData.map((node: GeoHierarchyNode) => node.value));
  }, [displayData]);

  // Handle node click for drilldown
  const handleNodeClick = (node: GeoHierarchyNode) => {
    if (node.children && node.children.length > 0) {
      setDrilldown({
        level: getNextLevel(node.level || 'district'),
        selectedPath: node.path || [],
        currentData: displayData,
      });
      setSelectedNode(node);
    }
  };

  // Get next level in hierarchy
  const getNextLevel = (
    currentLevel: 'district' | 'assembly' | 'block' | 'village' | 'ulb'
  ): 'district' | 'assembly' | 'block' | 'village' | 'ulb' => {
    const levels: ('district' | 'assembly' | 'block' | 'village' | 'ulb')[] = [
      'district',
      'assembly',
      'block',
      'village',
      'ulb',
    ];
    const currentIndex = levels.indexOf(currentLevel);
    return levels[Math.min(currentIndex + 1, levels.length - 1)];
  };

  // Navigate back up hierarchy
  const handleBack = () => {
    if (!drilldown) return;

    // Remove last element from path
    const newPath = drilldown.selectedPath.slice(0, -1);
    if (newPath.length === 0) {
      // Back to root
      setDrilldown(null);
      setSelectedNode(null);
    } else {
      // Go up one level
      const newLevel = getPreviousLevel(drilldown.level);
      setDrilldown({
        level: newLevel,
        selectedPath: newPath,
        currentData: [],
      });
    }
  };

  // Navigate to specific level in breadcrumb
  const handleBreadcrumbClick = (index: number) => {
    const targetPath = drilldown?.selectedPath.slice(0, index + 1) || [];
    if (targetPath.length === 0) {
      setDrilldown(null);
      setSelectedNode(null);
    } else {
      const levels: ('district' | 'assembly' | 'block' | 'village' | 'ulb')[] = [
        'district',
        'assembly',
        'block',
        'village',
        'ulb',
      ];
      setDrilldown({
        level: levels[Math.min(index, levels.length - 1)],
        selectedPath: targetPath,
        currentData: [],
      });
    }
  };

  // Flatten hierarchy for export
  const flattenHierarchy = (nodes: GeoHierarchyNode[]): GeoHierarchyExportData[] => {
    const result: GeoHierarchyExportData[] = [];

    const traverse = (node: GeoHierarchyNode) => {
      const exportItem: GeoHierarchyExportData = {
        hierarchy_path: node.path?.join(' → ') || node.name,
        event_count: node.value,
        location_type: node.level || 'district',
        district: node.district || '',
        assembly: node.assembly,
        block: node.block,
        village: node.village,
        ulb: node.ulb,
        is_urban: node.is_urban,
      };
      result.push(exportItem);

      if (node.children) {
        node.children.forEach(traverse);
      }
    };

    nodes.forEach(traverse);
    return result;
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!data) return;

    const exportData = flattenHierarchy(treemapData);
    const headers = [
      'Hierarchy Path',
      'Event Count',
      'Location Type',
      'District',
      'Assembly',
      'Block',
      'Village',
      'ULB',
      'Is Urban',
    ];

    const csvRows = [
      headers.join(','),
      ...exportData.map((row) =>
        [
          `"${row.hierarchy_path}"`,
          row.event_count,
          row.location_type,
          `"${row.district}"`,
          row.assembly ? `"${row.assembly}"` : '',
          row.block ? `"${row.block}"` : '',
          row.village ? `"${row.village}"` : '',
          row.ulb ? `"${row.ulb}"` : '',
          row.is_urban ? 'Yes' : 'No',
        ].join(',')
      ),
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `geo-hierarchy-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to JSON
  const handleExportJSON = () => {
    if (!data) return;

    const exportData = flattenHierarchy(treemapData);
    const jsonContent = JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        filters: filters || {},
        data: exportData,
      },
      null,
      2
    );

    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `geo-hierarchy-${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get previous level
  const getPreviousLevel = (
    currentLevel: 'district' | 'assembly' | 'block' | 'village' | 'ulb'
  ): 'district' | 'assembly' | 'block' | 'village' | 'ulb' => {
    const levels: ('district' | 'assembly' | 'block' | 'village' | 'ulb')[] = [
      'district',
      'assembly',
      'block',
      'village',
      'ulb',
    ];
    const currentIndex = levels.indexOf(currentLevel);
    return levels[Math.max(currentIndex - 1, 0)];
  };

  // Custom cell renderer with event count badge
  const renderCell = (entry: any) => {
    const { x, y, width: w, height: h, payload } = entry;
    const node = payload as GeoHierarchyNode;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill={getColor(node.value, maxValue)}
          stroke="#1E293B"
          strokeWidth={2}
          style={{ cursor: hasChildren ? 'pointer' : 'default' }}
          onClick={() => hasChildren && handleNodeClick(node)}
          role={hasChildren ? 'button' : 'img'}
          tabIndex={hasChildren ? 0 : -1}
          aria-label={`${node.name}: ${node.value} events${hasChildren ? ', press Enter or Space to expand' : ''}`}
        />
        {/* Event count badge */}
        {w > 60 && h > 30 && (
          <text
            x={x + w / 2}
            y={y + h / 2}
            textAnchor="middle"
            fill="#1E293B"
            fontSize={Math.min(w / 10, 14)}
            fontWeight="bold"
            pointerEvents="none"
          >
            {node.value}
          </text>
        )}
        {/* Location name */}
        {w > 80 && h > 40 && (
          <text
            x={x + w / 2}
            y={y + h / 2 + 16}
            textAnchor="middle"
            fill="#1E293B"
            fontSize={Math.min(w / 15, 12)}
            pointerEvents="none"
          >
            {node.name.length > 15 ? `${node.name.substring(0, 15)}...` : node.name}
          </text>
        )}
        {/* Expand indicator - chevron icon */}
        {hasChildren && w > 50 && h > 30 && (
          <g>
            <path
              d={`M ${x + w - 16} ${y + 8} L ${x + w - 8} ${y + h / 2} L ${x + w - 16} ${y + h - 8}`}
              fill="#1E293B"
              stroke="#1E293B"
              strokeWidth={1.5}
              pointerEvents="none"
            />
            <text
              x={x + w - 6}
              y={y + h / 2 + 4}
              fill="#1E293B"
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

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const node = payload[0].payload as GeoHierarchyNode;

    return (
      <div className="bg-[#1F2937] border border-gray-700 rounded-lg p-3 shadow-lg">
        <p className="text-white font-semibold mb-1">{node.name}</p>
        <p className="text-gray-300 text-sm">
          Events: <span className="text-green-400 font-bold">{node.value}</span>
        </p>
        {node.path && node.path.length > 0 && (
          <p className="text-gray-400 text-xs mt-1">
            Path: {node.path.join(' → ')}
          </p>
        )}
        {node.level && (
          <p className="text-gray-400 text-xs">Level: {node.level}</p>
        )}
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div
        className={`bg-[#192734] border border-gray-800 rounded-xl p-6 ${className}`}
        data-testid="geo-hierarchy-mindmap"
      >
        <h3 className="text-lg font-semibold mb-4 text-white">
          भू-पदानुक्रम माइंडमैप
        </h3>
        <div className="flex items-center justify-center h-64 text-gray-400">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p>डेटा लोड हो रहा है...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={`bg-[#192734] border border-gray-800 rounded-xl p-6 ${className}`}
        data-testid="geo-hierarchy-mindmap"
      >
        <h3 className="text-lg font-semibold mb-4 text-white">
          भू-पदानुक्रम माइंडमैप
        </h3>
        <div className="flex items-center justify-center h-64 text-red-400">
          <div className="text-center">
            <p className="mb-2">❌ {error}</p>
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              पुनः प्रयास करें
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!data || displayData.length === 0) {
    return (
      <div
        className={`bg-[#192734] border border-gray-800 rounded-xl p-6 ${className}`}
        data-testid="geo-hierarchy-mindmap"
      >
        <h3 className="text-lg font-semibold mb-4 text-white">
          भू-पदानुक्रम माइंडमैप
        </h3>
        <div className="flex items-center justify-center h-64 text-gray-400">
          <p>कोई डेटा उपलब्ध नहीं है</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-[#192734] border border-gray-800 rounded-xl p-6 ${className}`}
      data-testid="geo-hierarchy-mindmap"
    >
      {/* Header with breadcrumb */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">
            भू-पदानुक्रम माइंडमैप
          </h3>
          {drilldown && drilldown.selectedPath.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <button
                onClick={handleBack}
                className="text-blue-400 hover:text-blue-300 transition-colors px-2 py-1 rounded hover:bg-blue-900/20"
                aria-label="Go back to previous level"
              >
                ← Back
              </button>
              <span className="text-gray-500">|</span>
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  onClick={() => {
                    setDrilldown(null);
                    setSelectedNode(null);
                  }}
                  className="text-gray-400 hover:text-white transition-colors px-1"
                  aria-label="Go to root level"
                >
                  Root
                </button>
                {drilldown.selectedPath.map((item: string, index: number) => (
                  <React.Fragment key={index}>
                    <span className="text-gray-500">→</span>
                    <button
                      onClick={() => handleBreadcrumbClick(index)}
                      className="text-blue-400 hover:text-blue-300 transition-colors px-1 rounded hover:bg-blue-900/20"
                      aria-label={`Go to ${item}`}
                    >
                      {item}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* Export buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            aria-label="Export to CSV"
          >
            CSV
          </button>
          <button
            onClick={handleExportJSON}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            aria-label="Export to JSON"
          >
            JSON
          </button>
        </div>
      </div>

      {/* Treemap visualization */}
      <div style={{ height: `${height}px`, width: width ? `${width}px` : '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={displayData as any}
            dataKey="value"
            aspectRatio={4 / 3}
            stroke="#1E293B"
            content={renderCell}
          >
            <Tooltip content={<CustomTooltip />} />
          </Treemap>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-sm text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#D1FAE5] border border-gray-700"></div>
          <span>कम घटनाएं</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-[#10B981] border border-gray-700"></div>
          <span>अधिक घटनाएं</span>
        </div>
        <div className="text-gray-500">
          क्लिक करें विस्तार करने के लिए
        </div>
      </div>
    </div>
  );
}

