import '@testing-library/jest-dom';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import Dashboard from '@/components/Dashboard';

// Mock API
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn().mockResolvedValue({
      success: true,
      events: [
        { tweet_id: '1', tweet_text: 'Test tweet 1', tweet_created_at: '2025-09-05', event_type: 'meeting', locations: [{name: 'रायपुर'}], overall_confidence: '0.8', needs_review: false },
        { tweet_id: '2', tweet_text: 'Test tweet 2', tweet_created_at: '2025-09-06', event_type: 'program', locations: [{name: 'बिलासपुर'}], overall_confidence: '0.9', needs_review: false },
        { tweet_id: '3', tweet_text: 'Test tweet 3', tweet_created_at: '2025-09-05', event_type: 'visit', locations: [{name: 'रायगढ़'}], overall_confidence: '0.7', needs_review: false }
      ]
    })
  }
}));

describe('Dashboard date range filter', () => {
  it('filters rows by inclusive date range', async () => {
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByRole('table', { name: 'गतिविधि सारणी' })).toBeInTheDocument();
    });
    const table = screen.getByRole('table', { name: 'गतिविधि सारणी' });
    const tbody = within(table).getByTestId('tbody');
    
    await waitFor(() => {
      const rows = within(tbody).queryAllByRole('row');
      expect(rows.length).toBeGreaterThan(0);
    });
    
    const before = within(tbody).getAllByRole('row').length;

    const from = screen.getByLabelText('तिथि से');
    const to = screen.getByLabelText('तिथि तक');

    fireEvent.change(from, { target: { value: '2025-09-05' } });
    fireEvent.change(to, { target: { value: '2025-09-05' } });

    await waitFor(() => {
      const after = within(tbody).getAllByRole('row').length;
      expect(after).toBeLessThanOrEqual(before);
    });

    // All remaining rows should be for 05 सितंबर 2025 (prefix may include day name)
    const rows = within(tbody).getAllByRole('row');
    if (rows.length > 0) {
      for (const row of rows) {
        const cells = within(row).getAllByRole('cell');
        if (cells.length > 0) {
          expect(cells[0].textContent || '').toMatch(/05.*सितंबर.*2025|2025.*09.*05/i);
        }
      }
    }
  });
});
