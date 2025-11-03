import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import Metrics from '@/components/Metrics';

describe('Metrics summary', () => {
  it('shows top locations and actions with counts in Hindi', () => {
    render(<Metrics />);

    // Section headings
    expect(screen.getByRole('heading', { name: 'स्थान सारांश' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'गतिविधि सारांश' })).toBeInTheDocument();

    // Expect at least one entry line with count format
    expect(screen.getAllByText(/— \d+ बार/).length).toBeGreaterThan(0);

    // Actions: at least known ones
    expect(screen.getAllByText(/— \d+ बार/).length).toBeGreaterThan(0);
  });
});

