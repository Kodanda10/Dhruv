/**
 * Hook for managing analytics module visibility toggles
 */

import { useState, useEffect, useCallback } from 'react';
import { AnalyticsModule } from '@/types/cms';

interface UseAnalyticsModulesReturn {
  modules: AnalyticsModule[];
  loading: boolean;
  error: string | null;
  toggleModule: (moduleKey: string, enabled: boolean) => Promise<boolean>;
  refreshModules: () => Promise<void>;
}

export function useAnalyticsModules(): UseAnalyticsModulesReturn {
  const [modules, setModules] = useState<AnalyticsModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModules = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/cms/config');
      if (!response.ok) {
        throw new Error('Failed to fetch modules');
      }
      const data = await response.json();
      if (data.success && data.data?.modules) {
        setModules(data.data.modules);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleModule = useCallback(async (moduleKey: string, enabled: boolean): Promise<boolean> => {
    try {
      setError(null);
      const response = await fetch('/api/cms/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'module',
          data: { module_key: moduleKey, enabled },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle module');
      }

      const result = await response.json();
      if (result.success && result.data) {
        // Update local state immediately for real-time UI update
        setModules((prev) =>
          prev.map((m) => (m.module_key === moduleKey ? result.data : m))
        );
        return true;
      }
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  return {
    modules,
    loading,
    error,
    toggleModule,
    refreshModules: fetchModules,
  };
}


