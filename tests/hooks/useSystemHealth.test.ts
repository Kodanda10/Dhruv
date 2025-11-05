/**
 * useSystemHealth Hook Tests
 *
 * Tests for the system health monitoring hook that provides
 * reactive health status updates for the CommandView dashboard.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useSystemHealth } from '../../src/hooks/useSystemHealth';

// Mock fetch
global.fetch = jest.fn();

describe('useSystemHealth Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initial State', () => {
    it('should start with loading state and null data', () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' })
      });

      const { result } = renderHook(() => useSystemHealth());

      expect(result.current.loading).toBe(true);
      expect(result.current.healthData).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should respect enabled option', () => {
      const { result } = renderHook(() => useSystemHealth({ enabled: false }));

      expect(result.current.loading).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Successful Data Fetching', () => {
    it('should fetch and set health data successfully', async () => {
      const mockHealthData = {
        status: 'healthy',
        timestamp: '2025-11-04T10:30:00Z',
        uptime_seconds: 3600,
        version: '1.0.0',
        services: {
          database: { status: 'healthy', latency: 45 },
          twitter_api: { status: 'healthy', latency: 120 },
          gemini_api: { status: 'healthy', latency: 180 },
          ollama_api: { status: 'healthy', latency: 95 }
        },
        frontend: {
          build_status: 'success',
          last_build: '2025-11-04T10:00:00Z',
          bundle_size: '2.4MB'
        }
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockHealthData)
      });

      const { result } = renderHook(() => useSystemHealth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.healthData).toEqual(mockHealthData);
      expect(result.current.error).toBeNull();
      expect(result.current.isHealthy).toBe(true);
      expect(result.current.isDegraded).toBe(false);
      expect(result.current.isUnhealthy).toBe(false);
    });

    it('should update status flags correctly for degraded system', async () => {
      const mockHealthData = {
        status: 'degraded',
        services: { database: { status: 'degraded' } },
        frontend: { build_status: 'success' }
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockHealthData)
      });

      const { result } = renderHook(() => useSystemHealth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isHealthy).toBe(false);
      expect(result.current.isDegraded).toBe(true);
      expect(result.current.isUnhealthy).toBe(false);
    });

    it('should update status flags correctly for unhealthy system', async () => {
      const mockHealthData = {
        status: 'unhealthy',
        services: { database: { status: 'unhealthy' } },
        frontend: { build_status: 'success' }
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockHealthData)
      });

      const { result } = renderHook(() => useSystemHealth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isHealthy).toBe(false);
      expect(result.current.isDegraded).toBe(false);
      expect(result.current.isUnhealthy).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useSystemHealth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.healthData).toBeNull();
      expect(result.current.isHealthy).toBe(false);
      expect(result.current.isDegraded).toBe(false);
      expect(result.current.isUnhealthy).toBe(false);
    });

    it('should handle HTTP error responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500
      });

      const { result } = renderHook(() => useSystemHealth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Health check failed: 500');
    });
  });

  describe('Auto-refresh Functionality', () => {
    it('should auto-refresh data at specified interval', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy', timestamp: Date.now() })
      });

      const { result } = renderHook(() => useSystemHealth({ refreshInterval: 1000 }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Fast-forward time
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });

    it('should not auto-refresh when disabled', () => {
      const { result } = renderHook(() => useSystemHealth({ enabled: false }));

      expect(result.current.loading).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Manual Refresh', () => {
    it('should allow manual data refresh', async () => {
      const mockData1 = { status: 'healthy', timestamp: '2025-11-04T10:00:00Z' };
      const mockData2 = { status: 'healthy', timestamp: '2025-11-04T10:01:00Z' };

      let callCount = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(callCount === 1 ? mockData1 : mockData2)
        });
      });

      const { result } = renderHook(() => useSystemHealth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.healthData).toEqual(mockData1);
      expect(callCount).toBe(1);

      // Manual refresh
      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.healthData).toEqual(mockData2);
      expect(callCount).toBe(2);
    });
  });

  describe('Configuration Options', () => {
    it('should use custom refresh interval', () => {
      const customInterval = 5000;

      renderHook(() => useSystemHealth({ refreshInterval: customInterval }));

      // Verify that setInterval was called with custom interval
      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), customInterval);
    });

    it('should handle disabled state correctly', () => {
      const { result } = renderHook(() => useSystemHealth({ enabled: false }));

      expect(result.current.loading).toBe(false);
      expect(result.current.healthData).toBeNull();
      expect(result.current.error).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
