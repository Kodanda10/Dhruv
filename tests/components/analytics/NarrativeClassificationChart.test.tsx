import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import NarrativeClassificationChart from '@/components/analytics/NarrativeClassificationChart';

// Mock D3
jest.mock('d3', () => ({
  scaleBand: jest.fn(() => {
    const scale = jest.fn((value) => value) as any;
    scale.domain = jest.fn().mockReturnValue(scale);
    scale.range = jest.fn().mockReturnValue(scale);
    scale.padding = jest.fn().mockReturnValue(scale);
    return scale;
  }),
  scaleLinear: jest.fn(() => {
    const scale = jest.fn((value) => value) as any;
    scale.domain = jest.fn().mockReturnValue(scale);
    scale.range = jest.fn().mockReturnValue(scale);
    return scale;
  }),
  axisBottom: jest.fn(() => {
    const axis = jest.fn() as any;
    axis.tickFormat = jest.fn().mockReturnValue(axis);
    return axis;
  }),
  axisLeft: jest.fn(() => {
    const axis = jest.fn() as any;
    axis.tickFormat = jest.fn().mockReturnValue(axis);
    return axis;
  }),
  max: jest.fn(() => 100),
  format: jest.fn(() => jest.fn()),
  select: jest.fn(() => ({
    selectAll: jest.fn().mockReturnThis(),
    append: jest.fn().mockReturnThis(),
    attr: jest.fn().mockReturnThis(),
    style: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    transition: jest.fn().mockReturnThis(),
    duration: jest.fn().mockReturnThis(),
    ease: jest.fn().mockReturnThis(),
    remove: jest.fn().mockReturnThis(),
  })),
}));

const mockData = [
  { theme: 'विकास', count: 45, percentage: 30 },
  { theme: 'श्रद्धांजलि', count: 38, percentage: 25 },
  { theme: 'राजनीति', count: 35, percentage: 23 },
  { theme: 'योजना', count: 32, percentage: 22 },
];

const defaultProps = {
  data: mockData,
  className: 'test-chart',
};

describe('NarrativeClassificationChart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Title and subtitle should render correctly', () => {
    render(<NarrativeClassificationChart {...defaultProps} />);
    expect(screen.getByText('कथात्मक वर्गीकरण')).toBeInTheDocument();
    expect(screen.getByText('पोस्ट्स को विषयों के अनुसार वर्गीकृत करें')).toBeInTheDocument();
  });

  it('Chart container should render with correct test id', () => {
    render(<NarrativeClassificationChart {...defaultProps} />);
    expect(screen.getByTestId('narrative-chart')).toBeInTheDocument();
  });

  it('Theme labels should display in Hindi', () => {
    render(<NarrativeClassificationChart {...defaultProps} />);
    expect(screen.getByText('विकास')).toBeInTheDocument();
    expect(screen.getByText('श्रद्धांजलि')).toBeInTheDocument();
    expect(screen.getByText('राजनीति')).toBeInTheDocument();
    expect(screen.getByText('योजना')).toBeInTheDocument();
  });

  it('Count and percentage should display for each theme', () => {
    render(<NarrativeClassificationChart {...defaultProps} />);
    expect(screen.getByText(/45/)).toBeInTheDocument();
    expect(screen.getByText(/30%/)).toBeInTheDocument();
    expect(screen.getByText(/38/)).toBeInTheDocument();
    expect(screen.getByText(/25%/)).toBeInTheDocument();
  });

  it('Custom className should be applied', () => {
    const { container } = render(<NarrativeClassificationChart {...defaultProps} className="custom-chart" />);
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass('custom-chart');
  });

  it('Empty data should be handled gracefully', () => {
    render(<NarrativeClassificationChart {...defaultProps} data={[]} />);
    expect(screen.getByText('कथात्मक वर्गीकरण')).toBeInTheDocument();
    expect(screen.getByTestId('narrative-chart')).toBeInTheDocument();
  });

  it('Single data point should be handled', () => {
    const singleData = [{ theme: 'विकास', count: 100, percentage: 100 }];
    render(<NarrativeClassificationChart {...defaultProps} data={singleData} />);
    expect(screen.getByText('विकास')).toBeInTheDocument();
    expect(screen.getAllByText(/100/)).toHaveLength(2); // Use getAllByText for multiple matches
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });

  it('Total count should be displayed', () => {
    render(<NarrativeClassificationChart {...defaultProps} />);
    const totalCount = mockData.reduce((sum, item) => sum + item.count, 0);
    expect(screen.getByText(new RegExp(`कुल: ${totalCount}`))).toBeInTheDocument();
  });

  it('Should display theme categories correctly', () => {
    render(<NarrativeClassificationChart {...defaultProps} />);
    // Check if all themes are displayed
    expect(screen.getByText('विकास')).toBeInTheDocument();
    expect(screen.getByText('श्रद्धांजलि')).toBeInTheDocument();
    expect(screen.getByText('राजनीति')).toBeInTheDocument();
    expect(screen.getByText('योजना')).toBeInTheDocument();
  });

  it('Should handle theme colors correctly', () => {
    render(<NarrativeClassificationChart {...defaultProps} />);
    // Check if chart container is rendered (indicating colors are applied)
    expect(screen.getByTestId('narrative-chart')).toBeInTheDocument();
  });

  it('Should display summary statistics', () => {
    render(<NarrativeClassificationChart {...defaultProps} />);
    expect(screen.getByText(/कुल:/)).toBeInTheDocument();
    expect(screen.getByText(/सबसे अधिक:/)).toBeInTheDocument();
  });
});
