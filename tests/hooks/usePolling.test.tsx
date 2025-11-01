import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { usePolling } from '@/hooks/usePolling';

// Mock console methods
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

type TestItem = { id: number };

describe('usePolling', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'setTimeout'] });
    consoleLogSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should fetch data initially', async () => {
    const testData: TestItem[] = [{ id: 1 }, { id: 2 }];
    const fetchFn = jest.fn<() => Promise<TestItem[]>>().mockResolvedValue(testData);

    const { result } = renderHook(() =>
      usePolling(fetchFn, { interval: 1000 })
    );

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(true);

    // Wait for async operation
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(testData);
  });

  it('should poll data at specified interval', async () => {
    const fetchFn = jest.fn<() => Promise<TestItem[]>>()
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }]);

    const { result } = renderHook(() =>
      usePolling(fetchFn, { interval: 1000 })
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual([{ id: 1 }]);

    // Fast-forward time
    await act(async () => {
      jest.advanceTimersByTime(1000);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(3);
    });
  });

  it('should not poll when enabled is false', async () => {
    const testData: TestItem[] = [{ id: 1 }];
    const fetchFn = jest.fn<() => Promise<TestItem[]>>().mockResolvedValue(testData);

    const { result, rerender } = renderHook(
      ({ enabled }) => usePolling(fetchFn, { interval: 1000, enabled }),
      { initialProps: { enabled: false } }
    );

    expect(fetchFn).not.toHaveBeenCalled();

    // Enable polling
    await act(async () => {
      rerender({ enabled: true });
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    expect(result.current.data).toEqual(testData);
  });

  it('should call onNewData when new data arrives', async () => {
    const onNewData = jest.fn();
    const fetchFn = jest.fn<() => Promise<TestItem[]>>()
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

    renderHook(() =>
      usePolling(fetchFn, { interval: 1000, onNewData })
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(onNewData).toHaveBeenCalledWith(
        [{ id: 1 }, { id: 2 }],
        [{ id: 1 }]
      );
    });
  });

  it('should set hasNewData when new data arrives', async () => {
    const fetchFn = jest.fn<() => Promise<TestItem[]>>()
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

    const { result } = renderHook(() =>
      usePolling(fetchFn, { interval: 1000 })
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(result.current.hasNewData).toBe(true);
    });
  });

  it('should clear hasNewData notification', async () => {
    const fetchFn = jest.fn<() => Promise<TestItem[]>>()
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

    const { result } = renderHook(() =>
      usePolling(fetchFn, { interval: 1000 })
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(result.current.hasNewData).toBe(true);
    });

    act(() => {
      result.current.clearNewDataNotification();
    });

    expect(result.current.hasNewData).toBe(false);
  });

  it('should handle fetch errors gracefully', async () => {
    const fetchFn = jest.fn<() => Promise<TestItem[]>>().mockRejectedValue(new Error('Fetch failed'));

    const { result } = renderHook(() =>
      usePolling(fetchFn, { interval: 1000 })
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('should not fetch when already loading', async () => {
    let resolveFirst: (value: TestItem[]) => void;
    const firstPromise = new Promise<TestItem[]>((resolve) => {
      resolveFirst = resolve;
    });

    const fetchFn = jest.fn<() => Promise<TestItem[]>>()
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValueOnce([{ id: 2 }]);

    renderHook(() =>
      usePolling(fetchFn, { interval: 100 })
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Trigger another poll before first completes
    await act(async () => {
      jest.advanceTimersByTime(100);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    // Resolve first call
    await act(async () => {
      resolveFirst!([{ id: 1 }]);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });
  });

  it('should update when fetchFn changes', async () => {
    const fetchFn1 = jest.fn<() => Promise<TestItem[]>>().mockResolvedValue([{ id: 1 }]);
    const fetchFn2 = jest.fn<() => Promise<TestItem[]>>().mockResolvedValue([{ id: 2 }]);

    const { result, rerender } = renderHook(
      ({ fetchFn }) => usePolling(fetchFn, { interval: 1000 }),
      { initialProps: { fetchFn: fetchFn1 } }
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(fetchFn1).toHaveBeenCalled();
    });

    await act(async () => {
      rerender({ fetchFn: fetchFn2 });
      jest.advanceTimersByTime(1000);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(fetchFn2).toHaveBeenCalled();
    });
  });

  it('should provide refetch function', async () => {
    const testData: TestItem[] = [{ id: 1 }];
    const fetchFn = jest.fn<() => Promise<TestItem[]>>().mockResolvedValue(testData);

    const { result } = renderHook(() =>
      usePolling(fetchFn, { interval: 1000 })
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      result.current.refetch();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });
  });

  it('should cleanup interval on unmount', () => {
    const fetchFn = jest.fn<() => Promise<TestItem[]>>().mockResolvedValue([{ id: 1 }]);
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    const { unmount } = renderHook(() =>
      usePolling(fetchFn, { interval: 1000 })
    );

    act(() => {
      unmount();
    });

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('should not detect new data if previous data is empty', async () => {
    const onNewData = jest.fn();
    const fetchFn = jest.fn<() => Promise<TestItem[]>>()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 1 }]);

    const { result } = renderHook(() =>
      usePolling(fetchFn, { interval: 1000, onNewData })
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(onNewData).not.toHaveBeenCalled();
    });

    expect(result.current.hasNewData).toBe(false);
  });
});

