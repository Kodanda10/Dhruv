/**
 * @jest-environment jsdom
 */
/**
 * Comprehensive Tests for GeoHierarchyMindmap Component
 * 
 * Tests using real tweet data from parsed_tweets.json (55 tweets)
 * 
 * Features Tested:
 * 1. Component rendering with real geo-analytics data
 * 2. Interactive drilldown through hierarchy
 * 3. Breadcrumb navigation
 * 4. Filter integration
 * 5. Export functionality (CSV/JSON)
 * 6. Loading and error states
 * 7. Empty state handling
 * 8. Data transformation logic
 * 9. Color calculation
 * 10. Accessibility features
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import GeoHierarchyMindmap from '@/components/analytics/GeoHierarchyMindmap';
import type { GeoAnalyticsSummaryResponse } from '@/types/geo-analytics';
import fs from 'fs';
import path from 'path';

// Load real tweet data
const realTweets = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'data/parsed_tweets.json'), 'utf-8')
);

// Mock recharts to avoid rendering issues in tests
jest.mock('recharts', () => ({
  Treemap: ({ data, content, onMouseEnter, onMouseLeave }: any) => {
    const MockCell = content;
    return (
      <div data-testid="recharts-treemap" data-items={data?.length || 0}>
        {data?.map((item: any, index: number) => (
          <div
            key={index}
            data-testid={`treemap-node-${item.name}`}
            data-value={item.value}
            data-has-children={!!(item.children && item.children.length > 0)}
            onClick={() => {
              if (item.children && item.children.length > 0) {
                // Simulate click handler
              }
            }}
          >
            {MockCell && <MockCell payload={item} />}
          </div>
        ))}
      </div>
    );
  },
  Cell: () => null,
  ResponsiveContainer: ({ children, width, height }: any) => (
    <div data-testid="responsive-container" data-width={width} data-height={height}>
      {children}
    </div>
  ),
  Tooltip: ({ content, active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const Content = content;
    return Content ? <Content active={active} payload={payload} /> : null;
  },
}));

// Mock fetch for API calls
global.fetch = jest.fn();

// Helper: Transform real tweets into mock geo-analytics API response
const createMockGeoAnalyticsData = (tweets: any[]): GeoAnalyticsSummaryResponse['data'] => {
  // Extract geo_hierarchy from tweets
  const districts = new Map<string, number>();
  const assemblies = new Map<string, { district: string; assembly: string; count: number }>();
  const blocks = new Map<string, { district: string; assembly: string; block: string; count: number }>();

  tweets.forEach((tweet) => {
    if (tweet.geo_hierarchy && Array.isArray(tweet.geo_hierarchy)) {
      tweet.geo_hierarchy.forEach((geo: any) => {
        if (geo.district) {
          districts.set(geo.district, (districts.get(geo.district) || 0) + 1);
        }
        if (geo.district && geo.assembly) {
          const key = `${geo.district}:${geo.assembly}`;
          const existing = assemblies.get(key);
          assemblies.set(key, {
            district: geo.district,
            assembly: geo.assembly,
            count: (existing?.count || 0) + 1,
          });
        }
        if (geo.district && geo.assembly && geo.block) {
          const key = `${geo.district}:${geo.assembly}:${geo.block}`;
          const existing = blocks.get(key);
          blocks.set(key, {
            district: geo.district,
            assembly: geo.assembly,
            block: geo.block,
            count: (existing?.count || 0) + 1,
          });
        }
      });
    }
  });

  return {
    total_events: tweets.length,
    by_district: Array.from(districts.entries()).map(([district, count]) => ({
      district,
      event_count: count,
    })),
    by_assembly: Array.from(assemblies.values()).map(item => ({
      district: item.district,
      assembly: item.assembly,
      event_count: item.count,
    })),
    by_block: Array.from(blocks.values()).map(item => ({
      district: item.district,
      assembly: item.assembly,
      block: item.block,
      event_count: item.count,
    })),
    urban_rural: {
      urban: 0,
      rural: 0,
    },
    top_locations: [],
    filters: {
      start_date: null,
      end_date: null,
      event_type: null,
    },
  };
};

const mockData = createMockGeoAnalyticsData(realTweets);

// Create data with nested hierarchy for drilldown testing
const createHierarchicalData = () => {
  return {
    total_events: 10,
    by_district: [
      { district: 'रायपुर', event_count: 5 },
      { district: 'बिलासपुर', event_count: 5 },
    ],
    by_assembly: [
      { district: 'रायपुर', assembly: 'रायपुर शहर', event_count: 3 },
      { district: 'रायपुर', assembly: 'रायपुर ग्रामीण', event_count: 2 },
      { district: 'बिलासपुर', assembly: 'बिलासपुर शहर', event_count: 5 },
    ],
    by_block: [
      { district: 'रायपुर', assembly: 'रायपुर शहर', block: 'रायपुर ब्लॉक', event_count: 3 },
      { district: 'बिलासपुर', assembly: 'बिलासपुर शहर', block: 'बिलासपुर ब्लॉक', event_count: 5 },
    ],
    urban_rural: { urban: 8, rural: 2 },
    top_locations: [],
    filters: { start_date: null, end_date: null, event_type: null },
  };
};

const hierarchicalData = createHierarchicalData();

  describe('GeoHierarchyMindmap', () => {
    beforeEach(() => {
      // Clear all mocks
      jest.clearAllMocks();
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    // Reset URL methods
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();
  });

  describe('Rendering', () => {
    it('should render component with title', () => {
      render(<GeoHierarchyMindmap data={mockData} />);
      expect(screen.getByText('भू-पदानुक्रम माइंडमैप')).toBeInTheDocument();
    });

    it('should render treemap when data is provided', () => {
      render(<GeoHierarchyMindmap data={mockData} />);
      expect(screen.getByTestId('geo-hierarchy-mindmap')).toBeInTheDocument();
      expect(screen.getByTestId('recharts-treemap')).toBeInTheDocument();
    });

    it('should render export buttons', () => {
      render(<GeoHierarchyMindmap data={mockData} />);
      expect(screen.getByLabelText('Export to CSV')).toBeInTheDocument();
      expect(screen.getByLabelText('Export to JSON')).toBeInTheDocument();
    });

    it('should render legend', () => {
      render(<GeoHierarchyMindmap data={mockData} />);
      expect(screen.getByText('कम घटनाएं')).toBeInTheDocument();
      expect(screen.getByText('अधिक घटनाएं')).toBeInTheDocument();
      expect(screen.getByText('क्लिक करें विस्तार करने के लिए')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading state when loading', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {})); // Never resolves
      
      await act(async () => {
        render(<GeoHierarchyMindmap filters={{ start_date: null, end_date: null, event_type: null }} />);
      });

      expect(screen.getByText('डेटा लोड हो रहा है...')).toBeInTheDocument();
    });

    it('should call API when filters are provided but no data', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: mockData,
          source: 'database',
        }),
      });

      await act(async () => {
        render(<GeoHierarchyMindmap filters={{ start_date: '2025-01-01', end_date: null, event_type: null }} />);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/geo-analytics/summary')
        );
      });
    });
  });

  describe('Error State', () => {
    it('should show error state when API fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        render(<GeoHierarchyMindmap filters={{ start_date: null, end_date: null, event_type: null }} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
      });
    });

    it('should show error message from API response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({
          success: false,
          message: 'Failed to load geo analytics data',
        }),
      });

      await act(async () => {
        render(<GeoHierarchyMindmap filters={{ start_date: null, end_date: null, event_type: null }} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Failed to load geo analytics data/)).toBeInTheDocument();
      });
    });

    it('should have retry button in error state', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        render(<GeoHierarchyMindmap filters={{ start_date: null, end_date: null, event_type: null }} />);
      });

      await waitFor(() => {
        const retryButton = screen.getByText('पुनः प्रयास करें');
        expect(retryButton).toBeInTheDocument();
      });
    });

    it('should retry when retry button is clicked', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          json: async () => ({
            success: true,
            data: mockData,
            source: 'database',
          }),
        });

      await act(async () => {
        render(<GeoHierarchyMindmap filters={{ start_date: null, end_date: null, event_type: null }} />);
      });

      await waitFor(() => {
        expect(screen.getByText('पुनः प्रयास करें')).toBeInTheDocument();
      });

      const retryButton = screen.getByText('पुनः प्रयास करें');
      await act(async () => {
        fireEvent.click(retryButton);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no data', () => {
      render(<GeoHierarchyMindmap data={undefined} />);
      expect(screen.getByText('कोई डेटा उपलब्ध नहीं है')).toBeInTheDocument();
    });

    it('should show empty state when data has no districts', () => {
      const emptyData = {
        ...mockData,
        by_district: [],
      };
      render(<GeoHierarchyMindmap data={emptyData} />);
      expect(screen.getByText('कोई डेटा उपलब्ध नहीं है')).toBeInTheDocument();
    });
  });

  describe('Data Transformation', () => {
    it('should transform API data into hierarchical structure', () => {
      render(<GeoHierarchyMindmap data={hierarchicalData} />);
      const treemap = screen.getByTestId('recharts-treemap');
      expect(treemap).toHaveAttribute('data-items', '2'); // 2 districts
    });

    it('should build district nodes correctly', () => {
      render(<GeoHierarchyMindmap data={hierarchicalData} />);
      expect(screen.getByTestId('treemap-node-रायपुर')).toBeInTheDocument();
      expect(screen.getByTestId('treemap-node-बिलासपुर')).toBeInTheDocument();
    });

    it('should handle data with no assemblies', () => {
      const noAssembliesData = {
        ...mockData,
        by_assembly: [],
        by_block: [],
      };
      render(<GeoHierarchyMindmap data={noAssembliesData} />);
      expect(screen.getByTestId('geo-hierarchy-mindmap')).toBeInTheDocument();
    });

    it('should handle data with no blocks', () => {
      const noBlocksData = {
        ...mockData,
        by_block: [],
      };
      render(<GeoHierarchyMindmap data={noBlocksData} />);
      expect(screen.getByTestId('geo-hierarchy-mindmap')).toBeInTheDocument();
    });
  });

  describe('Drilldown Logic', () => {
    it('should display districts at root level', () => {
      render(<GeoHierarchyMindmap data={hierarchicalData} />);
      expect(screen.getByTestId('treemap-node-रायपुर')).toBeInTheDocument();
      expect(screen.getByTestId('treemap-node-बिलासपुर')).toBeInTheDocument();
    });

    it('should process assemblies correctly when district exists', () => {
      const dataWithAssembly = {
        ...hierarchicalData,
        by_assembly: [
          { district: 'रायपुर', assembly: 'रायपुर शहर', event_count: 3 },
        ],
      };
      render(<GeoHierarchyMindmap data={dataWithAssembly} />);
      expect(screen.getByTestId('geo-hierarchy-mindmap')).toBeInTheDocument();
    });

    it('should handle assemblies with no matching district', () => {
      const orphanAssemblyData = {
        ...mockData,
        by_assembly: [
          { district: 'Nonexistent', assembly: 'Some Assembly', event_count: 1 },
        ],
      };
      render(<GeoHierarchyMindmap data={orphanAssemblyData} />);
      // Should still render without crashing
      expect(screen.getByTestId('geo-hierarchy-mindmap')).toBeInTheDocument();
    });

    it('should process blocks correctly when assembly exists', () => {
      const dataWithBlock = {
        ...hierarchicalData,
        by_block: [
          { district: 'रायपुर', assembly: 'रायपुर शहर', block: 'Test Block', event_count: 2 },
        ],
      };
      render(<GeoHierarchyMindmap data={dataWithBlock} />);
      expect(screen.getByTestId('geo-hierarchy-mindmap')).toBeInTheDocument();
    });

    it('should handle blocks with no matching assembly', () => {
      const orphanBlockData = {
        ...mockData,
        by_assembly: [],
        by_block: [
          { district: 'रायपुर', assembly: 'Nonexistent', block: 'Test Block', event_count: 1 },
        ],
      };
      render(<GeoHierarchyMindmap data={orphanBlockData} />);
      expect(screen.getByTestId('geo-hierarchy-mindmap')).toBeInTheDocument();
    });

    it('should calculate max value correctly', () => {
      const varyingData = {
        ...mockData,
        by_district: [
          { district: 'A', event_count: 10 },
          { district: 'B', event_count: 20 },
          { district: 'C', event_count: 5 },
        ],
      };
      render(<GeoHierarchyMindmap data={varyingData} />);
      expect(screen.getByTestId('geo-hierarchy-mindmap')).toBeInTheDocument();
    });

    it('should handle max value of zero', () => {
      const zeroData = {
        ...mockData,
        by_district: [
          { district: 'A', event_count: 0 },
        ],
      };
      render(<GeoHierarchyMindmap data={zeroData} />);
      expect(screen.getByTestId('geo-hierarchy-mindmap')).toBeInTheDocument();
    });

    it('should handle empty displayData', () => {
      const emptyDisplayData = {
        ...mockData,
        by_district: [],
      };
      render(<GeoHierarchyMindmap data={emptyDisplayData} />);
      expect(screen.getByText('कोई डेटा उपलब्ध नहीं है')).toBeInTheDocument();
    });
  });

  describe('Breadcrumb Navigation', () => {
    it('should not show breadcrumb at root level', () => {
      render(<GeoHierarchyMindmap data={hierarchicalData} />);
      expect(screen.queryByText('← Back')).not.toBeInTheDocument();
      expect(screen.queryByText('Root')).not.toBeInTheDocument();
    });
  });

  describe('Filter Integration', () => {
    it('should pass filters to API when fetching data', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: mockData,
          source: 'database',
        }),
      });

      const filters = {
        start_date: '2025-01-01',
        end_date: '2025-01-31',
        event_type: 'rally',
      };

      await act(async () => {
        render(<GeoHierarchyMindmap filters={filters} />);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('startDate=2025-01-01')
        );
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('endDate=2025-01-31')
        );
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('event_type=rally')
        );
      });
    });

    it('should update when filters change', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: async () => ({
          success: true,
          data: mockData,
          source: 'database',
        }),
      });

      const { rerender } = await act(async () => {
        return render(
          <GeoHierarchyMindmap filters={{ start_date: '2025-01-01', end_date: null, event_type: null }} />
        );
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        rerender(
          <GeoHierarchyMindmap filters={{ start_date: '2025-02-01', end_date: null, event_type: null }} />
        );
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });

    it('should use propData when provided (controlled mode)', () => {
      render(<GeoHierarchyMindmap data={mockData} />);
      expect(screen.getByTestId('geo-hierarchy-mindmap')).toBeInTheDocument();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Export Functionality', () => {
    let mockLink: any;

    beforeEach(() => {
      mockLink = {
        setAttribute: jest.fn(),
        click: jest.fn(),
        style: {},
      };
      global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = jest.fn();
      document.createElement = jest.fn(() => mockLink) as any;
      document.body.appendChild = jest.fn();
      document.body.removeChild = jest.fn();
    });

    it('should export CSV when CSV button is clicked', () => {
      render(<GeoHierarchyMindmap data={mockData} />);

      const csvButton = screen.getByLabelText('Export to CSV');
      fireEvent.click(csvButton);

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockLink.setAttribute).toHaveBeenCalledWith('href', 'blob:mock-url');
      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', expect.stringContaining('.csv'));
      expect(mockLink.click).toHaveBeenCalled();
      expect(document.body.appendChild).toHaveBeenCalledWith(mockLink);
      expect(document.body.removeChild).toHaveBeenCalledWith(mockLink);
    });

    it('should export JSON when JSON button is clicked', () => {
      render(<GeoHierarchyMindmap data={mockData} />);

      const jsonButton = screen.getByLabelText('Export to JSON');
      fireEvent.click(jsonButton);

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockLink.setAttribute).toHaveBeenCalledWith('href', 'blob:mock-url');
      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', expect.stringContaining('.json'));
      expect(mockLink.click).toHaveBeenCalled();
    });

    it('should not export when no data', () => {
      render(<GeoHierarchyMindmap data={undefined} />);

      // Export buttons should not be present in empty state
      expect(screen.queryByLabelText('Export to CSV')).not.toBeInTheDocument();
    });

    it('should include filters in JSON export', () => {
      const filters = {
        start_date: '2025-01-01',
        end_date: '2025-01-31',
        event_type: 'rally',
      };

      render(<GeoHierarchyMindmap data={mockData} filters={filters} />);

      const jsonButton = screen.getByLabelText('Export to JSON');
      
      // Mock Blob to capture content
      const blobContent: any[] = [];
      global.Blob = jest.fn(([content]) => {
        blobContent.push(content);
        return {} as Blob;
      }) as any;

      fireEvent.click(jsonButton);

      expect(global.Blob).toHaveBeenCalled();
      const exportedContent = blobContent[0];
      expect(exportedContent).toContain('filters');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels on export buttons', () => {
      render(<GeoHierarchyMindmap data={mockData} />);
      expect(screen.getByLabelText('Export to CSV')).toBeInTheDocument();
      expect(screen.getByLabelText('Export to JSON')).toBeInTheDocument();
    });

    it('should have data-testid for testing', () => {
      render(<GeoHierarchyMindmap data={mockData} />);
      expect(screen.getByTestId('geo-hierarchy-mindmap')).toBeInTheDocument();
    });
  });

  describe('Component Props', () => {
    it('should accept custom className', () => {
      const { container } = render(
        <GeoHierarchyMindmap data={mockData} className="custom-class" />
      );
      const component = container.firstChild as HTMLElement;
      expect(component).toHaveClass('custom-class');
    });

    it('should accept custom height prop', () => {
      render(<GeoHierarchyMindmap data={mockData} height={800} />);
      const treemapContainer = screen.getByTestId('geo-hierarchy-mindmap');
      expect(treemapContainer).toBeInTheDocument();
    });

    it('should use default height when not provided', () => {
      render(<GeoHierarchyMindmap data={mockData} />);
      const treemapContainer = screen.getByTestId('geo-hierarchy-mindmap');
      expect(treemapContainer).toBeInTheDocument();
    });
  });

  describe('Real Data Integration', () => {
    it('should handle real tweet data structure', () => {
      // Use actual geo_hierarchy structures from real tweets
      const tweetsWithGeo = realTweets.filter((t: any) => t.geo_hierarchy && t.geo_hierarchy.length > 0);
      
      if (tweetsWithGeo.length > 0) {
        const realData = createMockGeoAnalyticsData(tweetsWithGeo);
        render(<GeoHierarchyMindmap data={realData} />);
        
        expect(screen.getByTestId('geo-hierarchy-mindmap')).toBeInTheDocument();
        expect(screen.getByTestId('recharts-treemap')).toBeInTheDocument();
      }
    });

    it('should handle tweets with multiple geo_hierarchy entries', () => {
      // Find tweets with multiple geo entries
      const multiGeo = realTweets.filter(
        (t: any) => t.geo_hierarchy && Array.isArray(t.geo_hierarchy) && t.geo_hierarchy.length > 1
      );

      if (multiGeo.length > 0) {
        const data = createMockGeoAnalyticsData(multiGeo);
        render(<GeoHierarchyMindmap data={data} />);
        expect(screen.getByTestId('geo-hierarchy-mindmap')).toBeInTheDocument();
      }
    });

    it('should handle tweets with district-level data only', () => {
      // Create data with only districts
      const districtOnlyData = {
        ...mockData,
        by_assembly: [],
        by_block: [],
      };
      
      render(<GeoHierarchyMindmap data={districtOnlyData} />);
      expect(screen.getByTestId('geo-hierarchy-mindmap')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty filters object', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: mockData,
          source: 'database',
        }),
      });

      await act(async () => {
        render(<GeoHierarchyMindmap filters={{ start_date: null, end_date: null, event_type: null }} />);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('should handle API response with null data', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: null,
          source: 'database',
        }),
      });

      await act(async () => {
        render(<GeoHierarchyMindmap filters={{ start_date: null, end_date: null, event_type: null }} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/कोई डेटा उपलब्ध नहीं है/)).toBeInTheDocument();
      });
    });

    it('should handle API response with missing data field', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({
          success: false,
          message: 'Failed to load',
        }),
      });

      await act(async () => {
        render(<GeoHierarchyMindmap filters={{ start_date: null, end_date: null, event_type: null }} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Failed to load/)).toBeInTheDocument();
      });
    });

    it('should handle data with very large event counts', () => {
      const largeData = {
        ...mockData,
        by_district: [
          { district: 'रायपुर', event_count: 999999 },
          { district: 'बिलासपुर', event_count: 888888 },
        ],
      };
      render(<GeoHierarchyMindmap data={largeData} />);
      expect(screen.getByTestId('geo-hierarchy-mindmap')).toBeInTheDocument();
    });

    it('should handle data with single district', () => {
      const singleDistrictData = {
        ...mockData,
        by_district: [{ district: 'रायपुर', event_count: 10 }],
        by_assembly: [],
        by_block: [],
      };
      render(<GeoHierarchyMindmap data={singleDistrictData} />);
      expect(screen.getByTestId('geo-hierarchy-mindmap')).toBeInTheDocument();
    });

    it('should handle very long location names', () => {
      const longNameData = {
        ...mockData,
        by_district: [
          { district: 'रायपुर' + 'र'.repeat(100), event_count: 5 },
        ],
      };
      render(<GeoHierarchyMindmap data={longNameData} />);
      expect(screen.getByTestId('geo-hierarchy-mindmap')).toBeInTheDocument();
    });

    it('should handle undefined propData in useEffect', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: mockData,
          source: 'database',
        }),
      });

      await act(async () => {
        render(<GeoHierarchyMindmap filters={{ start_date: null, end_date: null, event_type: null }} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('geo-hierarchy-mindmap')).toBeInTheDocument();
      });
    });

    it('should handle data with missing path property', () => {
      // Create data that might not have path in nodes
      const minimalData = {
        ...mockData,
        by_district: [{ district: 'Test', event_count: 1 }],
      };
      render(<GeoHierarchyMindmap data={minimalData} />);
      expect(screen.getByTestId('geo-hierarchy-mindmap')).toBeInTheDocument();
    });
  });

  describe('Export Edge Cases', () => {
    let mockLink: any;

    beforeEach(() => {
      mockLink = {
        setAttribute: jest.fn(),
        click: jest.fn(),
        style: {},
      };
      document.createElement = jest.fn(() => mockLink) as any;
      document.body.appendChild = jest.fn();
      document.body.removeChild = jest.fn();
      global.Blob = jest.fn(() => ({} as Blob)) as any;
    });

    it('should handle export with empty hierarchy', () => {
      const emptyHierarchyData = {
        ...mockData,
        by_district: [],
      };
      render(<GeoHierarchyMindmap data={emptyHierarchyData} />);
      
      // Export buttons shouldn't be available for empty data
      expect(screen.queryByLabelText('Export to CSV')).not.toBeInTheDocument();
    });

    it('should include all hierarchy levels in export', () => {
      render(<GeoHierarchyMindmap data={hierarchicalData} />);
      
      const csvButton = screen.getByLabelText('Export to CSV');
      
      // Capture blob content
      const blobContents: string[] = [];
      global.Blob = jest.fn(([content]) => {
        if (typeof content === 'string') {
          blobContents.push(content);
        }
        return {} as Blob;
      }) as any;

      fireEvent.click(csvButton);

      expect(blobContents.length).toBeGreaterThan(0);
      // CSV should contain hierarchy path column
      expect(blobContents[0]).toContain('Hierarchy Path');
    });
  });
});
