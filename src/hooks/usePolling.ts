import { useCallback, useEffect, useRef, useState } from 'react';

export interface UsePollingOptions {
  interval: number; // milliseconds
  enabled?: boolean;
  onNewData?: (newData: any[], previousData: any[]) => void;
}

export function usePolling<T>(
  fetchFn: () => Promise<T[]>,
  options: UsePollingOptions
) {
  const { interval, enabled = true, onNewData } = options;
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasNewData, setHasNewData] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousDataRef = useRef<T[]>([]);

  const fetchData = useCallback(async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const newData = await fetchFn();
      const previousData = previousDataRef.current;
      
      // Check if there's new data
      if (previousData.length > 0 && newData.length > previousData.length) {
        setHasNewData(true);
        onNewData?.(newData, previousData);
      }
      
      setData(newData);
      previousDataRef.current = newData;
    } catch (error) {
      console.error('Polling fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn, isLoading, onNewData]);

  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    fetchData();

    // Set up polling
    intervalRef.current = setInterval(fetchData, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, interval, fetchData]);

  const clearNewDataNotification = () => {
    setHasNewData(false);
  };

  return {
    data,
    isLoading,
    hasNewData,
    clearNewDataNotification,
    refetch: fetchData
  };
}
