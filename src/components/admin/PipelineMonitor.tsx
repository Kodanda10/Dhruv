/**
 * Pipeline Monitor Component
 * Phase 7.5: Database & Pipeline Monitor
 * Shows health flow chart: Fetch → Parse → Review → AI → Analytics
 */

'use client';

import { useState, useEffect } from 'react';

interface PipelineNode {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  last_execution: string | null;
  last_success: string | null;
  last_error: string | null;
  record_count?: number;
  latency_ms?: number;
}

interface PipelineHealth {
  nodes: PipelineNode[];
  overall_status: 'healthy' | 'degraded' | 'unhealthy';
  last_sync: string;
}

export default function PipelineMonitor() {
  const [data, setData] = useState<PipelineHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const fetchPipelineHealth = async () => {
    try {
      setError(null);
      const response = await fetch('/api/system/pipeline');
      if (!response.ok) {
        throw new Error('Failed to fetch pipeline health');
      }
      const result = await response.json();
      if (result.success && result.data) {
        setData(result.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPipelineHealth();
    const interval = setInterval(fetchPipelineHealth, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return '✅';
      case 'degraded':
        return '⚠️';
      case 'unhealthy':
        return '❌';
      default:
        return '❓';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'border-green-500/50 bg-green-500/10';
      case 'degraded':
        return 'border-yellow-500/50 bg-yellow-500/10';
      case 'unhealthy':
        return 'border-red-500/50 bg-red-500/10';
      default:
        return 'border-white/10 bg-white/5';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'कभी नहीं';
    const date = new Date(dateString);
    return date.toLocaleString('hi-IN', { hour12: false });
  };

  if (loading) {
    return (
      <div className="glassmorphic-card p-6">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-4 border-[#8BF5E6] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-sm text-secondary">लोड हो रहा है...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glassmorphic-card border border-red-500/30 p-6">
        <p className="text-red-300">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="glassmorphic-card p-6">
        <p className="text-secondary">कोई पाइपलाइन डेटा उपलब्ध नहीं</p>
      </div>
    );
  }

  return (
    <div className="glassmorphic-card p-6">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-white mb-2">पाइपलाइन स्वास्थ्य</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-secondary">Overall Status:</span>
          <span className={`text-lg font-bold ${data.overall_status === 'healthy' ? 'text-green-400' : data.overall_status === 'degraded' ? 'text-yellow-400' : 'text-red-400'}`}>
            {getStatusIcon(data.overall_status)} {data.overall_status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Pipeline Flow */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        {data.nodes.map((node, index) => (
          <div key={node.name} className="flex items-center gap-4">
            <div
              className={`p-4 rounded-lg border cursor-pointer transition-all hover:scale-105 ${getStatusColor(node.status)}`}
              onClick={() => setSelectedNode(selectedNode === node.name ? null : node.name)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setSelectedNode(selectedNode === node.name ? null : node.name);
                }
              }}
              aria-label={`${node.name} pipeline node`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{getStatusIcon(node.status)}</span>
                <span className="text-white font-semibold">{node.name}</span>
              </div>
              {node.record_count !== undefined && (
                <div className="text-xs text-secondary">Records: {node.record_count}</div>
              )}
            </div>
            {index < data.nodes.length - 1 && (
              <div className="text-white/30 text-xl">→</div>
            )}
          </div>
        ))}
      </div>

      {/* Node Details */}
      {selectedNode && (
        <div className="mt-6 p-4 rounded-lg border border-white/10 bg-white/5">
          {(() => {
            const node = data.nodes.find((n) => n.name === selectedNode);
            if (!node) return null;
            return (
              <div>
                <h4 className="text-lg font-semibold text-white mb-3">{node.name} Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-secondary">Status:</span>
                    <span className={`font-medium ${node.status === 'healthy' ? 'text-green-400' : node.status === 'degraded' ? 'text-yellow-400' : 'text-red-400'}`}>
                      {node.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Last Execution:</span>
                    <span className="text-white">{formatDate(node.last_execution)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Last Success:</span>
                    <span className="text-white">{formatDate(node.last_success)}</span>
                  </div>
                  {node.last_error && (
                    <div className="flex justify-between">
                      <span className="text-secondary">Last Error:</span>
                      <span className="text-red-400">{node.last_error}</span>
                    </div>
                  )}
                  {node.record_count !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-secondary">Record Count:</span>
                      <span className="text-white">{node.record_count}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}


