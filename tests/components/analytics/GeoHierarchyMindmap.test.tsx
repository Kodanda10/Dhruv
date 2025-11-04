import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import GeoHierarchyMindmap from '@/components/analytics/GeoHierarchyMindmap';

jest.mock('recharts', () => ({
  Treemap: () => <div data-testid="treemap">Treemap</div>,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  Tooltip: () => null,
}));

describe('GeoHierarchyMindmap', () => {
  it('renders component with title', () => {
    render(<GeoHierarchyMindmap />);
    expect(screen.getByText('भू-पदानुक्रम माइंडमैप')).toBeInTheDocument();
  });

  it('renders with custom className', () => {
    const { container } = render(<GeoHierarchyMindmap className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('displays Hindi subtitle', () => {
    render(<GeoHierarchyMindmap />);
    expect(screen.getByText('जिलों के अनुसार घटनाओं का वितरण')).toBeInTheDocument();
  });
});
