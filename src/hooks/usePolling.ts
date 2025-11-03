import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/utils/logger';

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
  const fetchFnRef = useRef(fetchFn);

  // Update the ref when fetchFn changes
  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

  const fetchData = useCallback(async () => {
    if (isLoading) return;
    
    logger.debug('usePolling: Starting fetch...');
    setIsLoading(true);
    try {
      const newData = await fetchFnRef.current();
      logger.debug('usePolling: Fetched data length:', newData.length);
      const previousData = previousDataRef.current;
      
      // Check if there's new data
      if (previousData.length > 0 && newData.length > previousData.length) {
        setHasNewData(true);
        onNewData?.(newData, previousData);
      }
      
      setData(newData);
      previousDataRef.current = newData;
    } catch (error) {
      logger.error('Polling fetch error:', error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, onNewData]);

  useEffect(() => {
    logger.debug('usePolling: useEffect triggered, enabled:', enabled);
    if (!enabled) return;

    // Initial fetch
    logger.debug('usePolling: Starting initial fetch...');
    fetchData();

    // Set up polling
    logger.debug('usePolling: Setting up polling interval:', interval);
    intervalRef.current = setInterval(fetchData, interval);

    return () => {
      logger.debug('usePolling: Cleaning up interval');
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
