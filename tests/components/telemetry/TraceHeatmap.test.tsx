/**
 * Trace Heatmap Component Tests
 * Phase 8.5: Latency Heatmap
 */

import { render, screen, waitFor } from '@testing-library/react';
import TraceHeatmap from '@/components/telemetry/TraceHeatmap';

// Mock fetch
global.fetch = jest.fn();

describe('Latency Heatmap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display p95 latency for each node', async () => {
    const mockMetrics = [
      {
        endpoint: '/api/test1',
        component: 'api',
        p50: 100,
        p95: 200,
        p99: 300,
        max: 400,
        request_count: 100,
        success_count: 95,
        error_count: 5,
      },
      {
        endpoint: '/api/test2',
        component: 'system',
        p50: 150,
        p95: 250,
        p99: 350,
        max: 450,
        request_count: 200,
        success_count: 190,
        error_count: 10,
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { metrics: mockMetrics },
      }),
    });

    render(<TraceHeatmap />);

    await waitFor(() => {
      expect(screen.getByText('200ms')).toBeInTheDocument();
      expect(screen.getByText('250ms')).toBeInTheDocument();
    });
  });

  it('should color-code by latency thresholds', async () => {
    const mockMetrics = [
      {
        endpoint: '/api/fast',
        component: 'api',
        p50: 100,
        p95: 200, // Green (<250)
        p99: 250,
        max: 300,
        request_count: 100,
        success_count: 100,
        error_count: 0,
      },
      {
        endpoint: '/api/slow',
        component: 'api',
        p50: 200,
        p95: 300, // Yellow (250-350)
        p99: 400,
        max: 500,
        request_count: 100,
        success_count: 95,
        error_count: 5,
      },
      {
        endpoint: '/api/failing',
        component: 'api',
        p50: 300,
        p95: 500, // Red (>350)
        p99: 600,
        max: 700,
        request_count: 100,
        success_count: 80,
        error_count: 20,
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { metrics: mockMetrics },
      }),
    });

    render(<TraceHeatmap />);

    await waitFor(() => {
      expect(screen.getByText('Normal')).toBeInTheDocument();
      expect(screen.getByText('Slow')).toBeInTheDocument();
      expect(screen.getByText('Failing')).toBeInTheDocument();
    });
  });

  it('should be accessible (keyboard nav, color-blind friendly)', async () => {
    const mockMetrics = [
      {
        endpoint: '/api/test',
        component: 'api',
        p50: 100,
        p95: 200,
        p99: 300,
        max: 400,
        request_count: 100,
        success_count: 100,
        error_count: 0,
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { metrics: mockMetrics },
      }),
    });

    render(<TraceHeatmap />);

    await waitFor(() => {
      const cells = screen.getAllByRole('button');
      expect(cells.length).toBeGreaterThan(0);
      
      // Check for aria-labels
      cells.forEach((cell) => {
        expect(cell).toHaveAttribute('aria-label');
        expect(cell).toHaveAttribute('tabIndex');
      });
    });
  });

  it('should show loading state', () => {
    (global.fetch as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<TraceHeatmap />);

    expect(screen.getByText(/लोड हो रहा है/i)).toBeInTheDocument();
  });

  it('should show error state', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(<TraceHeatmap />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });
});

