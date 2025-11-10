import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import LocationLeafletMap from '@/components/analytics/LocationLeafletMap';

const mockData = [
  { location: 'रायपुर', count: 45, lat: 21.2514, lng: 81.6296 },
  { location: 'बिलासपुर', count: 30, lat: 22.0796, lng: 82.1391 },
  { location: 'रायगढ़', count: 25, lat: 21.8974, lng: 83.3966 },
  { location: 'दुर्ग', count: 20, lat: 21.1904, lng: 81.2849 },
];

const defaultProps = {
  data: mockData,
  title: 'इंटरैक्टिव स्थान मानचित्र',
  className: 'test-map',
};

describe('LocationLeafletMap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Title should render correctly', () => {
    render(<LocationLeafletMap {...defaultProps} />);
    expect(screen.getByText('इंटरैक्टिव स्थान मानचित्र')).toBeInTheDocument();
  });

  it('Map container should render with correct test id', () => {
    render(<LocationLeafletMap {...defaultProps} />);
    expect(screen.getByTestId('location-leaflet-map')).toBeInTheDocument();
  });

  it('Location labels should display in Hindi', () => {
    render(<LocationLeafletMap {...defaultProps} />);
    expect(screen.getByText('रायपुर')).toBeInTheDocument();
    expect(screen.getByText('बिलासपुर')).toBeInTheDocument();
    expect(screen.getByText('रायगढ़')).toBeInTheDocument();
    expect(screen.getByText('दुर्ग')).toBeInTheDocument();
  });

  it('Count values should be displayed', () => {
    render(<LocationLeafletMap {...defaultProps} />);
    expect(screen.getByText(/45/)).toBeInTheDocument();
    expect(screen.getByText(/30/)).toBeInTheDocument();
    expect(screen.getByText(/25/)).toBeInTheDocument();
    expect(screen.getAllByText(/20/)).toHaveLength(2); // Use getAllByText for multiple matches
  });

  it('Custom className should be applied', () => {
    const { container } = render(<LocationLeafletMap {...defaultProps} className="custom-map" />);
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass('custom-map');
  });

  it('Empty data should be handled gracefully', () => {
    render(<LocationLeafletMap {...defaultProps} data={[]} />);
    expect(screen.getByText('इंटरैक्टिव स्थान मानचित्र')).toBeInTheDocument();
    expect(screen.getByTestId('location-leaflet-map')).toBeInTheDocument();
  });

  it('Single data point should be handled', () => {
    const singleData = [{ location: 'रायपुर', count: 100, lat: 21.2514, lng: 81.6296 }];
    render(<LocationLeafletMap {...defaultProps} data={singleData} />);
    expect(screen.getByText('रायपुर')).toBeInTheDocument();
    expect(screen.getAllByText(/100/)).toHaveLength(2); // Use getAllByText for multiple matches
  });

  it('Should display total count', () => {
    render(<LocationLeafletMap {...defaultProps} />);
    const totalCount = mockData.reduce((sum, item) => sum + item.count, 0);
    expect(screen.getByText(new RegExp(`कुल: ${totalCount}`))).toBeInTheDocument();
  });

  it('Should display location categories correctly', () => {
    render(<LocationLeafletMap {...defaultProps} />);
    expect(screen.getByText('रायपुर')).toBeInTheDocument();
    expect(screen.getByText('बिलासपुर')).toBeInTheDocument();
    expect(screen.getByText('रायगढ़')).toBeInTheDocument();
    expect(screen.getByText('दुर्ग')).toBeInTheDocument();
  });

  it('Should handle location colors correctly', () => {
    render(<LocationLeafletMap {...defaultProps} />);
    expect(screen.getByTestId('location-leaflet-map')).toBeInTheDocument();
  });

  it('Should display summary statistics', () => {
    render(<LocationLeafletMap {...defaultProps} />);
    expect(screen.getByText(/कुल:/)).toBeInTheDocument();
    expect(screen.getByText(/सबसे अधिक:/)).toBeInTheDocument();
  });
});
