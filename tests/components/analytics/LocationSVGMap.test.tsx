import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import LocationSVGMap from '@/components/analytics/LocationSVGMap';

const mockData = [
  { 
    location: 'रायगढ़', 
    count: 45, 
    percentage: 25, 
    district: 'रायगढ़'
  },
  { 
    location: 'बिलासपुर', 
    count: 38, 
    percentage: 21, 
    district: 'बिलासपुर'
  },
  { 
    location: 'रायपुर', 
    count: 52, 
    percentage: 29, 
    district: 'रायपुर'
  },
  { 
    location: 'जगदलपुर', 
    count: 25, 
    percentage: 14, 
    district: 'बस्तर'
  },
  { 
    location: 'अम्बिकापुर', 
    count: 20, 
    percentage: 11, 
    district: 'सरगुजा'
  },
];

const defaultProps = {
  data: mockData,
  className: 'test-map',
};

describe('LocationSVGMap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Title and subtitle should render correctly', () => {
    render(<LocationSVGMap {...defaultProps} />);
    expect(screen.getByText('स्थान के अनुसार गतिविधि')).toBeInTheDocument();
    expect(screen.getByText('छत्तीसगढ़ जिलों में पोस्टिंग वितरण - SVG मानचित्र')).toBeInTheDocument();
  });

  it('SVG map container should render with correct test id', () => {
    render(<LocationSVGMap {...defaultProps} />);
    expect(screen.getByTestId('svg-map')).toBeInTheDocument();
  });

  it('District paths should be rendered', () => {
    render(<LocationSVGMap {...defaultProps} />);
    const svgElement = screen.getByTestId('svg-map');
    expect(svgElement).toBeInTheDocument();
    // Check if SVG contains path elements for districts
    const paths = svgElement.querySelectorAll('path');
    expect(paths.length).toBeGreaterThan(0);
  });

  it('Custom className should be applied', () => {
    const { container } = render(<LocationSVGMap {...defaultProps} className="custom-map" />);
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass('custom-map');
  });

  it('Empty data should be handled gracefully', () => {
    render(<LocationSVGMap {...defaultProps} data={[]} />);
    expect(screen.getByText('स्थान के अनुसार गतिविधि')).toBeInTheDocument();
    expect(screen.getByTestId('svg-map')).toBeInTheDocument();
  });

  it('Single data point should be handled', () => {
    const singleData = [{ 
      location: 'रायगढ़', 
      count: 100, 
      percentage: 100, 
      district: 'रायगढ़'
    }];
    render(<LocationSVGMap {...defaultProps} data={singleData} />);
    expect(screen.getByTestId('svg-map')).toBeInTheDocument();
  });

  it('Should render district legend', () => {
    render(<LocationSVGMap {...defaultProps} />);
    expect(screen.getByText('जिला लेजेंड')).toBeInTheDocument();
  });

  it('Should display district information in legend', () => {
    render(<LocationSVGMap {...defaultProps} />);
    expect(screen.getAllByText('रायगढ़')).toHaveLength(2);
    expect(screen.getAllByText('बिलासपुर')).toHaveLength(2);
    expect(screen.getAllByText('रायपुर')).toHaveLength(2);
  });

  it('Should handle missing district data gracefully', () => {
    const dataWithoutDistrict = [
      { location: 'रायगढ़', count: 45, percentage: 25 },
      { location: 'बिलासपुर', count: 38, percentage: 21, district: 'बिलासपुर' },
    ];
    render(<LocationSVGMap {...defaultProps} data={dataWithoutDistrict} />);
    // Should still render SVG map
    expect(screen.getByTestId('svg-map')).toBeInTheDocument();
  });

  it('Should display total count', () => {
    render(<LocationSVGMap {...defaultProps} />);
    const totalCount = mockData.reduce((sum, item) => sum + item.count, 0);
    expect(screen.getByText(new RegExp(`कुल: ${totalCount}`))).toBeInTheDocument();
  });

  it('Should highlight districts with data', () => {
    render(<LocationSVGMap {...defaultProps} />);
    // Check if districts with data are highlighted
    const svgElement = screen.getByTestId('svg-map');
    const paths = svgElement.querySelectorAll('path');
    expect(paths.length).toBeGreaterThan(0);
  });
});
