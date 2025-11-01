import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import Dashboard from '@/components/Dashboard';

describe('Feature flag: FLAG_PARSE', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('when FLAG_PARSE=off, disables extraction (no hashtags) and shows placeholders', () => {
    process.env.FLAG_PARSE = 'off';
    render(<Dashboard />);
    const table = screen.getByRole('table', { name: 'गतिविधि सारणी' });
    const tbody = screen.getByTestId('tbody');
    expect(tbody).toBeInTheDocument();
    const rows = tbody.querySelectorAll('tr');
    expect(rows.length).toBeGreaterThan(40);
    // Expect placeholder and no hashtags in the टैग column
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    const tagCells = screen.getAllByLabelText('कौन/टैग');
    expect(tagCells.length).toBeGreaterThan(0);
    // Check a few samples
    for (const cell of tagCells.slice(0, 5)) {
      expect(cell.textContent || '').not.toMatch(/#/);
    }
  });
});
