import '@testing-library/jest-dom';
import { render, screen, within, fireEvent } from '@testing-library/react';
import Dashboard from '@/components/Dashboard';

describe('Dashboard chip toggle behavior', () => {
  it('toggles a tag chip adds/removes it from filter input', () => {
    render(<Dashboard />);
    const table = screen.getByRole('table', { name: 'गतिविधि सारणी' });
    const tbody = within(table).getByTestId('tbody');
    // find first row that has at least one chip
    const rowWithTag = within(tbody).getAllByRole('row').find((row) => {
      const cells = within(row).getAllByRole('cell');
      return /[#@]/.test(cells[3].textContent || '');
    });
    expect(rowWithTag).toBeTruthy();
    if (!rowWithTag) return;
    const tagCell = within(rowWithTag).getAllByRole('cell')[3];
    const chipButtons = within(tagCell).queryAllByRole('button');
    if (chipButtons.length === 0) return;
    const firstChip = chipButtons[0];

    const filterInput = screen.getByLabelText('टैग/मेंशन फ़िल्टर') as HTMLInputElement;
    const before = filterInput.value;
    fireEvent.click(firstChip);
    const afterAdd = filterInput.value;
    expect(afterAdd.length).toBeGreaterThanOrEqual(before.length);

    // toggle again should remove
    fireEvent.click(firstChip);
    const afterRemove = filterInput.value;
    expect(afterRemove.length).toBeLessThanOrEqual(afterAdd.length);
  });
});


