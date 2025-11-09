/**
 * D3 Mindmap Page
 */

'use client';

import React, { useState, useEffect } from 'react';
import MindMap from '@/labs/mindmap/MindMap';
import { GraphData } from '@/labs/mindmap/graph_builder';

export default function MindmapPage() {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(2);

  useEffect(() => {
    const loadGraph = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/labs/mindmap/graph?threshold=${threshold}`);
        const data = await response.json();

        if (data.success) {
          setGraphData(data);
        } else {
          setError(data.error || 'ग्राफ बनाने में त्रुटि');
        }
      } catch (err: any) {
        setError(err.message || 'ग्राफ लोड करने में त्रुटि');
      } finally {
        setIsLoading(false);
      }
    };

    loadGraph();
  }, [threshold]);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="glassmorphic-card mb-6">
          <h1 className="text-3xl font-bold text-primary mb-2">🧠 D3 Mindmap</h1>
          <p className="text-secondary mb-4">वास्तविक एनालिटिक्स डेटा से ग्राफ विज़ुअलाइज़ेशन</p>

          <div className="flex items-center gap-4 mt-4">
            <label className="text-secondary text-sm">
              Co-occurrence Threshold:
            </label>
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(Math.max(1, parseInt(e.target.value) || 2))}
              min="1"
              max="10"
              className="px-3 py-1 rounded w-20"
            />
            <button
              onClick={() => {
                setIsLoading(true);
                const loadGraph = async () => {
                  try {
                    const response = await fetch(`/api/labs/mindmap/graph?threshold=${threshold}`);
                    const data = await response.json();
                    if (data.success) {
                      setGraphData(data);
                    }
                  } catch (err: any) {
                    setError(err.message);
                  } finally {
                    setIsLoading(false);
                  }
                };
                loadGraph();
              }}
              className="neon-button px-4 py-1 rounded text-sm"
            >
              Reload
            </button>
          </div>
        </div>

        <div className="glassmorphic-card">
          {error ? (
            <div className="glassmorphic border border-red-500/50 rounded-lg p-4">
              <p className="text-red-200">{error}</p>
            </div>
          ) : (
            <MindMap data={graphData || undefined} />
          )}
        </div>
      </div>
    </div>
  );
}

