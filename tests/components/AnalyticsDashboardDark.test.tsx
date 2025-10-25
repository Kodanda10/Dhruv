import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AnalyticsDashboardDark from '@/components/analytics/AnalyticsDashboardDark';

describe('AnalyticsDashboardDark', () => {
  it('renders without crashing', () => {
    render(<AnalyticsDashboardDark />);
    expect(screen.getByText(/एनालिटिक्स डैशबोर्ड/i)).toBeInTheDocument();
  });

  it('displays dark theme styling', () => {
    const { container } = render(<AnalyticsDashboardDark />);
    expect(container.firstChild).toHaveClass('min-h-screen', 'bg-[#101922]');
  });

  it('shows analytics sections', () => {
    render(<AnalyticsDashboardDark />);
    expect(screen.getByText(/समय के साथ गतिविधि/i)).toBeInTheDocument();
    expect(screen.getByText(/स्थान वितरण/i)).toBeInTheDocument();
  });
});
