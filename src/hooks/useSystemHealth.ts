/**
 * System Health Hook
 *
 * Provides reactive health monitoring for system components.
 * Polls health endpoint at regular intervals and provides
 * real-time status updates for the CommandView dashboard.
 */

import { useState, useEffect, useCallback } from 'react';

interface HealthService {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  error?: string;
  [key: string]: any;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime_seconds: number;
  version: string;
  services: {
    database: HealthService;
    twitter_api: HealthService;
    gemini_api: HealthService;
    ollama_api: HealthService;
  };
  frontend: {
    build_status: string;
    last_build: string;
    bundle_size: string;
  };
}

interface UseSystemHealthOptions {
  refreshInterval?: number;
  enabled?: boolean;
}

interface UseSystemHealthReturn {
  healthData: HealthResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isHealthy: boolean;
  isDegraded: boolean;
  isUnhealthy: boolean;
}

export function useSystemHealth(options: UseSystemHealthOptions = {}): UseSystemHealthReturn {
  const { refreshInterval = 30000, enabled = true } = options;

  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setLoading(true);

      const response = await fetch('/api/system/health');
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      const data: HealthResponse = await response.json();
      setHealthData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    fetchHealth();

    const interval = setInterval(fetchHealth, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchHealth, refreshInterval, enabled]);

  const isHealthy = healthData?.status === 'healthy';
  const isDegraded = healthData?.status === 'degraded';
  const isUnhealthy = healthData?.status === 'unhealthy';

  return {
    healthData,
    loading,
    error,
    refetch: fetchHealth,
    isHealthy,
    isDegraded,
    isUnhealthy
  };
}
