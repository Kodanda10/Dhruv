import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import Dashboard from '@/components/Dashboard';

describe('Dashboard', () => {
  it('renders a Hindi table with headers and data rows', async () => {
    render(<Dashboard />);

    const table = await screen.findByRole('table', { name: 'गतिविधि सारणी' });
    const headers = within(table).getAllByRole('columnheader').map((th) => th.textContent);

    expect(headers).toEqual([
      'दिन / दिनांक',
      '📍 स्थान',
      '🎯 दौरा / कार्यक्रम',
      '👥 कौन/टैग',
      '📝 विवरण',
    ]);

    // First row is header; count tbody rows separately
    const tbody = within(table).getByTestId('tbody');
    const dataRows = await within(tbody).findAllByRole('row');
    // Mock dataset provides two demo rows; ensure we render at least one
    expect(dataRows.length).toBeGreaterThan(0);

    // Spot check: should include at least one known location and hashtag
    expect(screen.getAllByText(/रायगढ़/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/विकास/).length).toBeGreaterThan(0);
  });
});
