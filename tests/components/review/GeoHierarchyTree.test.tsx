import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import GeoHierarchyTree from '@/components/review/GeoHierarchyTree';

// Mock fetch
global.fetch = jest.fn();

describe('GeoHierarchyTree Component', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should render loading state initially', () => {
    (fetch as jest.Mock).mockImplementation(() => 
      new Promise(() => {}) // Never resolves to keep loading state
    );

    render(
      <GeoHierarchyTree 
        locations={['रायपुर']} 
        tweetText="रायपुर में कार्यक्रम" 
      />
    );

    expect(screen.getByText('स्थान पदानुक्रम लोड हो रहा है...')).toBeInTheDocument();
  });

  test('should render geo-hierarchy data successfully', async () => {
    const mockHierarchies = [
      {
        village: 'रायपुर',
        gram_panchayat: 'रायपुर',
        block: 'रायपुर',
        assembly: 'रायपुर शहर उत्तर',
        district: 'रायपुर',
        is_urban: false,
        confidence: 0.9
      }
    ];

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        hierarchies: mockHierarchies,
        ambiguous: [],
        summary: {
          totalLocations: 1,
          resolvedLocations: 1,
          ambiguousLocations: 0,
          confidence: 0.9
        }
      })
    });

    render(
      <GeoHierarchyTree 
        locations={['रायपुर']} 
        tweetText="रायपुर में कार्यक्रम" 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('स्थान पदानुक्रम')).toBeInTheDocument();
      expect(screen.getAllByText('रायपुर')).toHaveLength(4); // Village name appears 4 times in hierarchy
      expect(screen.getByText('90% विश्वास')).toBeInTheDocument();
      expect(screen.getByText('ब्लॉक:')).toBeInTheDocument();
      expect(screen.getByText('रायपुर शहर उत्तर')).toBeInTheDocument();
    });
  });

  test('should render urban location with ULB and ward', async () => {
    const mockHierarchies = [
      {
        village: 'रायपुर वार्ड 5',
        block: 'रायपुर',
        assembly: 'रायपुर शहर उत्तर',
        district: 'रायपुर',
        is_urban: true,
        ulb: 'रायपुर नगर निगम',
        ward_no: 5,
        confidence: 0.95
      }
    ];

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        hierarchies: mockHierarchies,
        ambiguous: [],
        summary: {
          totalLocations: 1,
          resolvedLocations: 1,
          ambiguousLocations: 0,
          confidence: 0.95
        }
      })
    });

    render(
      <GeoHierarchyTree 
        locations={['रायपुर वार्ड 5']} 
        tweetText="रायपुर वार्ड 5 में कार्यक्रम" 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('रायपुर वार्ड 5')).toBeInTheDocument();
      expect(screen.getByText('(रायपुर नगर निगम)')).toBeInTheDocument();
      expect(screen.getByText('वार्ड 5')).toBeInTheDocument();
      expect(screen.getByText('प्रकार: शहरी')).toBeInTheDocument();
    });
  });

  test('should handle multiple locations', async () => {
    const mockHierarchies = [
      {
        village: 'रायपुर',
        gram_panchayat: 'रायपुर',
        block: 'रायपुर',
        assembly: 'रायपुर शहर उत्तर',
        district: 'रायपुर',
        is_urban: false,
        confidence: 0.9
      },
      {
        village: 'बिलासपुर',
        gram_panchayat: 'बिलासपुर',
        block: 'बिलासपुर',
        assembly: 'बिलासपुर',
        district: 'बिलासपुर',
        is_urban: false,
        confidence: 0.85
      }
    ];

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        hierarchies: mockHierarchies,
        ambiguous: [],
        summary: {
          totalLocations: 2,
          resolvedLocations: 2,
          ambiguousLocations: 0,
          confidence: 0.875
        }
      })
    });

    render(
      <GeoHierarchyTree 
        locations={['रायपुर', 'बिलासपुर']} 
        tweetText="रायपुर और बिलासपुर में कार्यक्रम" 
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText('रायपुर')).toHaveLength(4); // First location appears 4 times
      expect(screen.getAllByText('बिलासपुर')).toHaveLength(5); // Second location appears 5 times (including gram_panchayat)
      expect(screen.getAllByText('90% विश्वास')).toHaveLength(1);
      expect(screen.getAllByText('85% विश्वास')).toHaveLength(1);
    });
  });

  test('should handle API error gracefully', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

    render(
      <GeoHierarchyTree 
        locations={['रायपुर']} 
        tweetText="रायपुर में कार्यक्रम" 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('स्थान पदानुक्रम लोड करने में त्रुटि')).toBeInTheDocument();
    });
  });

  test('should handle empty locations array', () => {
    render(
      <GeoHierarchyTree 
        locations={[]} 
        tweetText="कार्यक्रम" 
      />
    );

    expect(screen.queryByText('स्थान पदानुक्रम')).not.toBeInTheDocument();
  });

  test('should call onHierarchyUpdate callback', async () => {
    const mockOnHierarchyUpdate = jest.fn();
    const mockHierarchies = [
      {
        village: 'रायपुर',
        gram_panchayat: 'रायपुर',
        block: 'रायपुर',
        assembly: 'रायपुर शहर उत्तर',
        district: 'रायपुर',
        is_urban: false,
        confidence: 0.9
      }
    ];

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        hierarchies: mockHierarchies,
        ambiguous: [],
        summary: {
          totalLocations: 1,
          resolvedLocations: 1,
          ambiguousLocations: 0,
          confidence: 0.9
        }
      })
    });

    render(
      <GeoHierarchyTree 
        locations={['रायपुर']} 
        tweetText="रायपुर में कार्यक्रम"
        onHierarchyUpdate={mockOnHierarchyUpdate}
      />
    );

    await waitFor(() => {
      expect(mockOnHierarchyUpdate).toHaveBeenCalledWith(mockHierarchies);
    });
  });

  test('should display confidence levels with appropriate colors', async () => {
    const mockHierarchies = [
      {
        village: 'High Confidence',
        block: 'Test',
        assembly: 'Test',
        district: 'Test',
        is_urban: false,
        confidence: 0.95
      },
      {
        village: 'Medium Confidence',
        block: 'Test',
        assembly: 'Test',
        district: 'Test',
        is_urban: false,
        confidence: 0.7
      },
      {
        village: 'Low Confidence',
        block: 'Test',
        assembly: 'Test',
        district: 'Test',
        is_urban: false,
        confidence: 0.4
      }
    ];

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        hierarchies: mockHierarchies,
        ambiguous: [],
        summary: {
          totalLocations: 3,
          resolvedLocations: 3,
          ambiguousLocations: 0,
          confidence: 0.7
        }
      })
    });

    render(
      <GeoHierarchyTree 
        locations={['High', 'Medium', 'Low']} 
        tweetText="Test locations" 
      />
    );

    await waitFor(() => {
      expect(screen.getByText('95% विश्वास')).toHaveClass('text-green-400');
      expect(screen.getByText('70% विश्वास')).toHaveClass('text-yellow-400');
      expect(screen.getByText('40% विश्वास')).toHaveClass('text-red-400');
    });
  });
});
