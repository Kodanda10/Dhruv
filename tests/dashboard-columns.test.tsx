import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import Dashboard from '@/components/Dashboard';

describe('Dashboard columns behavior', () => {
  it('renders placeholder (—) where location or actions are missing', () => {
    render(<Dashboard />);
    // At least one cell should show placeholder
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('wraps the "विवरण" column text and preserves full content in title', () => {
    render(<Dashboard />);
    const howCells = screen.getAllByLabelText('विवरण');
    expect(howCells.length).toBeGreaterThan(0);
    const sample = howCells[0] as HTMLElement;
    const title = sample.getAttribute('title') ?? '';
    const text = sample.textContent ?? '';
    // Expect cell to show a substring of the content when wrapped, but title holds full text
    expect(title.length).toBeGreaterThanOrEqual(text.length);
    expect(title.length).toBeGreaterThan(0);
  });
});
