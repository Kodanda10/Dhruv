'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as d3 from 'd3';
import { GraphData, GraphNode, GraphEdge } from '@/labs/mindmap/graph_builder';

interface Node extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: string;
  size: number;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
  weight: number;
  cooccurrence: number;
}

export default function D3MindmapCard() {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  useEffect(() => {
    const fetchGraphData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/labs/mindmap/graph');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const graphData = await response.json();
        if (graphData.success) {
          setData(graphData);
        } else {
          throw new Error(graphData.error || 'Failed to fetch graph data');
        }
      } catch (error) {
        console.error('Failed to fetch graph data:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    fetchGraphData();
  }, []);

  useEffect(() => {
    if (!data || !svgRef.current || !data.nodes || !data.edges) return;

    const width = 500;
    const height = 400;

    // Transform nodes to include D3 simulation properties
    const nodes: Node[] = data.nodes.map(node => ({
      ...node,
      x: undefined,
      y: undefined,
      vx: undefined,
      vy: undefined,
      fx: undefined,
      fy: undefined,
    }));

    // Transform edges to D3 format
    const links: Link[] = data.edges.map(edge => ({
      source: edge.source,
      target: edge.target,
      weight: edge.weight,
      cooccurrence: edge.cooccurrence,
    }));

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [-width / 2, -height / 2, width, height]);

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink<Node, Link>(links).id(d => d.id))
      .force('charge', d3.forceManyBody().strength(-50))
      .force('center', d3.forceCenter());

        const link = svg.append('g')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', (d: Link) => Math.sqrt(d.weight));

    const node = svg.append('g')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', d => Math.max(3, Math.min(10, d.size)))
      .attr('fill', d => {
        switch (d.type) {
          case 'person': return '#FF6B6B';
          case 'organization': return '#4ECDC4';
          case 'location': return '#45B7D1';
          case 'topic': return '#96CEB4';
          case 'event_type': return '#FFEAA7';
          default: return '#8BF5E6';
        }
      });

    node.append('title').text(d => `${d.label} (${d.type})`);

    simulation.on('tick', () => {
      link
        .attr('x1', (d: Link) => (d.source as Node).x!)
        .attr('y1', (d: Link) => (d.source as Node).y!)
        .attr('x2', (d: Link) => (d.target as Node).x!)
        .attr('y2', (d: Link) => (d.target as Node).y!);
      node
        .attr('cx', d => d.x!)
        .attr('cy', d => d.y!);
    });

    return () => {
      simulation.stop();
      svg.selectAll('*').remove();
    };
  }, [data]);

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="glassmorphic-card rounded-lg p-6"
      >
        <h3 className="text-xl font-bold mb-4 text-white">Entity Relationship Mindmap</h3>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-white">Loading graph data...</p>
          </div>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="glassmorphic-card rounded-lg p-6"
      >
        <h3 className="text-xl font-bold mb-4 text-white">Entity Relationship Mindmap</h3>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-red-500 mb-2">⚠️</div>
            <p className="text-red-600">Error loading graph data</p>
            <p className="text-sm text-gray-400 mt-1">{error}</p>
          </div>
        </div>
      </motion.div>
    );
  }

  if (!data || !data.nodes || !data.edges) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="glassmorphic-card rounded-lg p-6"
      >
        <h3 className="text-xl font-bold mb-4 text-white">Entity Relationship Mindmap</h3>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-gray-500 mb-2">📊</div>
            <p className="text-white">No graph data available</p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="glassmorphic-card rounded-lg p-6"
    >
      <h3 className="text-xl font-bold mb-4 text-white">Entity Relationship Mindmap</h3>
      <svg ref={svgRef}></svg>
    </motion.div>
  );
}
