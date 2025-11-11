
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import D3MindmapCard from '@/components/analytics/D3MindmapCard';
import * as d3 from 'd3';

// Mock D3
vi.mock('d3', () => ({
  select: vi.fn(() => ({
    attr: vi.fn().mockReturnThis(),
    append: vi.fn().mockReturnThis(),
    selectAll: vi.fn().mockReturnThis(),
    data: vi.fn().mockReturnThis(),
    join: vi.fn().mockReturnThis(),
    text: vi.fn().mockReturnThis(),
  })),
  forceSimulation: vi.fn(() => ({
    force: vi.fn().mockReturnThis(),
    on: vi.fn(),
  })),
  forceLink: vi.fn(() => ({
    id: vi.fn().mockReturnThis(),
  })),
  forceManyBody: vi.fn(() => ({
    strength: vi.fn().mockReturnThis(),
  })),
  forceCenter: vi.fn(() => ({})),
}));

// Mock fetch
global.fetch = vi.fn();

describe('D3MindmapCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetch as any).mockClear();
    (d3.select as any).mockClear();
  });

  it('renders the card and fetches data', async () => {
    const mockData = {
      nodes: [{ id: 'a', group: '1' }, { id: 'b', group: '1' }],
      links: [{ source: 'a', target: 'b', value: 1 }],
    };
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    render(<D3MindmapCard />);
    
    expect(screen.getByText('Entity Relationship Mindmap')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/labs/mindmap/graph');
      expect(d3.forceSimulation).toHaveBeenCalled();
    });
  });

  it('handles API failure gracefully', async () => {
    (fetch as any).mockRejectedValueOnce(new Error('API is down'));

    render(<D3MindmapCard />);

    await waitFor(() => {
      expect(d3.forceSimulation).not.toHaveBeenCalled();
    });
  });
});
