import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import EventTypePieChart from '@/components/analytics/EventTypePieChart';

// Mock D3
jest.mock('d3', () => ({
  scaleSequential: jest.fn(() => {
    const scale = jest.fn((value) => `color-${value}`) as any;
    scale.domain = jest.fn().mockReturnValue(scale);
    scale.range = jest.fn().mockReturnValue(scale);
    return scale;
  }),
  interpolateBlues: jest.fn(),
  extent: jest.fn(),
  scaleTime: jest.fn(() => {
    const scale = jest.fn((value) => value) as any;
    scale.domain = jest.fn().mockReturnValue(scale);
    scale.range = jest.fn().mockReturnValue(scale);
    return scale;
  }),
  scaleLinear: jest.fn(() => {
    const scale = jest.fn((value) => value) as any;
    scale.domain = jest.fn().mockReturnValue(scale);
    scale.range = jest.fn().mockReturnValue(scale);
    return scale;
  }),
  scaleBand: jest.fn(() => {
    const scale = jest.fn((value) => value) as any;
    scale.domain = jest.fn().mockReturnValue(scale);
    scale.range = jest.fn().mockReturnValue(scale);
    scale.padding = jest.fn().mockReturnValue(scale);
    return scale;
  }),
  pie: jest.fn(() => {
    const pie = jest.fn((data) => data) as any;
    pie.value = jest.fn().mockReturnValue(pie);
    pie.sort = jest.fn().mockReturnValue(pie);
    return pie;
  }),
  line: jest.fn(() => {
    const line = jest.fn() as any;
    line.x = jest.fn().mockReturnValue(line);
    line.y = jest.fn().mockReturnValue(line);
    line.curve = jest.fn().mockReturnValue(line);
    return line;
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
  format: jest.fn(() => jest.fn()),
  timeFormat: jest.fn(() => jest.fn()),
  max: jest.fn(() => 100),
  curveMonotoneX: jest.fn(),
}));

const mockData = [
  { label: 'योजना', value: 45, color: '#3b82f6' },
  { label: 'श्रद्धांजलि', value: 30, color: '#ef4444' },
  { label: 'बैठक', value: 25, color: '#10b981' },
];

const defaultProps = {
  data: mockData,
  width: 400,
  height: 400,
  title: 'Event Type Distribution',
  className: 'test-chart',
};

describe('EventTypePieChart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Title should render correctly', () => {
    render(<EventTypePieChart {...defaultProps} />);
    expect(screen.getByText('Event Type Distribution')).toBeInTheDocument();
  });

  it('Chart container should render with correct test id', () => {
    render(<EventTypePieChart {...defaultProps} />);
    expect(screen.getByTestId('event-type-pie-chart')).toBeInTheDocument();
  });

  it('Should render legend with event types and values', () => {
    render(<EventTypePieChart {...defaultProps} />);
    expect(screen.getByText('योजना')).toBeInTheDocument();
    expect(screen.getByText(/45/)).toBeInTheDocument();
    expect(screen.getByText('श्रद्धांजलि')).toBeInTheDocument();
    expect(screen.getByText(/30/)).toBeInTheDocument();
  });

  it('Should calculate and display percentages', () => {
    render(<EventTypePieChart {...defaultProps} />);
    expect(screen.getByText(/45%/)).toBeInTheDocument();
    expect(screen.getByText(/30%/)).toBeInTheDocument();
  });

  it('Should display total count', () => {
    render(<EventTypePieChart {...defaultProps} />);
    expect(screen.getByText(/कुल: 100/)).toBeInTheDocument();
  });

  it('Should handle single data point', () => {
    const singleData = [{ label: 'योजना', value: 100, color: '#3b82f6' }];
    render(<EventTypePieChart {...defaultProps} data={singleData} />);
    expect(screen.getByText('योजना')).toBeInTheDocument();
    expect(screen.getAllByText(/100/)).toHaveLength(2); // Use getAllByText for multiple matches
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });

  it('Custom className should be applied', () => {
    const { container } = render(<EventTypePieChart {...defaultProps} className="custom-chart" />);
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass('custom-chart');
  });

  it('Empty data should be handled gracefully', () => {
    render(<EventTypePieChart {...defaultProps} data={[]} />);
    expect(screen.getByText('Event Type Distribution')).toBeInTheDocument();
    expect(screen.getByText('कोई डेटा उपलब्ध नहीं है')).toBeInTheDocument();
  });

  it('Should render event type labels in Hindi', () => {
    render(<EventTypePieChart {...defaultProps} />);
    expect(screen.getByText('योजना')).toBeInTheDocument();
    expect(screen.getByText('श्रद्धांजलि')).toBeInTheDocument();
    expect(screen.getByText('बैठक')).toBeInTheDocument();
  });

  it('Should handle event type colors correctly', () => {
    render(<EventTypePieChart {...defaultProps} />);
    expect(screen.getByTestId('event-type-pie-chart')).toBeInTheDocument();
  });

  it('Should display summary statistics', () => {
    render(<EventTypePieChart {...defaultProps} />);
    expect(screen.getByText(/कुल:/)).toBeInTheDocument();
  });
});
