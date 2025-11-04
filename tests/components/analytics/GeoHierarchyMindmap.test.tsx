/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import GeoHierarchyMindmap from '@/components/analytics/GeoHierarchyMindmap';
import type { GeoAnalyticsSummaryResponse } from '@/types/geo-analytics';

jest.mock('recharts', () => {
  const React = require('react');
  return {
    Treemap: ({ data }: any) => (
      <div data-testid="recharts-treemap">
        {(data || []).map((node: any) => (
          <div
            key={node.name}
            data-testid={`treemap-node-${node.name}`}
            data-level={node.level ?? 'district'}
          >
            {node.name}
          </div>
        ))}
      </div>
    ),
    Cell: () => null,
    ResponsiveContainer: ({ children }: any) =>
      React.createElement('div', { 'data-testid': 'responsive-container' }, children),
    Tooltip: () => null,
  };
});

const baseData: GeoAnalyticsSummaryResponse['data'] = {
  total_events: 4,
  by_district: [
    { district: 'रायपुर', event_count: 2 },
    { district: 'बिलासपुर', event_count: 2 },
  ],
  by_assembly: [
    { district: 'रायपुर', assembly: 'रायपुर शहर', event_count: 2 },
    { district: 'बिलासपुर', assembly: 'बिलासपुर शहर', event_count: 2 },
  ],
  by_block: [
    { district: 'रायपुर', assembly: 'रायपुर शहर', block: 'रायपुर ब्लॉक', event_count: 1 },
    { district: 'बिलासपुर', assembly: 'बिलासपुर शहर', block: 'बिलासपुर ब्लॉक', event_count: 1 },
  ],
  urban_rural: { urban: 1, rural: 3 },
  top_locations: [],
  filters: { start_date: null, end_date: null, event_type: null },
};

describe('GeoHierarchyMindmap', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = jest.fn();
  });

  it('renders heading and treemap when data provided', () => {
    render(<GeoHierarchyMindmap data={baseData} />);

    expect(screen.getByText('भू-पदानुक्रम माइंडमैप')).toBeInTheDocument();
    expect(screen.getByTestId('geo-hierarchy-mindmap')).toBeInTheDocument();
    expect(screen.getByTestId('recharts-treemap')).toBeInTheDocument();
    expect(screen.getAllByTestId(/treemap-node-/i).length).toBeGreaterThan(0);
  });

  it('renders fallback when no hierarchical data available', () => {
    const emptyData: GeoAnalyticsSummaryResponse['data'] = {
      ...baseData,
      total_events: 0,
      by_district: [],
      by_assembly: [],
      by_block: [],
    };

    render(<GeoHierarchyMindmap data={emptyData} />);

    expect(screen.getByText('कोई डेटा उपलब्ध नहीं है')).toBeInTheDocument();
    expect(screen.queryByTestId('recharts-treemap')).not.toBeInTheDocument();
  });

  it('fetches data when prop data is missing', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: baseData }),
    });

    render(<GeoHierarchyMindmap />);

    expect(screen.getByText('डेटा लोड हो रहा है...')).toBeInTheDocument();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/geo-analytics/summary');
    });

    await waitFor(() => {
      expect(screen.getByTestId('recharts-treemap')).toBeInTheDocument();
    });
  });

  it('applies filters when provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: baseData }),
    });

    render(
      <GeoHierarchyMindmap
        filters={{ start_date: '2025-01-01', end_date: '2025-01-31', event_type: 'बैठक' }}
      />
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const requestUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(requestUrl).toContain('startDate=2025-01-01');
    expect(requestUrl).toContain('endDate=2025-01-31');
    expect(requestUrl).toContain('event_type=%E0%A4%AC%E0%A5%88%E0%A4%A0%E0%A4%95');
  });

  it('handles fetch error gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(<GeoHierarchyMindmap />);

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });
  });

  it('exports CSV successfully', async () => {
    render(<GeoHierarchyMindmap data={baseData} />);

    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    (URL as any).createObjectURL = jest.fn(() => 'blob:geo-hierarchy');
    (URL as any).revokeObjectURL = jest.fn();
    const appendChildSpy = jest.spyOn(document.body, 'appendChild');
    const removeChildSpy = jest.spyOn(document.body, 'removeChild');
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    const csvButton = screen.getByRole('button', {
      name: /Export .* items to CSV file/i,
    });

    await act(async () => {
      fireEvent.click(csvButton);
    });

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();

    if (originalCreateObjectURL) {
      URL.createObjectURL = originalCreateObjectURL;
    } else {
      delete (URL as any).createObjectURL;
    }
    if (originalRevokeObjectURL) {
      URL.revokeObjectURL = originalRevokeObjectURL;
    } else {
      delete (URL as any).revokeObjectURL;
    }
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it('exports JSON successfully', async () => {
    render(<GeoHierarchyMindmap data={baseData} />);

    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    (URL as any).createObjectURL = jest.fn(() => 'blob:geo-hierarchy-json');
    (URL as any).revokeObjectURL = jest.fn();
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    const jsonButton = screen.getByRole('button', {
      name: /Export .* items to JSON file/i,
    });

    await act(async () => {
      fireEvent.click(jsonButton);
    });

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();

    if (originalCreateObjectURL) {
      URL.createObjectURL = originalCreateObjectURL;
    } else {
      delete (URL as any).createObjectURL;
    }
    if (originalRevokeObjectURL) {
      URL.revokeObjectURL = originalRevokeObjectURL;
    } else {
      delete (URL as any).revokeObjectURL;
    }
    clickSpy.mockRestore();
  });

  it('exposes aria live regions for announcements', () => {
    render(<GeoHierarchyMindmap data={baseData} />);

    const liveRegion = screen.getByRole('status', { hidden: true });
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    expect(liveRegion.textContent).toContain('Viewing district level');
  });
});
