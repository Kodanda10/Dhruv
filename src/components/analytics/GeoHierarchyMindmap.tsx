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
import {
  getNextLevel,
  getPreviousLevel,
  findNodeByPath,
  calculateColorByIntensity,
  flattenHierarchy as flattenHierarchyUtil,
} from '@/utils/geo-hierarchy-utils';

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
        // eslint-disable-next-line no-console
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

    const targetNode = findNodeByPath(treemapData, drilldown.selectedPath);
    return targetNode?.children || [];
  }, [drilldown, treemapData]);

  // Calculate color based on event count (using utility function)
  const getColor = calculateColorByIntensity;

  const maxValue = useMemo(() => {
    if (displayData.length === 0) return 1;
    return Math.max(...displayData.map((node: GeoHierarchyNode) => node.value));
  }, [displayData]);

  // Handle node click for drilldown
  const handleNodeClick = (node: GeoHierarchyNode) => {
    if (node.children && node.children.length > 0) {
      const nextLevel = getNextLevel(node.level || 'district');
      setDrilldown({
        level: nextLevel,
        selectedPath: node.path || [],
        currentData: displayData,
      });
      setSelectedNode(node);
      
      // Announce state change to screen readers
      const announcement = document.getElementById('drilldown-announcement');
      if (announcement) {
        announcement.textContent = `Expanded ${node.name}, now viewing ${nextLevel} level with ${node.children.length} items`;
      }
    }
  };

  // getNextLevel is imported from utils

  // Navigate back up hierarchy
  const handleBack = () => {
    if (!drilldown) return;

    // Remove last element from path
    const newPath = drilldown.selectedPath.slice(0, -1);
    if (newPath.length === 0) {
      // Back to root
      setDrilldown(null);
      setSelectedNode(null);
      
      // Announce state change to screen readers
      const announcement = document.getElementById('drilldown-announcement');
      if (announcement) {
        announcement.textContent = `Returned to root level, viewing all districts`;
      }
    } else {
      // Go up one level
      const newLevel = getPreviousLevel(drilldown.level);
      setDrilldown({
        level: newLevel,
        selectedPath: newPath,
        currentData: [],
      });
      
      // Announce state change to screen readers
      const announcement = document.getElementById('drilldown-announcement');
      if (announcement) {
        announcement.textContent = `Navigated back to ${newLevel} level`;
      }
    }
  };

  // Navigate to specific level in breadcrumb
  const handleBreadcrumbClick = (index: number) => {
    const targetPath = drilldown?.selectedPath.slice(0, index + 1) || [];
    if (targetPath.length === 0) {
      setDrilldown(null);
      setSelectedNode(null);
      
      // Announce state change to screen readers
      const announcement = document.getElementById('drilldown-announcement');
      if (announcement) {
        announcement.textContent = `Returned to root level, viewing all districts`;
      }
    } else {
      const levels: ('district' | 'assembly' | 'block' | 'village' | 'ulb')[] = [
        'district',
        'assembly',
        'block',
        'village',
        'ulb',
      ];
      const targetLevel = levels[Math.min(index, levels.length - 1)];
      setDrilldown({
        level: targetLevel,
        selectedPath: targetPath,
        currentData: [],
      });
      
      // Announce state change to screen readers
      const announcement = document.getElementById('drilldown-announcement');
      if (announcement) {
        announcement.textContent = `Navigated to ${targetPath[targetPath.length - 1]}, ${targetLevel} level`;
      }
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!data) return;

    const exportData = flattenHierarchyUtil(treemapData);
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

    const exportData = flattenHierarchyUtil(treemapData);
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

  // getPreviousLevel is imported from utils

  // Handle keyboard navigation for treemap cells
  const handleCellKeyDown = (e: React.KeyboardEvent, node: GeoHierarchyNode) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (node.children && node.children.length > 0) {
        handleNodeClick(node);
      }
    }
  };

  // Custom cell renderer with event count badge
  const renderCell = (entry: any) => {
    const { x, y, width: w, height: h, payload } = entry;
    const node = payload as GeoHierarchyNode;
    const hasChildren = node.children && node.children.length > 0;
    const nodeId = `treemap-node-${node.name.replace(/\s+/g, '-')}`;
    const ariaLabel = `${node.name}, ${node.value} event${node.value !== 1 ? 's' : ''}${hasChildren ? `. Press Enter or Space to view ${node.children?.length || 0} child ${(node.children?.length || 0) === 1 ? 'item' : 'items'}` : ', no sub-items'}`;

    return (
      <g role="group" aria-label={node.name}>
        <rect
          id={nodeId}
          x={x}
          y={y}
          width={w}
          height={h}
          fill={getColor(node.value, maxValue)}
          stroke="#1E293B"
          strokeWidth={2}
          style={{ cursor: hasChildren ? 'pointer' : 'default' }}
          onClick={() => hasChildren && handleNodeClick(node)}
          onKeyDown={(e: any) => hasChildren && handleCellKeyDown(e, node)}
          role={hasChildren ? 'button' : 'img'}
          tabIndex={hasChildren ? 0 : -1}
          aria-label={ariaLabel}
          aria-expanded={hasChildren ? (drilldown?.selectedPath.includes(node.name) ? 'true' : 'false') : undefined}
          aria-current={selectedNode?.name === node.name ? 'location' : undefined}
          aria-describedby={`tooltip-${nodeId}`}
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
      <section
        className={`bg-[#192734] border border-gray-800 rounded-xl p-6 ${className}`}
        data-testid="geo-hierarchy-mindmap"
        aria-labelledby="geo-hierarchy-title-loading"
        role="region"
        aria-busy="true"
        aria-live="polite"
      >
        <h3 id="geo-hierarchy-title-loading" className="text-lg font-semibold mb-4 text-white">
          भू-पदानुक्रम माइंडमैप
        </h3>
        <div className="flex items-center justify-center h-64 text-gray-400" role="status">
          <div className="text-center">
            <div 
              className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"
              aria-hidden="true"
            ></div>
            <p>
              <span className="sr-only">Loading: </span>
              डेटा लोड हो रहा है...
            </p>
          </div>
        </div>
      </section>
    );
  }

  // Error state
  if (error) {
    return (
      <section
        className={`bg-[#192734] border border-gray-800 rounded-xl p-6 ${className}`}
        data-testid="geo-hierarchy-mindmap"
        aria-labelledby="geo-hierarchy-title-error"
        role="alert"
        aria-live="assertive"
      >
        <h3 id="geo-hierarchy-title-error" className="text-lg font-semibold mb-4 text-white">
          भू-पदानुक्रम माइंडमैप
        </h3>
        <div className="flex items-center justify-center h-64 text-red-400">
          <div className="text-center">
            <p className="mb-2" role="status">
              <span className="sr-only">Error: </span>
              <span aria-hidden="true">❌</span> {error}
            </p>
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setError(null);
                  setLoading(true);
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#192734] transition-colors"
              aria-label="Retry loading data"
            >
              पुनः प्रयास करें
            </button>
          </div>
        </div>
      </section>
    );
  }

  // Empty state
  if (!data || displayData.length === 0) {
    return (
      <section
        className={`bg-[#192734] border border-gray-800 rounded-xl p-6 ${className}`}
        data-testid="geo-hierarchy-mindmap"
        aria-labelledby="geo-hierarchy-title-empty"
        role="region"
        aria-live="polite"
      >
        <h3 id="geo-hierarchy-title-empty" className="text-lg font-semibold mb-4 text-white">
          भू-पदानुक्रम माइंडमैप
        </h3>
        <div className="flex items-center justify-center h-64 text-gray-400" role="status">
          <p>
            <span className="sr-only">Information: </span>
            कोई डेटा उपलब्ध नहीं है
            <span className="sr-only">: No data available for the selected filters</span>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`bg-[#192734] border border-gray-800 rounded-xl p-6 ${className}`}
      data-testid="geo-hierarchy-mindmap"
      aria-labelledby="geo-hierarchy-title"
      aria-describedby="geo-hierarchy-description"
      role="region"
    >
      {/* Header with breadcrumb */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 id="geo-hierarchy-title" className="text-lg font-semibold text-white mb-2">
            भू-पदानुक्रम माइंडमैप
          </h3>
          <p id="geo-hierarchy-description" className="sr-only">
            Interactive treemap visualization showing geographic hierarchy of events. Use keyboard to navigate: Tab to move between items, Enter or Space to expand levels, Esc to go back.
          </p>
          {drilldown && drilldown.selectedPath.length > 0 && (
            <nav 
              className="flex items-center gap-2 text-sm text-gray-300"
              aria-label="Breadcrumb navigation"
              role="navigation"
            >
              <button
                onClick={handleBack}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    handleBack();
                  }
                }}
                className="text-blue-400 hover:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#192734] transition-colors px-2 py-1 rounded hover:bg-blue-900/20"
                aria-label={`Go back to ${getPreviousLevel(drilldown.level)} level`}
              >
                ← Back
              </button>
              <span className="text-gray-500" aria-hidden="true">|</span>
              <ol className="flex items-center gap-1 flex-wrap" aria-label="Current location in hierarchy">
                <li>
                  <button
                    onClick={() => {
                      setDrilldown(null);
                      setSelectedNode(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        setDrilldown(null);
                        setSelectedNode(null);
                      }
                    }}
                    className="text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#192734] transition-colors px-1"
                    aria-label="Go to root level, showing all districts"
                  >
                    Root
                  </button>
                </li>
                {drilldown.selectedPath.map((item: string, index: number) => (
                  <li key={index} className="flex items-center gap-1">
                    <span className="text-gray-500" aria-hidden="true">→</span>
                    <button
                      onClick={() => handleBreadcrumbClick(index)}
                      className="text-blue-400 hover:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#192734] transition-colors px-1 rounded hover:bg-blue-900/20"
                      aria-label={`Navigate to ${item}, level ${index + 1} of ${drilldown.selectedPath.length}`}
                      aria-current={index === drilldown.selectedPath.length - 1 ? 'page' : undefined}
                    >
                      {item}
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          )}
        </div>
        {/* Export buttons */}
        <div className="flex items-center gap-2" role="toolbar" aria-label="Export options">
          <button
            onClick={handleExportCSV}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleExportCSV();
              }
            }}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#192734] transition-colors"
            aria-label={`Export ${displayData.length} items to CSV file`}
            aria-describedby="export-csv-description"
          >
            CSV
          </button>
          <span id="export-csv-description" className="sr-only">Download data as comma-separated values file</span>
          <button
            onClick={handleExportJSON}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleExportJSON();
              }
            }}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-[#192734] transition-colors"
            aria-label={`Export ${displayData.length} items to JSON file`}
            aria-describedby="export-json-description"
          >
            JSON
          </button>
          <span id="export-json-description" className="sr-only">Download data as JSON file</span>
        </div>
      </div>

      {/* Treemap visualization */}
      <div 
        style={{ height: `${height}px`, width: width ? `${width}px` : '100%' }}
        role="application"
        aria-label={`Geographic hierarchy treemap showing ${displayData.length} ${drilldown ? `${drilldown.level} level` : 'district level'} items`}
        aria-live="polite"
        aria-atomic="true"
      >
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
      <div 
        className="mt-4 flex items-center gap-4 text-sm text-gray-400"
        role="group"
        aria-label="Color legend and interaction instructions"
      >
        <div className="flex items-center gap-2">
          <div 
            className="w-4 h-4 bg-[#D1FAE5] border border-gray-700"
            aria-label="Light green color indicates lower event count"
            role="img"
          ></div>
          <span>कम घटनाएं</span>
          <span className="sr-only">: Fewer events</span>
        </div>
        <div className="flex items-center gap-2">
          <div 
            className="w-4 h-4 bg-[#10B981] border border-gray-700"
            aria-label="Dark green color indicates higher event count"
            role="img"
          ></div>
          <span>अधिक घटनाएं</span>
          <span className="sr-only">: More events</span>
        </div>
        <div className="text-gray-500">
          <span className="sr-only">Keyboard navigation: </span>
          क्लिक करें विस्तार करने के लिए
          <span className="sr-only">, or press Enter or Space on an item to expand</span>
        </div>
      </div>
      
      {/* Screen reader announcements for state changes */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" id="drilldown-announcement">
        {drilldown 
          ? `Viewing ${drilldown.level} level with ${displayData.length} items`
          : `Viewing district level with ${displayData.length} districts`
        }
      </div>
    </section>
  );
}

