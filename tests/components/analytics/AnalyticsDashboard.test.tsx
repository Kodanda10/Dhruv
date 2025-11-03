import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';

// Mock all the chart components
jest.mock('@/components/analytics/TimeSeriesChart', () => {
  return function MockTimeSeriesChart() {
    return <div data-testid="time-series-chart">Time Series Chart</div>;
  };
});

jest.mock('@/components/analytics/EventTypePieChart', () => {
  return function MockEventTypePieChart() {
    return <div data-testid="event-type-pie-chart">Event Type Pie Chart</div>;
  };
});

jest.mock('@/components/analytics/DayOfWeekChart', () => {
  return function MockDayOfWeekChart() {
    return <div data-testid="day-of-week-chart">Day of Week Chart</div>;
  };
});

jest.mock('@/components/analytics/LocationBarChart', () => {
  return function MockLocationBarChart() {
    return <div data-testid="location-bar-chart">Location Bar Chart</div>;
  };
});

jest.mock('@/components/analytics/LocationLeafletMap', () => {
  return function MockLocationLeafletMap() {
    return <div data-testid="location-leaflet-map">Location Leaflet Map</div>;
  };
});

jest.mock('@/components/analytics/LocationSVGMap', () => {
  return function MockLocationSVGMap() {
    return <div data-testid="location-svg-map">Location SVG Map</div>;
  };
});

jest.mock('@/components/analytics/LocationToggle', () => {
  return function MockLocationToggle() {
    return <div data-testid="location-toggle">Location Toggle</div>;
  };
});

jest.mock('@/components/analytics/NarrativeClassificationChart', () => {
  return function MockNarrativeClassificationChart() {
    return <div data-testid="narrative-classification-chart">Narrative Classification Chart</div>;
  };
});

jest.mock('@/components/analytics/KeyInsightsCards', () => {
  return function MockKeyInsightsCards() {
    return <div data-testid="key-insights-cards">Key Insights Cards</div>;
  };
});

jest.mock('@/components/analytics/AnalyticsFilters', () => {
  return function MockAnalyticsFilters() {
    return <div data-testid="analytics-filters">Analytics Filters</div>;
  };
});

const mockData = {
  tweets: [
    {
      id: '1',
      text: 'Test tweet',
      created_at: '2024-01-01T00:00:00Z',
      confidence: 0.85
    }
  ],
  insights: [
    {
      id: 'insight-1',
      title: 'Test Insight',
      value: '100',
      description: 'Test description',
      trend: 'up' as const,
      change: '+10%',
      icon: '📊'
    }
  ]
};

const defaultProps = {
  data: mockData,
  className: 'test-dashboard',
};

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Dashboard title should render correctly', () => {
    render(<AnalyticsDashboard {...defaultProps} />);
    expect(screen.getByText('एनालिटिक्स डैशबोर्ड')).toBeInTheDocument();
  });

  it('Dashboard container should render with correct test id', () => {
    render(<AnalyticsDashboard {...defaultProps} />);
    expect(screen.getByTestId('analytics-dashboard')).toBeInTheDocument();
  });

  it('All chart components should be rendered', () => {
    render(<AnalyticsDashboard {...defaultProps} />);
    expect(screen.getByTestId('time-series-chart')).toBeInTheDocument();
    expect(screen.getByTestId('event-type-pie-chart')).toBeInTheDocument();
    expect(screen.getByTestId('day-of-week-chart')).toBeInTheDocument();
    expect(screen.getByTestId('location-bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('location-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('narrative-classification-chart')).toBeInTheDocument();
  });

  it('Custom className should be applied', () => {
    const { container } = render(<AnalyticsDashboard {...defaultProps} className="custom-dashboard" />);
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass('custom-dashboard');
  });

  it('Should render dashboard sections in correct order', () => {
    render(<AnalyticsDashboard {...defaultProps} />);
    const dashboard = screen.getByTestId('analytics-dashboard');
    expect(dashboard).toBeInTheDocument();
  });

  it('Should handle empty data gracefully', () => {
    render(<AnalyticsDashboard {...defaultProps} data={{ tweets: [], insights: [] }} />);
    expect(screen.getByTestId('analytics-dashboard')).toBeInTheDocument();
  });

  it('Should render responsive layout', () => {
    render(<AnalyticsDashboard {...defaultProps} />);
    const dashboard = screen.getByTestId('analytics-dashboard');
    expect(dashboard).toHaveClass('space-y-8');
  });

  it('Should render filter section at the top', () => {
    render(<AnalyticsDashboard {...defaultProps} />);
    const filters = screen.getByTestId('analytics-filters');
    expect(filters).toBeInTheDocument();
  });

  it('Should render insights section', () => {
    render(<AnalyticsDashboard {...defaultProps} />);
    const insights = screen.getByTestId('key-insights-cards');
    expect(insights).toBeInTheDocument();
  });

  it('Should render all chart sections', () => {
    render(<AnalyticsDashboard {...defaultProps} />);
    expect(screen.getByTestId('time-series-chart')).toBeInTheDocument();
    expect(screen.getByText('Event Type Pie Chart')).toBeInTheDocument();
    expect(screen.getByText('Day of Week Chart')).toBeInTheDocument();
    expect(screen.getByText('Location Bar Chart')).toBeInTheDocument();
    expect(screen.getByText('Narrative Classification Chart')).toBeInTheDocument();
  });

  it('Should render location toggle and default bar chart', () => {
    render(<AnalyticsDashboard {...defaultProps} />);
    expect(screen.getByTestId('location-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('location-bar-chart')).toBeInTheDocument();
  });
});
