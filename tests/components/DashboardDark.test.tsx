import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DashboardDark from '@/components/DashboardDark';

// Mock the API module
jest.mock('@/lib/api', () => ({
  get: jest.fn(() => Promise.resolve({ data: [] })),
}));

describe('DashboardDark', () => {
  it('renders without crashing', () => {
    render(<DashboardDark />);
    expect(screen.getByText(/दिखा रहे हैं/i)).toBeInTheDocument();
  });

  it('displays dark theme styling', () => {
    const { container } = render(<DashboardDark />);
    expect(container.querySelector('.bg-\\[\\#192734\\]')).toBeInTheDocument();
  });

  it('shows data table', () => {
    render(<DashboardDark />);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});
