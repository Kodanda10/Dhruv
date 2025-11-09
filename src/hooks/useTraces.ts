/**
 * useTraces Hook
 * Phase 8: Telemetry Extensions
 * Manages trace data fetching and state for telemetry components
 */

import { useState, useEffect, useCallback } from 'react';
import { TraceLog } from '@/middleware/traceLogger';

interface UseTracesOptions {
  component?: string;
  limit?: number;
  refreshInterval?: number; // in milliseconds
  autoRefresh?: boolean;
}

interface UseTracesReturn {
  traces: TraceLog[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getTraceById: (traceId: string) => TraceLog | undefined;
}

export function useTraces(options: UseTracesOptions = {}): UseTracesReturn {
  const {
    component,
    limit = 100,
    refreshInterval = 10000, // 10 seconds default
    autoRefresh = true,
  } = options;

  const [traces, setTraces] = useState<TraceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTraces = useCallback(async () => {
    try {
      setError(null);
      const url = component
        ? `/api/system/traces?component=${component}&limit=${limit}`
        : `/api/system/traces?limit=${limit}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch traces');
      }
      
      const result = await response.json();
      if (result.success && result.data?.traces) {
        setTraces(result.data.traces);
      } else {
        setTraces([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setTraces([]);
    } finally {
      setLoading(false);
    }
  }, [component, limit]);

  const getTraceById = useCallback(
    (traceId: string): TraceLog | undefined => {
      return traces.find((t) => t.trace_id === traceId);
    },
    [traces]
  );

  useEffect(() => {
    fetchTraces();
    
    if (autoRefresh) {
      const interval = setInterval(fetchTraces, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchTraces, autoRefresh, refreshInterval]);

  return {
    traces,
    loading,
    error,
    refresh: fetchTraces,
    getTraceById,
  };
}

