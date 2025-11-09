/**
 * Trace Explorer Modal Component Tests
 * Phase 8.3: Trace Timeline Inspector
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import TraceExplorerModal from '@/components/telemetry/TraceExplorerModal';

// Mock fetch
global.fetch = jest.fn();

describe('Trace Explorer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display trace timeline', async () => {
    const mockTrace = {
      trace_id: 'test-trace-1',
      timestamp: '2025-01-01T00:00:00Z',
      latency_ms: 250,
      status_code: 200,
      component: 'api',
      endpoint: '/api/test',
      method: 'GET',
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockTrace,
      }),
    });

    render(
      <TraceExplorerModal
        traceId="test-trace-1"
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('test-trace-1')).toBeInTheDocument();
      expect(screen.getByText(/Pipeline Timeline/i)).toBeInTheDocument();
    });
  });

  it('should show raw JSON on hover/click', async () => {
    const mockTrace = {
      trace_id: 'test-trace-1',
      timestamp: '2025-01-01T00:00:00Z',
      latency_ms: 250,
      status_code: 200,
      component: 'api',
      endpoint: '/api/test',
      method: 'GET',
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockTrace,
      }),
    });

    render(
      <TraceExplorerModal
        traceId="test-trace-1"
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      const showButton = screen.getByText(/Show Raw JSON/i);
      fireEvent.click(showButton);
      expect(screen.getByText(/Hide Raw JSON/i)).toBeInTheDocument();
    });
  });

  it('should open logs view', async () => {
    const mockTrace = {
      trace_id: 'test-trace-1',
      timestamp: '2025-01-01T00:00:00Z',
      latency_ms: 250,
      status_code: 200,
      component: 'api',
      endpoint: '/api/test',
      method: 'GET',
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockTrace,
      }),
    });

    const mockOpen = jest.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <TraceExplorerModal
        traceId="test-trace-1"
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      const viewLogsButton = screen.getByText(/View Logs/i);
      fireEvent.click(viewLogsButton);
      expect(mockOpen).toHaveBeenCalledWith('/logs/test-trace-1', '_blank');
    });

    mockOpen.mockRestore();
  });

  it('should not render when closed', () => {
    render(
      <TraceExplorerModal
        traceId="test-trace-1"
        isOpen={false}
        onClose={jest.fn()}
      />
    );

    expect(screen.queryByText(/Trace Explorer/i)).not.toBeInTheDocument();
  });

  it('should call onClose when backdrop is clicked', () => {
    const mockOnClose = jest.fn();
    render(
      <TraceExplorerModal
        traceId="test-trace-1"
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const backdrop = screen.getByRole('dialog').parentElement;
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });
});

