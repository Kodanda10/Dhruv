/**
 * Error Table Component Tests
 * Phase 8.4: Error Snapshot Panel
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ErrorTable from '@/components/telemetry/ErrorTable';

// Mock fetch
global.fetch = jest.fn();

describe('Error Snapshot Panel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display recent errors', async () => {
    const mockErrors = [
      {
        trace_id: 'error-1',
        timestamp: '2025-01-01T00:00:00Z',
        latency_ms: 100,
        status_code: 500,
        component: 'api',
        endpoint: '/api/test',
        method: 'GET',
        error_message: 'Internal server error',
        severity: 'critical' as const,
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { errors: mockErrors },
      }),
    });

    render(<ErrorTable />);

    await waitFor(() => {
      expect(screen.getByText('error-1')).toBeInTheDocument();
      expect(screen.getByText('Internal server error')).toBeInTheDocument();
    });
  });

  it('should filter by component', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { errors: [] },
      }),
    });

    render(<ErrorTable />);

    await waitFor(() => {
      const componentSelect = screen.getByLabelText(/Filter by component/i);
      expect(componentSelect).toBeInTheDocument();
    });

    const componentSelect = screen.getByLabelText(/Filter by component/i);
    fireEvent.change(componentSelect, { target: { value: 'api' } });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('component=api')
      );
    });
  });

  it('should highlight by severity', async () => {
    const mockErrors = [
      {
        trace_id: 'error-1',
        timestamp: '2025-01-01T00:00:00Z',
        latency_ms: 100,
        status_code: 500,
        component: 'api',
        endpoint: '/api/test',
        method: 'GET',
        error_message: 'Critical error',
        severity: 'critical' as const,
      },
      {
        trace_id: 'error-2',
        timestamp: '2025-01-01T00:01:00Z',
        latency_ms: 200,
        status_code: 404,
        component: 'api',
        endpoint: '/api/notfound',
        method: 'GET',
        severity: 'low' as const,
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { errors: mockErrors },
      }),
    });

    render(<ErrorTable />);

    await waitFor(() => {
      expect(screen.getByText('CRITICAL')).toBeInTheDocument();
      expect(screen.getByText('LOW')).toBeInTheDocument();
    });
  });

  it('should call onTraceClick when trace ID is clicked', async () => {
    const mockOnTraceClick = jest.fn();
    const mockErrors = [
      {
        trace_id: 'error-1',
        timestamp: '2025-01-01T00:00:00Z',
        latency_ms: 100,
        status_code: 500,
        component: 'api',
        endpoint: '/api/test',
        method: 'GET',
        error_message: 'Error',
        severity: 'critical' as const,
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { errors: mockErrors },
      }),
    });

    render(<ErrorTable onTraceClick={mockOnTraceClick} />);

    await waitFor(() => {
      const traceButton = screen.getByLabelText(/View trace error-1/i);
      fireEvent.click(traceButton);
      expect(mockOnTraceClick).toHaveBeenCalledWith('error-1');
    });
  });

  it('should filter by time window', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { errors: [] },
      }),
    });

    render(<ErrorTable />);

    await waitFor(() => {
      const timeSelect = screen.getByLabelText(/Filter by time window/i);
      expect(timeSelect).toBeInTheDocument();
    });

    const timeSelect = screen.getByLabelText(/Filter by time window/i);
    fireEvent.change(timeSelect, { target: { value: '30' } });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('minutes=30')
      );
    });
  });
});

