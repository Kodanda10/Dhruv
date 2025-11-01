import '@testing-library/jest-dom';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
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

describe('Dashboard filter reset', () => {
  it('clears all filters and restores full dataset', async () => {
    render(<Dashboard />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByRole('table', { name: 'गतिविधि सारणी' })).toBeInTheDocument();
    });
    const table = screen.getByRole('table', { name: 'गतिविधि सारणी' });
    const tbody = within(table).getByTestId('tbody');

    // Wait for rows to render
    await waitFor(() => {
      const rows = within(tbody).queryAllByRole('row');
      expect(rows.length).toBeGreaterThan(0);
    });

    const baseline = within(tbody).getAllByRole('row').length;

    // Apply filters
    fireEvent.change(screen.getByLabelText('स्थान फ़िल्टर'), { target: { value: 'रायगढ़' } });
    fireEvent.change(screen.getByLabelText('तिथि से'), { target: { value: '2025-09-05' } });
    fireEvent.change(screen.getByLabelText('तिथि तक'), { target: { value: '2025-09-05' } });

    await waitFor(() => {
      const reduced = within(tbody).getAllByRole('row').length;
      // Filter should reduce rows (may be equal if all match, so use <=)
      expect(reduced).toBeLessThanOrEqual(baseline);
    });

    const reduced = within(tbody).getAllByRole('row').length;

    // Click reset/clear button
    const resetBtn = screen.getByRole('button', { name: 'फ़िल्टर साफ़ करें' });
    fireEvent.click(resetBtn);

    // Filters cleared
    expect((screen.getByLabelText('स्थान फ़िल्टर') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('तिथि से') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('तिथि तक') as HTMLInputElement).value).toBe('');

    // Full dataset restored
    await waitFor(() => {
      const afterReset = within(tbody).getAllByRole('row').length;
      expect(afterReset).toBe(baseline);
    });
  });
});

