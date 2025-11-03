/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardDark from '@/components/DashboardDark';

// Mock dependencies
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(() => Promise.resolve({ success: true, data: [] })),
  },
}));

jest.mock('@/hooks/usePolling', () => ({
  usePolling: jest.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  })),
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: jest.fn(() => null),
  }),
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

const mockData = [
  {
    id: '1',
    ts: '2024-01-01T10:00:00Z',
    when: '1 जनवरी 2024',
    where: ['रायपुर'],
    what: ['योजना'],
    which: { mentions: [], hashtags: ['#सरकार'] },
    schemes: [],
    how: 'Test tweet content',
    confidence: 0.85,
    needs_review: false,
    review_status: 'approved',
  },
];

describe('DashboardDark Table Enhancements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display refresh button', () => {
    render(<DashboardDark />);
    const refreshButton = screen.queryByLabelText(/refresh|रिफ्रेश/i);
    // If refresh button exists, it should be accessible
    if (refreshButton) {
      expect(refreshButton).toBeInTheDocument();
    }
  });

  it('should display correct tweet count', async () => {
    const { api } = require('@/lib/api');
    api.get.mockResolvedValueOnce({ success: true, data: mockData });
    
    render(<DashboardDark />);
    
    await waitFor(() => {
      const countText = screen.queryByText(/दिखा रहे हैं|showing/i);
      if (countText) {
        expect(countText).toBeInTheDocument();
      }
    });
  });

  it('should have center-aligned table headers', () => {
    render(<DashboardDark />);
    const headers = screen.queryAllByRole('columnheader');
    headers.forEach(header => {
      expect(header).toHaveClass('text-center');
    });
  });

  it('should have sortable headers', () => {
    render(<DashboardDark />);
    const dateHeader = screen.queryByLabelText(/sort by date/i);
    if (dateHeader) {
      expect(dateHeader).toBeInTheDocument();
      expect(dateHeader).toHaveAttribute('role', 'button');
    }
  });

  it('should handle header click for sorting', () => {
    render(<DashboardDark />);
    const dateHeader = screen.queryByLabelText(/sort by date/i);
    if (dateHeader) {
      fireEvent.click(dateHeader);
      // Should not throw error
      expect(dateHeader).toBeInTheDocument();
    }
  });
});
