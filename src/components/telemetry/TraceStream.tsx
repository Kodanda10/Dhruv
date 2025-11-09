/**
 * Recent Trace Stream Component
 * Phase 8.6: Recent Trace Stream
 * Live list (auto-scroll) showing trace_id, pipeline path, total latency, status
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useTraces } from '@/hooks/useTraces';
import { TraceLog } from '@/middleware/traceLogger';

interface TraceStreamProps {
  onTraceClick?: (traceId: string) => void;
}

export default function TraceStream({ onTraceClick }: TraceStreamProps) {
  const { traces, loading, error } = useTraces({ limit: 50, refreshInterval: 5000 });
  const [isPaused, setIsPaused] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  // Auto-scroll to bottom when new traces arrive
  useEffect(() => {
    if (!isPaused && shouldAutoScrollRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [traces, isPaused]);

  const handleMouseEnter = () => {
    setIsPaused(true);
    shouldAutoScrollRef.current = false;
  };

  const handleMouseLeave = () => {
    setIsPaused(false);
    shouldAutoScrollRef.current = true;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  };

  const getPipelinePath = (trace: TraceLog): string => {
    // Infer pipeline path from component and endpoint
    const component = trace.component.toLowerCase();
    if (component.includes('fetch') || trace.endpoint.includes('fetch')) return 'Fetch';
    if (component.includes('parse') || trace.endpoint.includes('parse')) return 'Fetch → Parse';
    if (component.includes('review') || trace.endpoint.includes('review')) return 'Fetch → Parse → Review';
    if (component.includes('ai') || trace.endpoint.includes('ai')) return 'Fetch → Parse → Review → AI';
    if (component.includes('analytics') || trace.endpoint.includes('analytics')) return 'Fetch → Parse → Review → AI → Analytics';
    return trace.component;
  };

  const getStatusEmoji = (trace: TraceLog): string => {
    if (trace.status_code >= 500) return '🔴';
    if (trace.status_code >= 400) return '🟠';
    return '🟢';
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('hi-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleTraceClick = (traceId: string) => {
    if (onTraceClick) {
      onTraceClick(traceId);
    }
  };

  if (loading && traces.length === 0) {
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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white">
          📡 Recent Trace Stream
        </h3>
        {isPaused && (
          <div className="text-xs text-yellow-400 px-2 py-1 rounded bg-yellow-500/10 border border-yellow-500/30">
            ⏸️ Paused
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded border border-red-500/30 bg-red-500/10">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      <div
        ref={scrollContainerRef}
        className="space-y-2 max-h-96 overflow-y-auto scroll-smooth"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        role="log"
        aria-live="polite"
        aria-label="Recent trace stream"
      >
        {traces.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-secondary">No traces available</p>
          </div>
        ) : (
          traces.map((trace) => (
            <div
              key={trace.trace_id}
              className="flex items-center gap-4 p-3 rounded border border-white/10 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              onClick={() => handleTraceClick(trace.trace_id)}
              role="button"
              tabIndex={0}
              aria-label={`Trace ${trace.trace_id}: ${getPipelinePath(trace)}, ${trace.latency_ms}ms, ${trace.status_code}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleTraceClick(trace.trace_id);
                }
              }}
            >
              <div className="flex-shrink-0 text-lg">
                {getStatusEmoji(trace)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-secondary font-mono truncate">
                    {trace.trace_id.slice(0, 12)}...
                  </span>
                  <span className="text-xs text-secondary">
                    {formatTimestamp(trace.timestamp)}
                  </span>
                </div>
                <div className="text-sm text-white truncate">
                  {getPipelinePath(trace)}
                </div>
              </div>
              <div className="flex-shrink-0 flex items-center gap-4 text-sm">
                <div className="text-white">
                  <span className="text-secondary">Latency: </span>
                  <span className={`font-semibold ${
                    trace.latency_ms < 250 ? 'text-green-400' :
                      trace.latency_ms < 350 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {trace.latency_ms}ms
                  </span>
                </div>
                <div className={`px-2 py-1 rounded text-xs ${
                  trace.status_code < 400
                    ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                    : 'bg-red-500/20 text-red-300 border border-red-500/30'
                }`}>
                  {trace.status_code}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 text-xs text-secondary text-center">
        💡 Hover to pause auto-scroll | Click trace to explore
      </div>
    </div>
  );
}

