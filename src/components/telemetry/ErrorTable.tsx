/**
 * Error Snapshot Panel Component
 * Phase 8.4: Error Snapshot Panel
 * Displays table of most recent errors with filtering
 */

'use client';

import { useState, useEffect } from 'react';

interface ErrorTrace {
  trace_id: string;
  timestamp: string;
  latency_ms: number;
  status_code: number;
  component: string;
  endpoint: string;
  method: string;
  error_message?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface ErrorTableProps {
  onTraceClick?: (traceId: string) => void;
}

export default function ErrorTable({ onTraceClick }: ErrorTableProps) {
  const [errors, setErrors] = useState<ErrorTrace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [componentFilter, setComponentFilter] = useState<string>('');
  const [minutesFilter, setMinutesFilter] = useState<number>(60);

  const fetchErrors = async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      if (componentFilter) params.append('component', componentFilter);
      params.append('minutes', minutesFilter.toString());
      params.append('limit', '10');

      const response = await fetch(`/api/system/errors?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch errors');
      }

      const result = await response.json();
      if (result.success && result.data?.errors) {
        setErrors(result.data.errors);
      } else {
        setErrors([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setErrors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchErrors();
    const interval = setInterval(fetchErrors, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, [componentFilter, minutesFilter]);

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/20 border-red-500/50 text-red-300';
      case 'high':
        return 'bg-orange-500/20 border-orange-500/50 text-orange-300';
      case 'medium':
        return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300';
      default:
        return 'bg-blue-500/20 border-blue-500/50 text-blue-300';
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('hi-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleTraceClick = (traceId: string) => {
    if (onTraceClick) {
      onTraceClick(traceId);
    }
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

  return (
    <div className="glassmorphic-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white">
          ⚠️ Error Snapshot Panel
        </h3>
        <div className="flex gap-4 items-center">
          {/* Component Filter */}
          <label className="text-sm text-secondary">
            Component:
            <select
              value={componentFilter}
              onChange={(e) => setComponentFilter(e.target.value)}
              className="ml-2 px-2 py-1 rounded bg-white/5 border border-white/20 text-white focus:outline-none focus:border-[#8BF5E6]"
              aria-label="Filter by component"
            >
              <option value="">All</option>
              <option value="api">API</option>
              <option value="system">System</option>
              <option value="cms">CMS</option>
            </select>
          </label>

          {/* Time Filter */}
          <label className="text-sm text-secondary">
            Last:
            <select
              value={minutesFilter}
              onChange={(e) => setMinutesFilter(Number(e.target.value))}
              className="ml-2 px-2 py-1 rounded bg-white/5 border border-white/20 text-white focus:outline-none focus:border-[#8BF5E6]"
              aria-label="Filter by time window"
            >
              <option value="15">15 min</option>
              <option value="30">30 min</option>
              <option value="60">1 hour</option>
              <option value="240">4 hours</option>
            </select>
          </label>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded border border-red-500/30 bg-red-500/10">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {errors.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-secondary">✅ No errors in the selected time window</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table
            className="min-w-full border-collapse"
            role="table"
            aria-label="Error snapshot table"
          >
            <thead>
              <tr className="border-b border-white/20">
                <th className="text-left p-3 text-sm font-semibold text-white">Timestamp</th>
                <th className="text-left p-3 text-sm font-semibold text-white">Component</th>
                <th className="text-left p-3 text-sm font-semibold text-white">Endpoint</th>
                <th className="text-left p-3 text-sm font-semibold text-white">Status</th>
                <th className="text-left p-3 text-sm font-semibold text-white">Severity</th>
                <th className="text-left p-3 text-sm font-semibold text-white">Trace ID</th>
                <th className="text-left p-3 text-sm font-semibold text-white">Error Message</th>
              </tr>
            </thead>
            <tbody>
              {errors.map((err) => (
                <tr
                  key={err.trace_id}
                  className="border-b border-white/10 hover:bg-white/5 transition-colors"
                  role="row"
                >
                  <td className="p-3 text-sm text-secondary">{formatTimestamp(err.timestamp)}</td>
                  <td className="p-3 text-sm text-white">{err.component}</td>
                  <td className="p-3 text-sm text-white font-mono text-xs">{err.endpoint}</td>
                  <td className="p-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${
                      err.status_code >= 500
                        ? 'bg-red-500/20 text-red-300'
                        : err.status_code >= 400
                        ? 'bg-yellow-500/20 text-yellow-300'
                        : 'bg-green-500/20 text-green-300'
                    }`}>
                      {err.status_code}
                    </span>
                  </td>
                  <td className="p-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs border ${getSeverityColor(err.severity)}`}>
                      {err.severity.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-3 text-sm">
                    <button
                      onClick={() => handleTraceClick(err.trace_id)}
                      className="text-[#8BF5E6] hover:text-[#8BF5E6]/80 underline font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#8BF5E6] rounded"
                      aria-label={`View trace ${err.trace_id}`}
                    >
                      {err.trace_id.slice(0, 8)}...
                    </button>
                  </td>
                  <td className="p-3 text-sm text-secondary max-w-md truncate" title={err.error_message}>
                    {err.error_message || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

