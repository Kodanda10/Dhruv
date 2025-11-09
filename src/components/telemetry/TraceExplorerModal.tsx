/**
 * Trace Explorer Modal Component
 * Phase 8.3: Trace Timeline Inspector
 * Displays detailed trace timeline with pipeline stages
 */

'use client';

import { useState, useEffect } from 'react';
import { TraceLog } from '@/middleware/traceLogger';

interface TraceExplorerModalProps {
  traceId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

interface TraceDetails extends TraceLog {
  trace_id: string;
  timestamp: string;
  latency_ms: number;
  status_code: number;
  component: string;
  endpoint: string;
  method: string;
  error_message?: string;
  pipeline_stages?: Array<{
    stage: string;
    latency_ms: number;
    status: 'success' | 'error';
  }>;
}

const PIPELINE_STAGES = [
  { name: 'Fetch', key: 'fetch' },
  { name: 'Parse', key: 'parse' },
  { name: 'Review', key: 'review' },
  { name: 'AI', key: 'ai' },
  { name: 'Analytics', key: 'analytics' },
];

export default function TraceExplorerModal({
  traceId,
  isOpen,
  onClose,
}: TraceExplorerModalProps) {
  const [trace, setTrace] = useState<TraceDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  useEffect(() => {
    if (isOpen && traceId) {
      fetchTrace();
    } else {
      setTrace(null);
      setError(null);
      setShowRawJson(false);
    }
  }, [isOpen, traceId]);

  const fetchTrace = async () => {
    if (!traceId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/system/trace/${traceId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch trace');
      }

      const result = await response.json();
      if (result.success && result.data) {
        // Simulate pipeline stages based on component and endpoint
        const pipelineStages = inferPipelineStages(result.data);
        setTrace({
          ...result.data,
          pipeline_stages: pipelineStages,
        });
      } else {
        throw new Error('Trace not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const inferPipelineStages = (trace: TraceLog): Array<{
    stage: string;
    latency_ms: number;
    status: 'success' | 'error';
  }> => {
    // Infer stages based on component and endpoint
    const stages: Array<{ stage: string; latency_ms: number; status: 'success' | 'error' }> = [];
    
    // Distribute latency across stages (simplified - in production, use actual trace data)
    const totalLatency = trace.latency_ms;
    const stageCount = PIPELINE_STAGES.length;
    const avgLatency = totalLatency / stageCount;

    PIPELINE_STAGES.forEach((stage, index) => {
      const stageLatency = index === stageCount - 1 
        ? totalLatency - (avgLatency * (stageCount - 1)) // Last stage gets remainder
        : avgLatency;
      
      stages.push({
        stage: stage.name,
        latency_ms: Math.max(0, Math.round(stageLatency)),
        status: trace.status_code < 400 ? 'success' : 'error',
      });
    });

    return stages;
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('hi-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleViewLogs = () => {
    if (traceId) {
      window.open(`/logs/${traceId}`, '_blank');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trace-explorer-title"
      onClick={onClose}
    >
      <div
        className="glassmorphic-card p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 id="trace-explorer-title" className="text-2xl font-bold text-white">
            🔍 Trace Explorer
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-[#8BF5E6] focus:outline-none focus:ring-2 focus:ring-[#8BF5E6] rounded p-2"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="inline-block w-8 h-8 border-4 border-[#8BF5E6] border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-sm text-secondary">लोड हो रहा है...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 rounded border border-red-500/30 bg-red-500/10">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {trace && (
          <div className="space-y-6">
            {/* Trace Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-secondary mb-1">Trace ID</div>
                <div className="text-white font-mono text-sm">{trace.trace_id}</div>
              </div>
              <div>
                <div className="text-sm text-secondary mb-1">Timestamp</div>
                <div className="text-white">{formatTimestamp(trace.timestamp)}</div>
              </div>
              <div>
                <div className="text-sm text-secondary mb-1">Component</div>
                <div className="text-white">{trace.component}</div>
              </div>
              <div>
                <div className="text-sm text-secondary mb-1">Endpoint</div>
                <div className="text-white font-mono text-sm">{trace.endpoint}</div>
              </div>
              <div>
                <div className="text-sm text-secondary mb-1">Method</div>
                <div className="text-white">{trace.method}</div>
              </div>
              <div>
                <div className="text-sm text-secondary mb-1">Status Code</div>
                <div className={`text-lg font-bold ${
                  trace.status_code < 400 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {trace.status_code}
                </div>
              </div>
            </div>

            {/* Pipeline Timeline */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">
                Pipeline Timeline: Fetch → Parse → Review → AI → Analytics
              </h3>
              <div className="space-y-3">
                {trace.pipeline_stages?.map((stage, index) => (
                  <div
                    key={stage.stage}
                    className="flex items-center gap-4 p-3 rounded border border-white/10 bg-white/5"
                  >
                    <div className="flex-shrink-0 w-24 text-sm font-semibold text-white">
                      {stage.stage}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-2 bg-white/10 rounded overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              stage.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min((stage.latency_ms / 500) * 100, 100)}%` }}
                            role="progressbar"
                            aria-valuenow={stage.latency_ms}
                            aria-valuemin={0}
                            aria-valuemax={500}
                          />
                        </div>
                        <div className="text-sm text-white w-20 text-right">
                          {stage.latency_ms}ms
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {stage.status === 'success' ? (
                        <span className="text-green-400">✅</span>
                      ) : (
                        <span className="text-red-400">❌</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-sm text-secondary">
                Total Latency: <span className="text-white font-semibold">{trace.latency_ms}ms</span>
              </div>
            </div>

            {/* Error Message */}
            {trace.error_message && (
              <div className="p-4 rounded border border-red-500/30 bg-red-500/10">
                <div className="text-sm text-secondary mb-2">Error Message</div>
                <div className="text-red-300">{trace.error_message}</div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={() => setShowRawJson(!showRawJson)}
                className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-[#8BF5E6] transition-colors"
                aria-label={showRawJson ? 'Hide raw JSON' : 'Show raw JSON'}
              >
                {showRawJson ? 'Hide' : 'Show'} Raw JSON
              </button>
              <button
                onClick={handleViewLogs}
                className="px-4 py-2 rounded bg-[#8BF5E6]/20 hover:bg-[#8BF5E6]/30 text-[#8BF5E6] border border-[#8BF5E6]/30 focus:outline-none focus:ring-2 focus:ring-[#8BF5E6] transition-colors"
              >
                View Logs
              </button>
            </div>

            {/* Raw JSON */}
            {showRawJson && (
              <div className="p-4 rounded bg-white/5 border border-white/10">
                <pre className="text-xs text-secondary overflow-x-auto font-mono">
                  {JSON.stringify(trace, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

