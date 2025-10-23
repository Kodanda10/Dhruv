import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import EventTypePieChart from '@/components/analytics/EventTypePieChart';

// Mock D3
jest.mock('d3', () => ({
  select: jest.fn(() => ({
    selectAll: jest.fn().mockReturnThis(),
    data: jest.fn().mockReturnThis(),
    enter: jest.fn().mockReturnThis(),
    append: jest.fn().mockReturnThis(),
    attr: jest.fn().mockReturnThis(),
    style: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    remove: jest.fn().mockReturnThis(),
    exit: jest.fn().mockReturnThis(),
    transition: jest.fn().mockReturnThis(),
    duration: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
  })),
  pie: jest.fn(() => jest.fn()),
  arc: jest.fn(() => ({
    innerRadius: jest.fn().mockReturnThis(),
    outerRadius: jest.fn().mockReturnThis(),
  })),
  scaleOrdinal: jest.fn(() => jest.fn()),
  schemeCategory10: jest.fn(),
}));

const mockData = [
  { label: 'योजना', value: 45, color: '#3b82f6' },
  { label: 'श्रद्धांजलि', value: 30, color: '#ef4444' },
  { label: 'उद्घाटन', value: 15, color: '#10b981' },
  { label: 'बैठक', value: 10, color: '#f59e0b' }
];

describe('EventTypePieChart', () => {
  const defaultProps = {
    data: mockData,
    width: 400,
    height: 400,
    title: 'Event Type Distribution'
  };

  it('should render chart with title', () => {
    render(<EventTypePieChart {...defaultProps} />);
    
    expect(screen.getByText('Event Type Distribution')).toBeInTheDocument();
  });

  it('should render legend with event types and values', () => {
    render(<EventTypePieChart {...defaultProps} />);
    
    expect(screen.getByText('योजना')).toBeInTheDocument();
    expect(screen.getByText(/45/)).toBeInTheDocument();
    expect(screen.getByText('श्रद्धांजलि')).toBeInTheDocument();
    expect(screen.getByText(/30/)).toBeInTheDocument();
  });

  it('should calculate and display percentages', () => {
    render(<EventTypePieChart {...defaultProps} />);
    
    // 45/100 = 45%
    expect(screen.getByText(/45%/)).toBeInTheDocument();
    // 30/100 = 30%
    expect(screen.getByText(/30%/)).toBeInTheDocument();
  });

  it('should handle empty data gracefully', () => {
    render(<EventTypePieChart {...defaultProps} data={[]} />);
    
    expect(screen.getByText('Event Type Distribution')).toBeInTheDocument();
    expect(screen.getByText('कोई डेटा उपलब्ध नहीं है')).toBeInTheDocument();
  });

  it('should show loading state when data is being fetched', () => {
    render(<EventTypePieChart {...defaultProps} isLoading={true} />);
    
    expect(screen.getByText('डेटा लोड हो रहा है...')).toBeInTheDocument();
  });

  it('should render chart container with proper dimensions', () => {
    render(<EventTypePieChart {...defaultProps} />);
    
    const chartContainer = screen.getByTestId('event-type-pie-chart');
    expect(chartContainer).toBeInTheDocument();
    expect(chartContainer).toHaveAttribute('data-width', '400');
    expect(chartContainer).toHaveAttribute('data-height', '400');
  });

  it('should handle chart click events', () => {
    const onChartClick = jest.fn();
    render(<EventTypePieChart {...defaultProps} onChartClick={onChartClick} />);
    
    const chartContainer = screen.getByTestId('event-type-pie-chart');
    fireEvent.click(chartContainer);
    
    expect(onChartClick).toHaveBeenCalled();
  });

  it('should apply proper CSS classes', () => {
    const { container } = render(<EventTypePieChart {...defaultProps} className="custom-chart" />);
    
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass('custom-chart');
  });

  it('should render donut chart when innerRadius is provided', () => {
    render(<EventTypePieChart {...defaultProps} innerRadius={50} />);
    
    const chartContainer = screen.getByTestId('event-type-pie-chart');
    expect(chartContainer).toBeInTheDocument();
  });

  it('should handle legend item clicks', () => {
    const onLegendClick = jest.fn();
    render(<EventTypePieChart {...defaultProps} onLegendClick={onLegendClick} />);
    
    const legendItem = screen.getByText('योजना');
    fireEvent.click(legendItem);
    
    expect(onLegendClick).toHaveBeenCalledWith('योजना');
  });

  it('should display total count', () => {
    render(<EventTypePieChart {...defaultProps} />);
    
    // Total should be 45 + 30 + 15 + 10 = 100
    expect(screen.getByText(/100/)).toBeInTheDocument();
  });

  it('should handle single data point', () => {
    const singleData = [{ label: 'योजना', value: 100, color: '#3b82f6' }];
    render(<EventTypePieChart {...defaultProps} data={singleData} />);
    
    expect(screen.getByText('योजना')).toBeInTheDocument();
    expect(screen.getByText(/100/)).toBeInTheDocument();
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });
});
