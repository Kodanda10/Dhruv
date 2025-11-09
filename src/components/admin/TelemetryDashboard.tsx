/**
 * Telemetry Dashboard Component
 * Phase 7.4: Telemetry & Logs Dashboard
 * Displays API latency, error rates, system metrics, web vitals
 */

'use client';

import { useState, useEffect } from 'react';

interface TelemetryData {
  api_latency: {
    p50: number;
    p95: number;
    p99: number;
    endpoints: Array<{
      endpoint: string;
      p50: number;
      p95: number;
      p99: number;
      success_rate: number;
      error_rate: number;
    }>;
  };
  error_rates: Array<{
    endpoint: string;
    errors: number;
    total: number;
    rate: number;
  }>;
  system_metrics: {
    memory_mb: number;
    cpu_percent: number;
    uptime_seconds: number;
  };
  web_vitals: {
    lcp?: number;
    fid?: number;
    cls?: number;
  };
}

export default function TelemetryDashboard() {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTelemetry = async () => {
    try {
      setError(null);
      const response = await fetch('/api/system/telemetry');
      if (!response.ok) {
        throw new Error('Failed to fetch telemetry');
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
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days} दिन ${hours} घंटे`;
    if (hours > 0) return `${hours} घंटे ${minutes} मिनट`;
    return `${minutes} मिनट`;
  };

  const getLatencyColor = (latency: number) => {
    if (latency < 250) return 'text-green-400';
    if (latency < 350) return 'text-yellow-400';
    return 'text-red-400';
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
        <p className="text-secondary">कोई टेलीमेट्री डेटा उपलब्ध नहीं</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* API Latency Overview */}
      <div className="glassmorphic-card p-6">
        <h3 className="text-xl font-bold text-white mb-4">API Latency Metrics</h3>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <div className={`text-3xl font-bold ${getLatencyColor(data.api_latency.p50)}`}>
              {Math.round(data.api_latency.p50)}ms
            </div>
            <div className="text-sm text-secondary mt-1">p50</div>
          </div>
          <div className="text-center">
            <div className={`text-3xl font-bold ${getLatencyColor(data.api_latency.p95)}`}>
              {Math.round(data.api_latency.p95)}ms
            </div>
            <div className="text-sm text-secondary mt-1">p95</div>
          </div>
          <div className="text-center">
            <div className={`text-3xl font-bold ${getLatencyColor(data.api_latency.p99)}`}>
              {Math.round(data.api_latency.p99)}ms
            </div>
            <div className="text-sm text-secondary mt-1">p99</div>
          </div>
        </div>

        {/* Endpoint Details */}
        <div className="space-y-2">
          <h4 className="text-lg font-semibold text-white mb-3">Endpoint Latency</h4>
          {data.api_latency.endpoints.map((endpoint) => (
            <div
              key={endpoint.endpoint}
              className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/5"
            >
              <div className="flex-1">
                <div className="text-white font-medium">{endpoint.endpoint}</div>
                <div className="text-xs text-secondary mt-1">
                  Success: {endpoint.success_rate.toFixed(1)}% | Error: {endpoint.error_rate.toFixed(1)}%
                </div>
              </div>
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-secondary">p50: </span>
                  <span className={getLatencyColor(endpoint.p50)}>{Math.round(endpoint.p50)}ms</span>
                </div>
                <div>
                  <span className="text-secondary">p95: </span>
                  <span className={getLatencyColor(endpoint.p95)}>{Math.round(endpoint.p95)}ms</span>
                </div>
                <div>
                  <span className="text-secondary">p99: </span>
                  <span className={getLatencyColor(endpoint.p99)}>{Math.round(endpoint.p99)}ms</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* System Metrics */}
      <div className="glassmorphic-card p-6">
        <h3 className="text-xl font-bold text-white mb-4">System Metrics</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-secondary mb-1">Memory Usage</div>
            <div className="text-2xl font-bold text-white">{data.system_metrics.memory_mb} MB</div>
          </div>
          <div>
            <div className="text-sm text-secondary mb-1">CPU Usage</div>
            <div className="text-2xl font-bold text-white">{data.system_metrics.cpu_percent.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-sm text-secondary mb-1">Uptime</div>
            <div className="text-2xl font-bold text-white">{formatUptime(data.system_metrics.uptime_seconds)}</div>
          </div>
        </div>
      </div>

      {/* Error Rates */}
      {data.error_rates.length > 0 && (
        <div className="glassmorphic-card p-6">
          <h3 className="text-xl font-bold text-white mb-4">Error Rates by Endpoint</h3>
          <div className="space-y-2">
            {data.error_rates
              .filter((e) => e.errors > 0)
              .map((error) => (
                <div
                  key={error.endpoint}
                  className="flex items-center justify-between p-3 rounded-lg border border-red-500/30 bg-red-500/5"
                >
                  <div className="flex-1">
                    <div className="text-white font-medium">{error.endpoint}</div>
                    <div className="text-xs text-secondary mt-1">
                      {error.errors} errors / {error.total} total requests
                    </div>
                  </div>
                  <div className="text-red-400 font-bold">{error.rate.toFixed(2)}%</div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}


