/**
 * Hook for managing editable titles in CMS
 */

import { useState, useEffect, useCallback } from 'react';
import { CMSTitle } from '@/types/cms';

interface UseEditableTitlesReturn {
  titles: CMSTitle[];
  loading: boolean;
  error: string | null;
  updateTitle: (key: string, value_hi: string, value_en?: string, section?: string) => Promise<boolean>;
  refreshTitles: () => Promise<void>;
}

export function useEditableTitles(): UseEditableTitlesReturn {
  const [titles, setTitles] = useState<CMSTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTitles = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/cms/config');
      if (!response.ok) {
        throw new Error('Failed to fetch titles');
      }
      const data = await response.json();
      if (data.success && data.data?.titles) {
        setTitles(data.data.titles);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTitle = useCallback(async (
    key: string,
    value_hi: string,
    value_en?: string,
    section?: string
  ): Promise<boolean> => {
    try {
      setError(null);
      const response = await fetch('/api/cms/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'title',
          data: { key, value_hi, value_en, section: section || 'dashboard' },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update title');
      }

      const result = await response.json();
      if (result.success && result.data) {
        // Update local state
        setTitles((prev) => {
          const existing = prev.find((t) => t.key === key);
          if (existing) {
            return prev.map((t) => (t.key === key ? result.data : t));
          }
          return [...prev, result.data];
        });
        return true;
      }
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, []);

  useEffect(() => {
    fetchTitles();
  }, [fetchTitles]);

  return {
    titles,
    loading,
    error,
    updateTitle,
    refreshTitles: fetchTitles,
  };
}


