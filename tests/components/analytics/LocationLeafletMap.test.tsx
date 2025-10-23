import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import LocationLeafletMap from '@/components/analytics/LocationLeafletMap';

// Mock react-leaflet components
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children, ...props }: any) => (
    <div data-testid="map-container" {...props}>
      {children}
    </div>
  ),
  TileLayer: ({ ...props }: any) => (
    <div data-testid="tile-layer" {...props} />
  ),
  Marker: ({ children, ...props }: any) => (
    <div data-testid="marker" {...props}>
      {children}
    </div>
  ),
  Popup: ({ children, ...props }: any) => (
    <div data-testid="popup" {...props}>
      {children}
    </div>
  ),
  CircleMarker: ({ ...props }: any) => (
    <div data-testid="circle-marker" {...props} />
  ),
}));

// Mock Leaflet
jest.mock('leaflet', () => ({
  Icon: {
    Default: {
      prototype: {
        _getIconUrl: 'mock-url',
      },
      mergeOptions: jest.fn(),
    },
  },
  icon: jest.fn(() => ({
    iconUrl: 'mock-icon-url',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  })),
  divIcon: jest.fn(() => ({
    html: '<div class="custom-icon"></div>',
    iconSize: [30, 30],
    className: 'custom-div-icon',
  })),
}));

const mockData = [
  { 
    location: 'रायगढ़', 
    count: 45, 
    percentage: 25, 
    lat: 22.1670, 
    lng: 83.4183,
    district: 'रायगढ़'
  },
  { 
    location: 'बिलासपुर', 
    count: 38, 
    percentage: 21, 
    lat: 22.0804, 
    lng: 82.1561,
    district: 'बिलासपुर'
  },
  { 
    location: 'रायपुर', 
    count: 52, 
    percentage: 29, 
    lat: 21.2514, 
    lng: 81.6296,
    district: 'रायपुर'
  },
];

const defaultProps = {
  data: mockData,
  className: 'test-map',
};

describe('LocationLeafletMap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Title and subtitle should render correctly', () => {
    render(<LocationLeafletMap {...defaultProps} />);
    expect(screen.getByText('स्थान के अनुसार गतिविधि')).toBeInTheDocument();
    expect(screen.getByText('जिलों और शहरों में पोस्टिंग वितरण - मानचित्र')).toBeInTheDocument();
  });

  it('Map container should render with correct test id', () => {
    render(<LocationLeafletMap {...defaultProps} />);
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('Tile layer should be rendered', () => {
    render(<LocationLeafletMap {...defaultProps} />);
    expect(screen.getByTestId('tile-layer')).toBeInTheDocument();
  });

  it('Markers should be rendered for each location', () => {
    render(<LocationLeafletMap {...defaultProps} />);
    const markers = screen.getAllByTestId('marker');
    expect(markers).toHaveLength(mockData.length);
  });

  it('Custom className should be applied', () => {
    const { container } = render(<LocationLeafletMap {...defaultProps} className="custom-map" />);
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass('custom-map');
  });

  it('Empty data should be handled gracefully', () => {
    render(<LocationLeafletMap {...defaultProps} data={[]} />);
    expect(screen.getByText('स्थान के अनुसार गतिविधि')).toBeInTheDocument();
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('Single data point should be handled', () => {
    const singleData = [{ 
      location: 'रायगढ़', 
      count: 100, 
      percentage: 100, 
      lat: 22.1670, 
      lng: 83.4183 
    }];
    render(<LocationLeafletMap {...defaultProps} data={singleData} />);
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    expect(screen.getAllByTestId('marker')).toHaveLength(1);
  });

  it('Should render location legend', () => {
    render(<LocationLeafletMap {...defaultProps} />);
    expect(screen.getByText('स्थान लेजेंड')).toBeInTheDocument();
  });

  it('Should display location information in legend', () => {
    render(<LocationLeafletMap {...defaultProps} />);
    expect(screen.getAllByText('रायगढ़')).toHaveLength(2); // One in popup, one in legend
    expect(screen.getAllByText('बिलासपुर')).toHaveLength(2);
    expect(screen.getAllByText('रायपुर')).toHaveLength(2);
  });

  it('Should handle missing coordinates gracefully', () => {
    const dataWithoutCoords = [
      { location: 'रायगढ़', count: 45, percentage: 25 },
      { location: 'बिलासपुर', count: 38, percentage: 21, lat: 22.0804, lng: 82.1561 },
    ];
    render(<LocationLeafletMap {...defaultProps} data={dataWithoutCoords} />);
    // Should still render map container
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });
});
