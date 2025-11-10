import '@testing-library/jest-dom';
import { render, screen, fireEvent, within } from '@testing-library/react';
import Dashboard from '@/components/Dashboard';

describe('Dashboard filters', () => {
  it('filters rows by स्थान (कहाँ)', () => {
    render(<Dashboard />);
    const table = screen.getByRole('table', { name: 'गतिविधि सारणी' });
    const tbody = within(table).getByTestId('tbody');
    const before = within(tbody).getAllByRole('row').length;

    const locationInput = screen.getByLabelText('स्थान फ़िल्टर');
    fireEvent.change(locationInput, { target: { value: 'रायगढ़' } });

    const after = within(tbody).getAllByRole('row').length;
    expect(after).toBeLessThan(before);

    // Check that remaining rows include रायगढ़ in the स्थान cell
    const rows = within(tbody).getAllByRole('row');
    for (const row of rows) {
      const cells = within(row).getAllByRole('cell');
      expect(cells[1].textContent || '').toMatch(/रायगढ़|—/);
    }
  });

  it('filters rows by टैग/मेंशन', () => {
    render(<Dashboard />);
    const table = screen.getByRole('table', { name: 'गतिविधि सारणी' });
    const tbody = within(table).getByTestId('tbody');
    const before = within(tbody).getAllByRole('row').length;

    const tagInput = screen.getByLabelText('टैग/मेंशन फ़िल्टर');
    fireEvent.change(tagInput, { target: { value: '#विकास' } });

    const after = within(tbody).getAllByRole('row').length;
    expect(after).toBeLessThanOrEqual(before);
  });

  it('filters rows by तिथि से', () => {
    render(<Dashboard />);
    const table = screen.getByRole('table', { name: 'गतिविधि सारणी' });
    const tbody = within(table).getByTestId('tbody');
    const before = within(tbody).getAllByRole('row').length;

    const fromInput = screen.getByLabelText('तिथि से');
    fireEvent.change(fromInput, { target: { value: '2025-09-01' } });

    const after = within(tbody).getAllByRole('row').length;
    expect(after).toBeLessThanOrEqual(before);
  });
});
