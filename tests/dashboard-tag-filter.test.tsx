import '@testing-library/jest-dom';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import Dashboard from '@/components/Dashboard';

describe('Dashboard tag/mention quick filter', () => {
  it('filters by scheme/tag keyword (e.g., #समारोह)', async () => {
    render(<Dashboard />);
    const table = await screen.findByRole('table', { name: 'गतिविधि सारणी' });
    const tbody = within(table).getByTestId('tbody');

    const baseline = (await within(tbody).findAllByRole('row')).length;

    const input = screen.getByLabelText('टैग/मेंशन फ़िल्टर');
    fireEvent.change(input, { target: { value: '#समारोह' } });

    await waitFor(() => {
      const filtered = within(tbody).getAllByRole('row').length;
      expect(filtered).toBeLessThanOrEqual(baseline);
    });

    // All remaining rows should include the hashtag in the tag cell
    for (const row of within(tbody).getAllByRole('row')) {
      const tagCell = within(row).getAllByRole('cell')[3];
      expect(tagCell.textContent || '').toMatch(/समारोह/);
    }
  });

  it('filters by mention (e.g., @PMOIndia)', async () => {
    render(<Dashboard />);
    const table = await screen.findByRole('table', { name: 'गतिविधि सारणी' });
    const tbody = within(table).getByTestId('tbody');

    const baseline = (await within(tbody).findAllByRole('row')).length;

    const input = screen.getByLabelText('टैग/मेंशन फ़िल्टर');
    fireEvent.change(input, { target: { value: '@PMOIndia' } });

    await waitFor(() => {
      const filtered = within(tbody).getAllByRole('row').length;
      expect(filtered).toBeLessThanOrEqual(baseline);
    });

    for (const row of within(tbody).getAllByRole('row')) {
      const tagCell = within(row).getAllByRole('cell')[3];
      expect(tagCell.textContent || '').toMatch(/@PMOIndia/);
    }
  });
});
