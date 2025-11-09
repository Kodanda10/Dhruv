/**
 * useTraces Hook Tests
 * Phase 8: Telemetry Extensions
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useTraces } from '@/hooks/useTraces';

// Mock fetch
global.fetch = jest.fn();

describe('useTraces Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch traces successfully', async () => {
    const mockTraces = [
      {
        trace_id: 'test-1',
        timestamp: '2025-01-01T00:00:00Z',
        latency_ms: 100,
        status_code: 200,
        component: 'api',
        endpoint: '/api/test',
        method: 'GET',
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { traces: mockTraces },
      }),
    });

    const { result } = renderHook(() => useTraces({ limit: 10 }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.traces).toEqual(mockTraces);
    expect(result.current.error).toBeNull();
  });

  it('should handle fetch errors', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useTraces());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.traces).toEqual([]);
  });

  it('should filter by component when provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { traces: [] },
      }),
    });

    renderHook(() => useTraces({ component: 'api', limit: 50 }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('component=api&limit=50')
      );
    });
  });

  it('should refresh traces on demand', async () => {
    const mockTraces = [
      {
        trace_id: 'test-1',
        timestamp: '2025-01-01T00:00:00Z',
        latency_ms: 100,
        status_code: 200,
        component: 'api',
        endpoint: '/api/test',
        method: 'GET',
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { traces: mockTraces },
      }),
    });

    const { result } = renderHook(() => useTraces({ autoRefresh: false }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.refresh();

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should find trace by ID', async () => {
    const mockTraces = [
      {
        trace_id: 'test-1',
        timestamp: '2025-01-01T00:00:00Z',
        latency_ms: 100,
        status_code: 200,
        component: 'api',
        endpoint: '/api/test',
        method: 'GET',
      },
      {
        trace_id: 'test-2',
        timestamp: '2025-01-01T00:01:00Z',
        latency_ms: 200,
        status_code: 200,
        component: 'api',
        endpoint: '/api/test2',
        method: 'POST',
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { traces: mockTraces },
      }),
    });

    const { result } = renderHook(() => useTraces({ autoRefresh: false }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const trace = result.current.getTraceById('test-2');
    expect(trace).toEqual(mockTraces[1]);
    expect(result.current.getTraceById('not-found')).toBeUndefined();
  });
});

