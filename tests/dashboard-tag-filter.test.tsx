import '@testing-library/jest-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
import Dashboard from '@/components/Dashboard';

describe('Dashboard tag/mention quick filter', () => {
  it('filters by hashtag (e.g., #समारोह)', () => {
    render(<Dashboard />);
    const table = screen.getByRole('table', { name: 'गतिविधि सारणी' });
    const tbody = within(table).getByTestId('tbody');

    const baseline = within(tbody).getAllByRole('row').length;

    const input = screen.getByLabelText('टैग/मेंशन फ़िल्टर');
    fireEvent.change(input, { target: { value: '#समारोह' } });

    // Since the mock data doesn't contain #समारोह, most rows should be filtered out
    const rows = within(tbody).queryAllByRole('row');
    const filtered = rows.length;
    expect(filtered).toBeLessThan(baseline);
  });

  it('filters by mention (e.g., @PMOIndia)', () => {
    render(<Dashboard />);
    const table = screen.getByRole('table', { name: 'गतिविधि सारणी' });
    const tbody = within(table).getByTestId('tbody');

    const baseline = within(tbody).getAllByRole('row').length;

    const input = screen.getByLabelText('टैग/मेंशन फ़िल्टर');
    fireEvent.change(input, { target: { value: '@PMOIndia' } });

    // Since the mock data doesn't contain @PMOIndia, most rows should be filtered out
    const rows = within(tbody).queryAllByRole('row');
    const filtered = rows.length;
    expect(filtered).toBeLessThan(baseline);
  });
});
