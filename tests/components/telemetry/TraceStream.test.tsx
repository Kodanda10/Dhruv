/**
 * Trace Stream Component Tests
 * Phase 8.6: Recent Trace Stream
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import TraceStream from '@/components/telemetry/TraceStream';
import { useTraces } from '@/hooks/useTraces';

// Mock the hook
jest.mock('@/hooks/useTraces');

describe('Trace Stream', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display live trace list', async () => {
    const mockTraces = [
      {
        trace_id: 'trace-1',
        timestamp: '2025-01-01T00:00:00Z',
        latency_ms: 100,
        status_code: 200,
        component: 'api',
        endpoint: '/api/test',
        method: 'GET',
      },
      {
        trace_id: 'trace-2',
        timestamp: '2025-01-01T00:01:00Z',
        latency_ms: 200,
        status_code: 200,
        component: 'system',
        endpoint: '/api/system',
        method: 'GET',
      },
    ];

    (useTraces as jest.Mock).mockReturnValue({
      traces: mockTraces,
      loading: false,
      error: null,
      refresh: jest.fn(),
      getTraceById: jest.fn(),
    });

    render(<TraceStream />);

    await waitFor(() => {
      expect(screen.getByText(/trace-1/i)).toBeInTheDocument();
      expect(screen.getByText(/trace-2/i)).toBeInTheDocument();
    });
  });

  it('should auto-scroll with pause on hover', async () => {
    const mockTraces = [
      {
        trace_id: 'trace-1',
        timestamp: '2025-01-01T00:00:00Z',
        latency_ms: 100,
        status_code: 200,
        component: 'api',
        endpoint: '/api/test',
        method: 'GET',
      },
    ];

    (useTraces as jest.Mock).mockReturnValue({
      traces: mockTraces,
      loading: false,
      error: null,
      refresh: jest.fn(),
      getTraceById: jest.fn(),
    });

    render(<TraceStream />);

    await waitFor(() => {
      const container = screen.getByRole('log');
      expect(container).toBeInTheDocument();
    });

    const container = screen.getByRole('log');
    fireEvent.mouseEnter(container);

    await waitFor(() => {
      expect(screen.getByText(/Paused/i)).toBeInTheDocument();
    });
  });

  it('should open Trace Explorer on click', async () => {
    const mockOnTraceClick = jest.fn();
    const mockTraces = [
      {
        trace_id: 'trace-1',
        timestamp: '2025-01-01T00:00:00Z',
        latency_ms: 100,
        status_code: 200,
        component: 'api',
        endpoint: '/api/test',
        method: 'GET',
      },
    ];

    (useTraces as jest.Mock).mockReturnValue({
      traces: mockTraces,
      loading: false,
      error: null,
      refresh: jest.fn(),
      getTraceById: jest.fn(),
    });

    render(<TraceStream onTraceClick={mockOnTraceClick} />);

    await waitFor(() => {
      const traceRow = screen.getByLabelText(/Trace trace-1/i);
      fireEvent.click(traceRow);
      expect(mockOnTraceClick).toHaveBeenCalledWith('trace-1');
    });
  });

  it('should update without lag', async () => {
    const mockTraces = Array.from({ length: 50 }, (_, i) => ({
      trace_id: `trace-${i}`,
      timestamp: new Date().toISOString(),
      latency_ms: Math.random() * 500,
      status_code: 200,
      component: 'api',
      endpoint: `/api/test${i}`,
      method: 'GET',
    }));

    (useTraces as jest.Mock).mockReturnValue({
      traces: mockTraces,
      loading: false,
      error: null,
      refresh: jest.fn(),
      getTraceById: jest.fn(),
    });

    const startTime = performance.now();
    render(<TraceStream />);
    const endTime = performance.now();

    const renderTime = endTime - startTime;
    // Should render quickly even with many traces
    expect(renderTime).toBeLessThan(1000); // Allow margin for test environment
  });
});

