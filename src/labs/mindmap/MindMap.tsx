/**
 * D3 Mindmap Component
 * 
 * Visualizes graph data using D3 force layout
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GraphData } from './graph_builder';

interface MindMapProps {
  data?: GraphData;
  className?: string;
}

export default function MindMap({ data, className = '' }: MindMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  useEffect(() => {
    if (!data || !svgRef.current) {
      setIsLoading(false);
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 800;
    const height = 600;

    svg.attr('width', width).attr('height', height);

    // Create simulation
    const simulation = d3
      .forceSimulation(data.nodes as any)
      .force(
        'link',
        d3.forceLink(data.edges).id((d: any) => d.id).distance(100)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    // Create links
    const link = svg
      .append('g')
      .selectAll('line')
      .data(data.edges)
      .enter()
      .append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d) => Math.sqrt(d.weight) * 2);

    // Create nodes
    const node = svg
      .append('g')
      .selectAll('circle')
      .data(data.nodes)
      .enter()
      .append('circle')
      .attr('r', (d) => Math.sqrt(d.size) * 3 + 5)
      .attr('fill', (d) => {
        const colors: Record<string, string> = {
          event_type: '#3b82f6',
          location: '#10b981',
          person: '#f59e0b',
          organization: '#ef4444',
          topic: '#8b5cf6',
        };
        return colors[d.type] || '#6b7280';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        setSelectedNode(d.id);
      })
      .call(
        d3
          .drag<any, any>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }) as any
      );

    // Add labels
    const label = svg
      .append('g')
      .selectAll('text')
      .data(data.nodes)
      .enter()
      .append('text')
      .text((d) => d.label)
      .attr('font-size', 12)
      .attr('dx', 10)
      .attr('dy', 4)
      .style('pointer-events', 'none')
      .style('fill', '#1f2937');

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('cx', (d: any) => d.x).attr('cy', (d: any) => d.y);

      label.attr('x', (d: any) => d.x).attr('y', (d: any) => d.y);
    });

    setIsLoading(false);

    return () => {
      simulation.stop();
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-[600px] ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">ग्राफ बनाया जा रहा है...</p>
        </div>
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-8 text-center ${className}`}>
        <p className="text-gray-600">कोई डेटा उपलब्ध नहीं</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">माइंडमैप</h3>
          <p className="text-sm text-gray-600">
            नोड्स: {data.stats.node_count}, कनेक्शन: {data.stats.edge_count}
          </p>
        </div>
        {selectedNode && (
          <div className="text-sm text-gray-600">
            चयनित: {data.nodes.find((n) => n.id === selectedNode)?.label}
          </div>
        )}
      </div>
      <svg ref={svgRef} className="w-full border border-gray-200 rounded-lg bg-white" />
      <div className="mt-4 flex gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span>घटना प्रकार</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span>स्थान</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <span>व्यक्ति</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span>संगठन</span>
        </div>
      </div>
    </div>
  );
}

