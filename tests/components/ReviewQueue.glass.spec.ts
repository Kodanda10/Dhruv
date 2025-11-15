/**
 * ReviewQueue Component Glass Migration Tests
 *
 * Validates that ReviewQueue component properly uses glass-section-card
 * for all UI elements and maintains proper styling.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReviewQueue from '@/components/review/ReviewQueue';

// Mock dependencies
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock('@/utils/parse', () => ({
  parsePost: jest.fn(),
}));

describe('ReviewQueue glass-section-card usage', () => {
  const mockEvents = [
    {
      id: 1,
      timestamp: '2024-01-01T00:00:00Z',
      content: 'Test event content',
      parsed: {
        where: ['रायगढ़'],
        what: ['education'],
        confidence: 0.9,
      },
      needs_review: true,
      review_status: 'pending',
    },
    {
      id: 2,
      timestamp: '2024-01-02T00:00:00Z',
      content: 'Another test event',
      parsed: {
        where: ['बिलासपुर'],
        what: ['healthcare'],
        confidence: 0.8,
      },
      needs_review: true,
      review_status: 'pending',
    },
  ];

  beforeEach(() => {
    const mockApi = require('@/lib/api').api;
    mockApi.get.mockResolvedValue({ data: mockEvents });
    mockApi.post.mockResolvedValue({ success: true });
  });

  it('renders without crashing', () => {
    expect(() => render(<ReviewQueue />)).not.toThrow();
  });

  it('main queue container uses glass-section-card', async () => {
    render(<ReviewQueue />);

    await waitFor(() => {
      const mainContainer = screen.getByText(/Test event content/).closest('.glass-section-card');
      expect(mainContainer).toHaveClass('glass-section-card');
    });
  });

  it('status indicator cards use glass-section-card', async () => {
    render(<ReviewQueue />);

    await waitFor(() => {
      // Look for status cards (approved/rejected/pending)
      const statusCards = screen.getAllByText(/pending|approved|rejected/i).map(el =>
        el.closest('.glass-section-card')
      ).filter(Boolean);

      expect(statusCards.length).toBeGreaterThan(0);
      statusCards.forEach(card => {
        expect(card).toHaveClass('glass-section-card');
      });
    });
  });

  it('confidence-based styling uses glass-section-card', async () => {
    render(<ReviewQueue />);

    await waitFor(() => {
      // High confidence event
      const highConfidenceCard = screen.getByText('Test event content').closest('.glass-section-card');
      expect(highConfidenceCard).toHaveClass('glass-section-card');
    });
  });

  it('action buttons container uses glass-section-card', async () => {
    render(<ReviewQueue />);

    await waitFor(() => {
      const actionButtons = screen.getAllByRole('button').find(btn =>
        btn.textContent?.includes('Approve') || btn.textContent?.includes('Reject')
      );

      if (actionButtons) {
        const buttonContainer = actionButtons.closest('.glass-section-card');
        expect(buttonContainer).toHaveClass('glass-section-card');
      }
    });
  });

  it('has no legacy glassmorphic-card classes', async () => {
    render(<ReviewQueue />);

    await waitFor(() => {
      const legacyElements = document.querySelectorAll('.glassmorphic-card');
      expect(legacyElements.length).toBe(0);
    });
  });

  it('maintains white text on glass backgrounds', async () => {
    render(<ReviewQueue />);

    await waitFor(() => {
      const textElements = screen.getAllByText(/Test event|Another test/).concat(
        screen.getAllByText(/pending|approved|rejected/i)
      );

      textElements.forEach(element => {
        const computedStyle = window.getComputedStyle(element);
        expect(computedStyle.color).toBe('rgb(255, 255, 255)');
      });
    });
  });

  it('confidence indicators have appropriate glass styling', async () => {
    render(<ReviewQueue />);

    await waitFor(() => {
      // Look for confidence-based border styling
      const confidenceCards = document.querySelectorAll('.glass-section-card');

      confidenceCards.forEach(card => {
        const classList = card.className;
        // Should have some form of confidence-based styling
        expect(classList).toMatch(/border|bg-/);
      });
    });
  });

  it('status change interactions maintain glass styling', async () => {
    const user = userEvent.setup();
    render(<ReviewQueue />);

    await waitFor(() => {
      const approveButton = screen.getByText('Approve');
      expect(approveButton).toBeInTheDocument();
    });

    const approveButton = screen.getByText('Approve');
    const buttonContainer = approveButton.closest('.glass-section-card');

    // Container should maintain glass styling
    expect(buttonContainer).toHaveClass('glass-section-card');

    // Click should not break styling
    await user.click(approveButton);

    // Container should still have glass styling after interaction
    expect(buttonContainer).toHaveClass('glass-section-card');
  });

  it('pagination controls use glass-section-card if present', async () => {
    // If pagination is implemented, it should use glass styling
    render(<ReviewQueue />);

    await waitFor(() => {
      const paginationElements = screen.queryAllByText(/Previous|Next|Page/i);

      if (paginationElements.length > 0) {
        paginationElements.forEach(element => {
          const container = element.closest('.glass-section-card');
          expect(container).toHaveClass('glass-section-card');
        });
      }
    });
  });

  it('empty state uses glass-section-card if present', async () => {
    // Mock empty queue
    const mockApi = require('@/lib/api').api;
    mockApi.get.mockResolvedValue({ data: [] });

    render(<ReviewQueue />);

    await waitFor(() => {
      const emptyMessage = screen.queryByText(/No events|Empty/i);
      if (emptyMessage) {
        const container = emptyMessage.closest('.glass-section-card');
        expect(container).toHaveClass('glass-section-card');
      }
    });
  });
});