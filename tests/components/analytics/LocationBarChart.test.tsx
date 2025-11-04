import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import LocationBarChart from '@/components/analytics/LocationBarChart';

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
  { location: 'रायपुर', count: 45 },
  { location: 'बिलासपुर', count: 30 },
  { location: 'रायगढ़', count: 25 },
  { location: 'दुर्ग', count: 20 },
];

const defaultProps = {
  data: mockData,
  title: 'स्थान वितरण',
  className: 'test-chart',
};

describe('LocationBarChart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Title should render correctly', () => {
    render(<LocationBarChart {...defaultProps} />);
    expect(screen.getByText('स्थान वितरण')).toBeInTheDocument();
  });

  it('Chart container should render with correct test id', () => {
    render(<LocationBarChart {...defaultProps} />);
    expect(screen.getByTestId('location-bar-chart')).toBeInTheDocument();
  });

  it('Location labels should display in Hindi', () => {
    render(<LocationBarChart {...defaultProps} />);
    expect(screen.getByText('रायपुर')).toBeInTheDocument();
    expect(screen.getByText('बिलासपुर')).toBeInTheDocument();
    expect(screen.getByText('रायगढ़')).toBeInTheDocument();
    expect(screen.getByText('दुर्ग')).toBeInTheDocument();
  });

  it('Count values should be displayed', () => {
    render(<LocationBarChart {...defaultProps} />);
    expect(screen.getByText(/45/)).toBeInTheDocument();
    expect(screen.getByText(/30/)).toBeInTheDocument();
    expect(screen.getByText(/25/)).toBeInTheDocument();
    expect(screen.getAllByText(/20/)).toHaveLength(2); // Use getAllByText for multiple matches
  });

  it('Custom className should be applied', () => {
    const { container } = render(<LocationBarChart {...defaultProps} className="custom-chart" />);
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass('custom-chart');
  });

  it('Empty data should be handled gracefully', () => {
    render(<LocationBarChart {...defaultProps} data={[]} />);
    expect(screen.getByText('स्थान वितरण')).toBeInTheDocument();
    expect(screen.getByTestId('location-bar-chart')).toBeInTheDocument();
  });

  it('Single data point should be handled', () => {
    const singleData = [{ location: 'रायपुर', count: 100 }];
    render(<LocationBarChart {...defaultProps} data={singleData} />);
    expect(screen.getByText('रायपुर')).toBeInTheDocument();
    expect(screen.getAllByText(/100/)).toHaveLength(2); // Use getAllByText for multiple matches
  });

  it('Should display total count', () => {
    render(<LocationBarChart {...defaultProps} />);
    const totalCount = mockData.reduce((sum, item) => sum + item.count, 0);
    expect(screen.getByText(new RegExp(`कुल: ${totalCount}`))).toBeInTheDocument();
  });

  it('Should display location categories correctly', () => {
    render(<LocationBarChart {...defaultProps} />);
    expect(screen.getByText('रायपुर')).toBeInTheDocument();
    expect(screen.getByText('बिलासपुर')).toBeInTheDocument();
    expect(screen.getByText('रायगढ़')).toBeInTheDocument();
    expect(screen.getByText('दुर्ग')).toBeInTheDocument();
  });

  it('Should handle location colors correctly', () => {
    render(<LocationBarChart {...defaultProps} />);
    expect(screen.getByTestId('location-bar-chart')).toBeInTheDocument();
  });

  it('Should display summary statistics', () => {
    render(<LocationBarChart {...defaultProps} />);
    expect(screen.getByText(/कुल:/)).toBeInTheDocument();
    expect(screen.getByText(/सबसे अधिक:/)).toBeInTheDocument();
  });
});
