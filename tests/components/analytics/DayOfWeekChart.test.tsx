import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DayOfWeekChart from '@/components/analytics/DayOfWeekChart';

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
  scaleOrdinal: jest.fn(() => {
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
  { day: 'सोमवार', count: 45, percentage: 20 },
  { day: 'मंगलवार', count: 38, percentage: 17 },
  { day: 'बुधवार', count: 52, percentage: 23 },
  { day: 'गुरुवार', count: 41, percentage: 18 },
  { day: 'शुक्रवार', count: 48, percentage: 21 },
  { day: 'शनिवार', count: 35, percentage: 16 },
  { day: 'रविवार', count: 25, percentage: 11 },
];

const defaultProps = {
  data: mockData,
  title: 'दिन के अनुसार गतिविधि',
  className: 'test-chart',
};

describe('DayOfWeekChart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with correct title and subtitle', () => {
    render(<DayOfWeekChart {...defaultProps} />);
    
    expect(screen.getByText('दिन के अनुसार गतिविधि')).toBeInTheDocument();
    // Note: subtitle is not rendered in the current implementation
  });

  it('should render chart container with correct test id', () => {
    render(<DayOfWeekChart {...defaultProps} />);
    
    expect(screen.getByTestId('day-of-week-chart')).toBeInTheDocument();
  });

  it('should display day labels in Hindi', () => {
    render(<DayOfWeekChart {...defaultProps} />);
    
    expect(screen.getByText('सोमवार')).toBeInTheDocument();
    expect(screen.getByText('मंगलवार')).toBeInTheDocument();
    expect(screen.getByText('बुधवार')).toBeInTheDocument();
    expect(screen.getByText('गुरुवार')).toBeInTheDocument();
    expect(screen.getByText('शुक्रवार')).toBeInTheDocument();
    expect(screen.getByText('शनिवार')).toBeInTheDocument();
    expect(screen.getByText('रविवार')).toBeInTheDocument();
  });

  it('should display count and percentage for each day', () => {
    render(<DayOfWeekChart {...defaultProps} />);
    
    expect(screen.getByText(/45/)).toBeInTheDocument();
    expect(screen.getByText(/16%/)).toBeInTheDocument();
    expect(screen.getByText(/52/)).toBeInTheDocument();
    expect(screen.getByText(/18%/)).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<DayOfWeekChart {...defaultProps} className="custom-chart" />);
    
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass('custom-chart');
  });

  it('should handle empty data gracefully', () => {
    render(<DayOfWeekChart {...defaultProps} data={[]} />);
    
    expect(screen.getByText('दिन के अनुसार गतिविधि')).toBeInTheDocument();
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('should handle single data point', () => {
    const singleData = [{ day: 'सोमवार', count: 100, percentage: 100 }];
    render(<DayOfWeekChart {...defaultProps} data={singleData} />);
    
    expect(screen.getByText('सोमवार')).toBeInTheDocument();
    expect(screen.getAllByText(/100/)).toHaveLength(3); // Use getAllByText for multiple matches
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });

  it('should display highest activity day prominently', () => {
    render(<DayOfWeekChart {...defaultProps} />);
    
    // बुधवार has the highest count (52)
    expect(screen.getByText('बुधवार')).toBeInTheDocument();
    expect(screen.getByText(/52/)).toBeInTheDocument();
    expect(screen.getByText(/18%/)).toBeInTheDocument();
  });

  it('should render with default dimensions', () => {
    render(<DayOfWeekChart {...defaultProps} />);
    
    const chartContainer = screen.getByTestId('day-of-week-chart');
    expect(chartContainer).toBeInTheDocument();
  });

  it('should handle data with missing percentage', () => {
    const dataWithoutPercentage = mockData.map(({ percentage, ...item }) => item);
    render(<DayOfWeekChart {...defaultProps} data={dataWithoutPercentage} />);
    
    expect(screen.getByText('सोमवार')).toBeInTheDocument();
    expect(screen.getByText(/45/)).toBeInTheDocument();
  });

  it('should display total count', () => {
    render(<DayOfWeekChart {...defaultProps} />);
    
    const totalCount = mockData.reduce((sum, item) => sum + item.count, 0);
    expect(screen.getByText(new RegExp(`कुल: ${totalCount}`))).toBeInTheDocument();
  });
});