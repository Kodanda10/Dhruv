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
  scaleSequential: jest.fn(() => {
    const scale = jest.fn((value) => value) as any;
    scale.domain = jest.fn().mockReturnValue(scale);
    scale.range = jest.fn().mockReturnValue(scale);
    return scale;
  }),
  interpolateBlues: jest.fn(),
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
  { location: 'रायगढ़', count: 45, percentage: 25 },
  { location: 'बिलासपुर', count: 38, percentage: 21 },
  { location: 'रायपुर', count: 52, percentage: 29 },
  { location: 'जगदलपुर', count: 25, percentage: 14 },
  { location: 'अम्बिकापुर', count: 20, percentage: 11 },
];

const mockDataWithDistrict = [
  { location: 'रायगढ़', count: 45, percentage: 25, district: 'रायगढ़' },
  { location: 'बिलासपुर', count: 38, percentage: 21, district: 'बिलासपुर' },
  { location: 'रायपुर', count: 52, percentage: 29, district: 'रायपुर' },
];

const defaultProps = {
  data: mockData,
  className: 'test-chart',
};

describe('LocationBarChart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Title and subtitle should render correctly', () => {
    render(<LocationBarChart {...defaultProps} />);
    expect(screen.getByText('स्थान के अनुसार गतिविधि')).toBeInTheDocument();
    expect(screen.getByText('जिलों और शहरों में पोस्टिंग वितरण')).toBeInTheDocument();
  });

  it('Chart container should render with correct test id', () => {
    render(<LocationBarChart {...defaultProps} />);
    expect(screen.getByTestId('location-bar-chart')).toBeInTheDocument();
  });

  it('Location labels should display in Hindi', () => {
    render(<LocationBarChart {...defaultProps} />);
    expect(screen.getByText('रायगढ़')).toBeInTheDocument();
    expect(screen.getByText('बिलासपुर')).toBeInTheDocument();
    expect(screen.getByText('रायपुर')).toBeInTheDocument();
    expect(screen.getByText('जगदलपुर')).toBeInTheDocument();
    expect(screen.getByText('अम्बिकापुर')).toBeInTheDocument();
  });

  it('Count and percentage should display for each location', () => {
    render(<LocationBarChart {...defaultProps} />);
    expect(screen.getByText(/45/)).toBeInTheDocument();
    expect(screen.getByText(/25%/)).toBeInTheDocument();
    expect(screen.getByText(/52/)).toBeInTheDocument();
    expect(screen.getByText(/29%/)).toBeInTheDocument();
  });

  it('Custom className should be applied', () => {
    const { container } = render(<LocationBarChart {...defaultProps} className="custom-chart" />);
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass('custom-chart');
  });

  it('Empty data should be handled gracefully', () => {
    render(<LocationBarChart {...defaultProps} data={[]} />);
    expect(screen.getByText('स्थान के अनुसार गतिविधि')).toBeInTheDocument();
    expect(screen.getByTestId('location-bar-chart')).toBeInTheDocument();
  });

  it('Single data point should be handled', () => {
    const singleData = [{ location: 'रायगढ़', count: 100, percentage: 100 }];
    render(<LocationBarChart {...defaultProps} data={singleData} />);
    expect(screen.getByText('रायगढ़')).toBeInTheDocument();
    expect(screen.getAllByText(/100/)).toHaveLength(2); // Use getAllByText for multiple matches
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });

  it('Total count should be displayed', () => {
    render(<LocationBarChart {...defaultProps} />);
    const totalCount = mockData.reduce((sum, item) => sum + item.count, 0);
    expect(screen.getByText(new RegExp(`कुल: ${totalCount}`))).toBeInTheDocument();
  });

  it('Top location should be highlighted', () => {
    render(<LocationBarChart {...defaultProps} />);
    // रायपुर has the highest count (52)
    expect(screen.getByText('रायपुर')).toBeInTheDocument();
    expect(screen.getByText(/52/)).toBeInTheDocument();
    expect(screen.getByText(/29%/)).toBeInTheDocument();
  });

  it('Should display location hierarchy when district data is provided', () => {
    render(<LocationBarChart {...defaultProps} data={mockDataWithDistrict} />);
    // Check if district/city hierarchy is shown
    expect(screen.getAllByText(/जिला/)).toHaveLength(3);
  });
});
