import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AnalyticsFilters from '@/components/analytics/AnalyticsFilters';

const defaultProps = {
  filters: {
    timeRange: '30d',
    location: 'all',
    eventType: 'all',
    theme: 'all'
  },
  onFiltersChange: jest.fn(),
  className: 'test-filters',
};

describe('AnalyticsFilters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Title should render correctly', () => {
    render(<AnalyticsFilters {...defaultProps} />);
    expect(screen.getByText('एनालिटिक्स फिल्टर')).toBeInTheDocument();
  });

  it('Filters container should render with correct test id', () => {
    render(<AnalyticsFilters {...defaultProps} />);
    expect(screen.getByTestId('analytics-filters')).toBeInTheDocument();
  });

  it('All filter sections should be rendered', () => {
    render(<AnalyticsFilters {...defaultProps} />);
    expect(screen.getByText('समय सीमा')).toBeInTheDocument();
    expect(screen.getByText('स्थान')).toBeInTheDocument();
    expect(screen.getByText('घटना प्रकार')).toBeInTheDocument();
    expect(screen.getByText('विषय')).toBeInTheDocument();
  });

  it('Time range options should be displayed', () => {
    render(<AnalyticsFilters {...defaultProps} />);
    expect(screen.getByText('7 दिन')).toBeInTheDocument();
    expect(screen.getByText('30 दिन')).toBeInTheDocument();
    expect(screen.getByText('90 दिन')).toBeInTheDocument();
    expect(screen.getByText('सभी समय')).toBeInTheDocument();
  });

  it('Location options should be displayed', () => {
    render(<AnalyticsFilters {...defaultProps} />);
    expect(screen.getByText('सभी स्थान')).toBeInTheDocument();
    expect(screen.getByText('रायपुर')).toBeInTheDocument();
    expect(screen.getByText('बिलासपुर')).toBeInTheDocument();
    expect(screen.getByText('रायगढ़')).toBeInTheDocument();
  });

  it('Event type options should be displayed', () => {
    render(<AnalyticsFilters {...defaultProps} />);
    expect(screen.getByText('सभी प्रकार')).toBeInTheDocument();
    expect(screen.getByText('योजना')).toBeInTheDocument();
    expect(screen.getByText('श्रद्धांजलि')).toBeInTheDocument();
    expect(screen.getByText('बैठक')).toBeInTheDocument();
  });

  it('Theme options should be displayed', () => {
    render(<AnalyticsFilters {...defaultProps} />);
    expect(screen.getByText('सभी विषय')).toBeInTheDocument();
    expect(screen.getByText('विकास')).toBeInTheDocument();
    expect(screen.getByText('राजनीति')).toBeInTheDocument();
    expect(screen.getByText('सामाजिक')).toBeInTheDocument();
  });

  it('Custom className should be applied', () => {
    const { container } = render(<AnalyticsFilters {...defaultProps} className="custom-filters" />);
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass('custom-filters');
  });

  it('Should call onFiltersChange when filter is changed', () => {
    render(<AnalyticsFilters {...defaultProps} />);
    const timeRangeSelect = screen.getByDisplayValue('30 दिन');
    fireEvent.change(timeRangeSelect, { target: { value: '7d' } });
    expect(defaultProps.onFiltersChange).toHaveBeenCalledWith({
      ...defaultProps.filters,
      timeRange: '7d'
    });
  });

  it('Should handle multiple filter changes', () => {
    render(<AnalyticsFilters {...defaultProps} />);
    const locationSelect = screen.getByDisplayValue('सभी स्थान');
    fireEvent.change(locationSelect, { target: { value: 'raipur' } });
    expect(defaultProps.onFiltersChange).toHaveBeenCalledWith({
      ...defaultProps.filters,
      location: 'raipur'
    });
  });

  it('Should display current filter values correctly', () => {
    render(<AnalyticsFilters {...defaultProps} />);
    expect(screen.getByDisplayValue('30 दिन')).toBeInTheDocument();
    expect(screen.getByDisplayValue('सभी स्थान')).toBeInTheDocument();
    expect(screen.getByDisplayValue('सभी प्रकार')).toBeInTheDocument();
    expect(screen.getByDisplayValue('सभी विषय')).toBeInTheDocument();
  });

  it('Should render filter labels in Hindi', () => {
    render(<AnalyticsFilters {...defaultProps} />);
    expect(screen.getByText('समय सीमा')).toBeInTheDocument();
    expect(screen.getByText('स्थान')).toBeInTheDocument();
    expect(screen.getByText('घटना प्रकार')).toBeInTheDocument();
    expect(screen.getByText('विषय')).toBeInTheDocument();
  });

  it('Should handle custom time range selection', () => {
    render(<AnalyticsFilters {...defaultProps} />);
    const customTimeRange = screen.getByText('कस्टम');
    expect(customTimeRange).toBeInTheDocument();
  });

  it('Should render filter summary', () => {
    render(<AnalyticsFilters {...defaultProps} />);
    expect(screen.getByText(/सक्रिय फिल्टर/)).toBeInTheDocument();
  });
});
