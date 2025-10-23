import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TimeSeriesChart from '@/components/analytics/TimeSeriesChart';

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
  scaleTime: jest.fn(() => ({
    domain: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
  })),
  scaleLinear: jest.fn(() => ({
    domain: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
  })),
  line: jest.fn(() => {
    const line = jest.fn() as any;
    line.x = jest.fn().mockReturnValue(line);
    line.y = jest.fn().mockReturnValue(line);
    line.curve = jest.fn().mockReturnValue(line);
    return line;
  }),
  axisBottom: jest.fn(() => {
    const axis = jest.fn();
    axis.tickFormat = jest.fn().mockReturnValue(axis);
    return axis;
  }),
  axisLeft: jest.fn(() => {
    const axis = jest.fn();
    axis.tickFormat = jest.fn().mockReturnValue(axis);
    return axis;
  }),
  format: jest.fn(() => jest.fn()),
  timeFormat: jest.fn(() => jest.fn()),
  extent: jest.fn(() => [new Date(), new Date()]),
  max: jest.fn(() => 100),
  curveMonotoneX: jest.fn(),
}));

const mockData = [
  {
    date: '2024-01-01',
    value: 10,
    eventType: 'schemes'
  },
  {
    date: '2024-01-02', 
    value: 15,
    eventType: 'schemes'
  },
  {
    date: '2024-01-03',
    value: 8,
    eventType: 'tribute'
  }
];

describe('TimeSeriesChart', () => {
  const defaultProps = {
    data: mockData,
    width: 800,
    height: 400,
    dateField: 'date',
    valueField: 'value',
    eventTypeField: 'eventType',
    title: 'Test Chart'
  };

  it('should render chart with title', () => {
    render(<TimeSeriesChart {...defaultProps} />);
    
    expect(screen.getByText('Test Chart')).toBeInTheDocument();
  });

  it('should render date range filter buttons', () => {
    render(<TimeSeriesChart {...defaultProps} />);
    
    expect(screen.getByText('7 दिन')).toBeInTheDocument();
    expect(screen.getByText('30 दिन')).toBeInTheDocument();
    expect(screen.getByText('जीवनकाल')).toBeInTheDocument();
    expect(screen.getByText('कस्टम')).toBeInTheDocument();
  });

  it('should handle date range filter changes', async () => {
    const onDateRangeChange = jest.fn();
    render(<TimeSeriesChart {...defaultProps} onDateRangeChange={onDateRangeChange} />);
    
    const button7Days = screen.getByText('7 दिन');
    fireEvent.click(button7Days);
    
    await waitFor(() => {
      expect(onDateRangeChange).toHaveBeenCalledWith('7d');
    });
  });

  it('should render chart container with proper dimensions', () => {
    render(<TimeSeriesChart {...defaultProps} />);
    
    const chartContainer = screen.getByTestId('time-series-chart');
    expect(chartContainer).toBeInTheDocument();
    expect(chartContainer).toHaveAttribute('data-width', '800');
    expect(chartContainer).toHaveAttribute('data-height', '400');
  });

  it('should handle empty data gracefully', () => {
    render(<TimeSeriesChart {...defaultProps} data={[]} />);
    
    expect(screen.getByText('Test Chart')).toBeInTheDocument();
    expect(screen.getByText('कोई डेटा उपलब्ध नहीं है')).toBeInTheDocument();
  });

  it('should show loading state when data is being fetched', () => {
    render(<TimeSeriesChart {...defaultProps} isLoading={true} />);
    
    expect(screen.getByText('डेटा लोड हो रहा है...')).toBeInTheDocument();
  });

  it('should render multi-line chart when multiple event types present', () => {
    const multiLineData = [
      ...mockData,
      { date: '2024-01-01', value: 5, eventType: 'tribute' },
      { date: '2024-01-02', value: 12, eventType: 'tribute' }
    ];
    
    render(<TimeSeriesChart {...defaultProps} data={multiLineData} />);
    
    expect(screen.getByText('Test Chart')).toBeInTheDocument();
  });

  it('should handle custom date range selection', async () => {
    render(<TimeSeriesChart {...defaultProps} />);
    
    const customButton = screen.getByText('कस्टम');
    fireEvent.click(customButton);
    
    await waitFor(() => {
      // Should show date picker or custom range input
      expect(screen.getByText('कस्टम')).toBeInTheDocument();
    });
  });

  it('should apply proper CSS classes', () => {
    const { container } = render(<TimeSeriesChart {...defaultProps} className="custom-chart" />);
    
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass('custom-chart');
  });

  it('should handle chart click events', () => {
    const onChartClick = jest.fn();
    render(<TimeSeriesChart {...defaultProps} onChartClick={onChartClick} />);
    
    const chartContainer = screen.getByTestId('time-series-chart');
    fireEvent.click(chartContainer);
    
    expect(onChartClick).toHaveBeenCalled();
  });
});
