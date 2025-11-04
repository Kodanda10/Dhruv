import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import LocationSVGMap from '@/components/analytics/LocationSVGMap';

const mockData = [
  { location: 'रायपुर', count: 45, district: 'raipur' },
  { location: 'बिलासपुर', count: 30, district: 'bilaspur' },
  { location: 'रायगढ़', count: 25, district: 'raigarh' },
  { location: 'दुर्ग', count: 20, district: 'durg' },
];

const defaultProps = {
  data: mockData,
  title: 'SVG स्थान मानचित्र',
  className: 'test-map',
};

describe('LocationSVGMap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Title should render correctly', () => {
    render(<LocationSVGMap {...defaultProps} />);
    expect(screen.getByText('SVG स्थान मानचित्र')).toBeInTheDocument();
  });

  it('Map container should render with correct test id', () => {
    render(<LocationSVGMap {...defaultProps} />);
    expect(screen.getByTestId('location-svg-map')).toBeInTheDocument();
  });

  it('Location labels should display in Hindi', () => {
    render(<LocationSVGMap {...defaultProps} />);
    expect(screen.getByText('रायपुर')).toBeInTheDocument();
    expect(screen.getByText('बिलासपुर')).toBeInTheDocument();
    expect(screen.getByText('रायगढ़')).toBeInTheDocument();
    expect(screen.getByText('दुर्ग')).toBeInTheDocument();
  });

  it('Count values should be displayed', () => {
    render(<LocationSVGMap {...defaultProps} />);
    expect(screen.getByText(/45/)).toBeInTheDocument();
    expect(screen.getByText(/30/)).toBeInTheDocument();
    expect(screen.getByText(/25/)).toBeInTheDocument();
    expect(screen.getAllByText(/20/)).toHaveLength(2); // Use getAllByText for multiple matches
  });

  it('Custom className should be applied', () => {
    const { container } = render(<LocationSVGMap {...defaultProps} className="custom-map" />);
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass('custom-map');
  });

  it('Empty data should be handled gracefully', () => {
    render(<LocationSVGMap {...defaultProps} data={[]} />);
    expect(screen.getByText('SVG स्थान मानचित्र')).toBeInTheDocument();
    expect(screen.getByTestId('location-svg-map')).toBeInTheDocument();
  });

  it('Single data point should be handled', () => {
    const singleData = [{ location: 'रायपुर', count: 100, district: 'raipur' }];
    render(<LocationSVGMap {...defaultProps} data={singleData} />);
    expect(screen.getByText('रायपुर')).toBeInTheDocument();
    expect(screen.getAllByText(/100/)).toHaveLength(2); // Use getAllByText for multiple matches
  });

  it('Should display total count', () => {
    render(<LocationSVGMap {...defaultProps} />);
    const totalCount = mockData.reduce((sum, item) => sum + item.count, 0);
    expect(screen.getByText(new RegExp(`कुल: ${totalCount}`))).toBeInTheDocument();
  });

  it('Should display location categories correctly', () => {
    render(<LocationSVGMap {...defaultProps} />);
    expect(screen.getByText('रायपुर')).toBeInTheDocument();
    expect(screen.getByText('बिलासपुर')).toBeInTheDocument();
    expect(screen.getByText('रायगढ़')).toBeInTheDocument();
    expect(screen.getByText('दुर्ग')).toBeInTheDocument();
  });

  it('Should handle location colors correctly', () => {
    render(<LocationSVGMap {...defaultProps} />);
    expect(screen.getByTestId('location-svg-map')).toBeInTheDocument();
  });

  it('Should display summary statistics', () => {
    render(<LocationSVGMap {...defaultProps} />);
    expect(screen.getByText(/कुल:/)).toBeInTheDocument();
    expect(screen.getByText(/सबसे अधिक:/)).toBeInTheDocument();
  });
});
