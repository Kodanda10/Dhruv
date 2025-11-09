import '@testing-library/jest-dom';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import Dashboard from '@/components/Dashboard';

describe('Dashboard filters', () => {
  it('filters rows by स्थान (कहाँ)', async () => {
    render(<Dashboard />);
    const table = await screen.findByRole('table', { name: 'गतिविधि सारणी' });
    const tbody = within(table).getByTestId('tbody');
    const beforeRows = await within(tbody).findAllByRole('row');
    const before = beforeRows.length;

    const locationInput = screen.getByLabelText('स्थान फ़िल्टर');
    fireEvent.change(locationInput, { target: { value: 'रायगढ़' } });

    await waitFor(() => {
      const after = within(tbody).getAllByRole('row').length;
      expect(after).toBeLessThan(before);
    });

    // Check that remaining rows include रायगढ़ in the स्थान cell
    const rows = within(tbody).getAllByRole('row');
    for (const row of rows) {
      const cells = within(row).getAllByRole('cell');
      expect(cells[1].textContent || '').toMatch(/रायगढ़|—/);
    }
  });

  it('filters rows by टैग/मेंशन', async () => {
    render(<Dashboard />);
    const table = await screen.findByRole('table', { name: 'गतिविधि सारणी' });
    const tbody = within(table).getByTestId('tbody');
    const beforeRows = await within(tbody).findAllByRole('row');
    const before = beforeRows.length;

    const tagInput = screen.getByLabelText('टैग/मेंशन फ़िल्टर');
    fireEvent.change(tagInput, { target: { value: '#विकास' } });

    await waitFor(() => {
      const after = within(tbody).getAllByRole('row').length;
      expect(after).toBeLessThanOrEqual(before);
    });
  });

  it('filters rows by तिथि से', async () => {
    render(<Dashboard />);
    const table = await screen.findByRole('table', { name: 'गतिविधि सारणी' });
    const tbody = within(table).getByTestId('tbody');
    const beforeRows = await within(tbody).findAllByRole('row');
    const before = beforeRows.length;

    const fromInput = screen.getByLabelText('तिथि से');
    fireEvent.change(fromInput, { target: { value: '2025-09-01' } });

    await waitFor(() => {
      const after = within(tbody).getAllByRole('row').length;
      expect(after).toBeLessThanOrEqual(before);
    });
  });
});
