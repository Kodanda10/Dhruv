/**
 * Latency Heatmap Component
 * Phase 8.5: Latency Heatmap
 * Grid visual showing p95 latency for each API node
 */

'use client';

import { useState, useEffect } from 'react';

interface EndpointMetric {
  endpoint: string;
  component: string;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  request_count: number;
  success_count: number;
  error_count: number;
}

export default function TraceHeatmap() {
  const [metrics, setMetrics] = useState<EndpointMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      setError(null);
      const response = await fetch('/api/system/metrics');
      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }

      const result = await response.json();
      if (result.success && result.data?.metrics) {
        setMetrics(result.data.metrics);
      } else {
        setMetrics([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setMetrics([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, []);

  const getLatencyColor = (latency: number): string => {
    if (latency < 250) return 'bg-green-500 border-green-400';
    if (latency < 350) return 'bg-yellow-500 border-yellow-400';
    return 'bg-red-500 border-red-400';
  };

  const getLatencyIntensity = (latency: number, maxLatency: number): number => {
    if (maxLatency === 0) return 0.3;
    const ratio = latency / maxLatency;
    return Math.max(0.3, Math.min(1.0, ratio));
  };

  const getLatencyLabel = (latency: number): string => {
    if (latency < 250) return 'Normal';
    if (latency < 350) return 'Slow';
    return 'Failing';
  };

  const maxLatency = metrics.length > 0 
    ? Math.max(...metrics.map((m) => m.p95), 1)
    : 1;

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

  return (
    <div className="glassmorphic-card p-6">
      <h3 className="text-xl font-bold text-white mb-6">
        🔥 Latency Heatmap (p95)
      </h3>

      {/* Legend */}
      <div className="flex gap-6 mb-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 border border-green-400 rounded"></div>
          <span className="text-secondary">Green &lt;250ms (Normal)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-500 border border-yellow-400 rounded"></div>
          <span className="text-secondary">Orange 250-350ms (Slow)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 border border-red-400 rounded"></div>
          <span className="text-secondary">Red &gt;350ms (Failing)</span>
        </div>
      </div>

      {/* Grid */}
      {metrics.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-secondary">No metrics data available</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((metric) => {
            const intensity = getLatencyIntensity(metric.p95, maxLatency);
            const colorClass = getLatencyColor(metric.p95);
            const label = getLatencyLabel(metric.p95);

            return (
              <div
                key={`${metric.component}:${metric.endpoint}`}
                className={`p-4 rounded-lg border-2 ${colorClass} bg-white/5 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#8BF5E6] cursor-pointer`}
                style={{
                  opacity: intensity,
                  backgroundColor: `rgba(255, 255, 255, ${0.05 * intensity})`,
                }}
                role="button"
                tabIndex={0}
                aria-label={`${metric.component} ${metric.endpoint}: ${metric.p95}ms p95 latency, ${label}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    // Could open trace explorer here
                  }
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="text-white font-semibold text-sm mb-1">
                      {metric.component}
                    </div>
                    <div className="text-xs text-secondary font-mono truncate">
                      {metric.endpoint}
                    </div>
                  </div>
                  <div className="text-xs text-white font-bold px-2 py-1 rounded bg-white/10">
                    {label}
                  </div>
                </div>

                {/* Visual Bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-secondary">p95 Latency</span>
                    <span className={`text-sm font-bold ${
                      metric.p95 < 250 ? 'text-green-400' :
                      metric.p95 < 350 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {Math.round(metric.p95)}ms
                    </span>
                  </div>
                  <div className="relative h-4 bg-white/10 rounded overflow-hidden">
                    <div
                      className={`h-full ${colorClass} transition-all`}
                      style={{ width: `${(metric.p95 / maxLatency) * 100}%` }}
                      role="progressbar"
                      aria-valuenow={metric.p95}
                      aria-valuemin={0}
                      aria-valuemax={maxLatency}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="mt-3 flex gap-4 text-xs text-secondary">
                  <div>
                    <span className="text-white">Requests: </span>
                    {metric.request_count}
                  </div>
                  <div>
                    <span className="text-white">Success: </span>
                    {metric.success_count}
                  </div>
                  {metric.error_count > 0 && (
                    <div className="text-red-400">
                      Errors: {metric.error_count}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Accessibility Note */}
      <div className="mt-6 text-xs text-secondary">
        💡 Tip: Use keyboard navigation (Tab/Enter) to interact with heatmap cells. Color intensity indicates latency severity.
      </div>
    </div>
  );
}

