/**
 * Latency Visualization Component
 * Phase 8.2: API Latency Visualization
 * Displays live updating latency bars/sparklines for each API node
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTraces } from '@/hooks/useTraces';
import { TraceLog } from '@/middleware/traceLogger';

interface EndpointLatency {
  endpoint: string;
  component: string;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  success_rate: number;
  error_rate: number;
  request_count: number;
}

export default function LatencyVisualization() {
  const { traces, loading, error } = useTraces({ limit: 1000, refreshInterval: 10000 });
  const [renderTime, setRenderTime] = useState(0);

  // Calculate latency metrics per endpoint
  const endpointMetrics = useMemo(() => {
    const startTime = performance.now();
    
    const endpointMap = new Map<string, TraceLog[]>();

    traces.forEach((trace) => {
      const key = `${trace.component}:${trace.endpoint}`;
      if (!endpointMap.has(key)) {
        endpointMap.set(key, []);
      }
      endpointMap.get(key)!.push(trace);
    });

    const metrics: EndpointLatency[] = Array.from(endpointMap.entries()).map(
      ([key, endpointTraces]) => {
        const [component, endpoint] = key.split(':');
        const latencies = endpointTraces.map((t) => t.latency_ms).sort((a, b) => a - b);
        const count = latencies.length;

        const p50 = latencies[Math.floor(count * 0.5)] || 0;
        const p95 = latencies[Math.floor(count * 0.95)] || 0;
        const p99 = latencies[Math.floor(count * 0.99)] || 0;
        const max = Math.max(...latencies, 0);

        const success_count = endpointTraces.filter((t) => t.status_code < 400).length;
        const error_count = count - success_count;
        const success_rate = count > 0 ? (success_count / count) * 100 : 0;
        const error_rate = count > 0 ? (error_count / count) * 100 : 0;

        return {
          endpoint,
          component,
          p50,
          p95,
          p99,
          max,
          success_rate,
          error_rate,
          request_count: count,
        };
      }
    );

    const endTime = performance.now();
    setRenderTime(endTime - startTime);

    return metrics.sort((a, b) => b.p95 - a.p95);
  }, [traces]);

  const getStatusColor = (latency: number): string => {
    if (latency < 250) return 'text-green-400 bg-green-500/20 border-green-500/30';
    if (latency < 350) return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
    return 'text-red-400 bg-red-500/20 border-red-500/30';
  };

  const getStatusEmoji = (latency: number): string => {
    if (latency < 250) return '🟢';
    if (latency < 350) return '🟠';
    return '🔴';
  };

  const getBarWidth = (latency: number, maxLatency: number): string => {
    if (maxLatency === 0) return '0%';
    return `${Math.min((latency / maxLatency) * 100, 100)}%`;
  };

  const maxLatency = useMemo(() => {
    return Math.max(...endpointMetrics.map((m) => m.p95), 1);
  }, [endpointMetrics]);

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
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white">
          📊 API Latency Visualization
        </h3>
        <div className="text-xs text-secondary">
          Render: {renderTime.toFixed(2)}ms | Updates every 10s
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-6 text-sm">
        <div className="flex items-center gap-2">
          <span>🟢</span>
          <span className="text-secondary">Normal (&lt;250ms)</span>
        </div>
        <div className="flex items-center gap-2">
          <span>🟠</span>
          <span className="text-secondary">Slow (250-350ms)</span>
        </div>
        <div className="flex items-center gap-2">
          <span>🔴</span>
          <span className="text-secondary">Failing (&gt;350ms)</span>
        </div>
      </div>

      {/* Latency Bars */}
      <div className="space-y-4">
        {endpointMetrics.length === 0 ? (
          <p className="text-secondary text-center py-8">No latency data available</p>
        ) : (
          endpointMetrics.map((metric) => (
            <div
              key={`${metric.component}:${metric.endpoint}`}
              className="border border-white/10 rounded-lg p-4 bg-white/5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-semibold">
                      {metric.component}
                    </span>
                    <span className="text-secondary">/</span>
                    <span className="text-white">{metric.endpoint}</span>
                    <span className={getStatusEmoji(metric.p95)}></span>
                  </div>
                  <div className="text-xs text-secondary">
                    {metric.request_count} requests | Success: {metric.success_rate.toFixed(1)}% | Error: {metric.error_rate.toFixed(1)}%
                  </div>
                </div>
                <div className="flex gap-4 text-sm">
                  <div>
                    <span className="text-secondary">p50: </span>
                    <span className={getStatusColor(metric.p50).split(' ')[0]}>
                      {Math.round(metric.p50)}ms
                    </span>
                  </div>
                  <div>
                    <span className="text-secondary">p95: </span>
                    <span className={getStatusColor(metric.p95).split(' ')[0]}>
                      {Math.round(metric.p95)}ms
                    </span>
                  </div>
                  <div>
                    <span className="text-secondary">p99: </span>
                    <span className={getStatusColor(metric.p99).split(' ')[0]}>
                      {Math.round(metric.p99)}ms
                    </span>
                  </div>
                  <div>
                    <span className="text-secondary">Max: </span>
                    <span className="text-white">{Math.round(metric.max)}ms</span>
                  </div>
                </div>
              </div>

              {/* Visual Bar */}
              <div className="space-y-2">
                <div className="relative h-6 bg-white/5 rounded overflow-hidden">
                  <div
                    className={`h-full ${getStatusColor(metric.p95)} transition-all duration-300`}
                    style={{ width: getBarWidth(metric.p95, maxLatency) }}
                    role="progressbar"
                    aria-valuenow={metric.p95}
                    aria-valuemin={0}
                    aria-valuemax={maxLatency}
                    aria-label={`p95 latency: ${metric.p95}ms`}
                  />
                </div>
                {/* Mini sparkline representation */}
                <div className="flex gap-1 h-2">
                  <div
                    className={`flex-1 ${getStatusColor(metric.p50).split(' ')[2]} rounded`}
                    style={{ opacity: 0.6 }}
                    title={`p50: ${metric.p50}ms`}
                  />
                  <div
                    className={`flex-1 ${getStatusColor(metric.p95).split(' ')[2]} rounded`}
                    style={{ opacity: 0.8 }}
                    title={`p95: ${metric.p95}ms`}
                  />
                  <div
                    className={`flex-1 ${getStatusColor(metric.p99).split(' ')[2]} rounded`}
                    title={`p99: ${metric.p99}ms`}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Performance indicator */}
      {renderTime > 100 && (
        <div className="mt-4 text-xs text-yellow-400">
          ⚠️ Render time ({renderTime.toFixed(2)}ms) exceeds performance budget (100ms)
        </div>
      )}
    </div>
  );
}

