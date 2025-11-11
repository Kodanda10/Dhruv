
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import MapboxCard from '@/components/analytics/MapboxCard';
import mapboxgl from 'mapbox-gl';

// Mock Mapbox GL
vi.mock('mapbox-gl', () => {
  const MockMap = vi.fn();
  MockMap.mockImplementation(function() {
    this.on = vi.fn((event, callback) => {
      if (event === 'load') {
        // Simulate load event
        setTimeout(callback, 0);
      }
    });
    this.remove = vi.fn();
  });

  const MockMarker = vi.fn();
  MockMarker.mockImplementation(function() {
    this.setLngLat = vi.fn().mockReturnThis();
    this.setPopup = vi.fn().mockReturnThis();
    this.addTo = vi.fn().mockReturnThis();
  });

  const MockPopup = vi.fn();
  MockPopup.mockImplementation(function() {
    this.setText = vi.fn().mockReturnThis();
  });

  return {
    default: {
      Map: MockMap,
      Marker: MockMarker,
      Popup: MockPopup,
      accessToken: '',
    },
  };
});

// Mock fetch
global.fetch = vi.fn();

describe('MapboxCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetch as any).mockClear();
    // Note: Mapbox mocks are defined in vi.mock factory, can't access directly for mockClear
    mapboxgl.accessToken = 'test-token';
  });

  it('renders the map card and initializes the map', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, locations: [] }),
    });

    render(<MapboxCard />);
    
    expect(screen.getByText('Event Location Map')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(mapboxgl.Map).toHaveBeenCalledWith({
        container: expect.any(HTMLDivElement),
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [83.38, 22.17],
        zoom: 7,
      });
    });
  });

  it('fetches locations and adds markers to the map', async () => {
    const mockLocations = [
      { lat: 22.17, lng: 83.38, name: 'Raigarh' },
      { lat: 22.0, lng: 83.0, name: 'Another Place' },
    ];
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, locations: mockLocations }),
    });

    render(<MapboxCard />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/analytics/locations');
      expect(mapboxgl.Marker).toHaveBeenCalledTimes(2);
      expect(mapboxgl.Marker).toHaveBeenCalledWith();
    });
  });

  it('handles API failure gracefully', async () => {
    (fetch as any).mockRejectedValueOnce(new Error('API is down'));

    render(<MapboxCard />);

    await waitFor(() => {
      expect(mapboxgl.Marker).not.toHaveBeenCalled();
    });
  });
});
