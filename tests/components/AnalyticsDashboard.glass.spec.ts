/**
 * AnalyticsDashboard Component Glass Migration Tests
 *
 * Validates that AnalyticsDashboard component properly uses glass-section-card
 * for all modules A-H and export CTA, with no legacy classes.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';

// Mock dependencies
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
  },
}));

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</div>,
}));

// Mock chart components
jest.mock('@/components/analytics/AIAssistantCard', () => {
  return function MockAIAssistantCard() {
    return <div data-testid="ai-assistant-card" className="glass-section-card p-4">AI Assistant</div>;
  };
});

jest.mock('@/components/analytics/DynamicLearningCard', () => {
  return function MockDynamicLearningCard() {
    return <div data-testid="dynamic-learning-card" className="glass-section-card p-4">Dynamic Learning</div>;
  };
});

jest.mock('@/components/analytics/FaissSearchCard', () => {
  return function MockFaissSearchCard() {
    return <div data-testid="faiss-search-card" className="glass-section-card p-4">FAISS Search</div>;
  };
});

jest.mock('@/components/analytics/MapboxCard', () => {
  return function MockMapboxCard() {
    return <div data-testid="mapbox-card" className="glass-section-card p-4">Mapbox</div>;
  };
});

jest.mock('@/components/analytics/D3MindmapCard', () => {
  return function MockD3MindmapCard() {
    return <div data-testid="d3-mindmap-card" className="glass-section-card p-4">D3 Mindmap</div>;
  };
});

describe('AnalyticsDashboard glass-section-card usage', () => {
  beforeEach(() => {
    // Mock API responses
    const mockApi = require('@/lib/api').api;
    mockApi.get.mockResolvedValue({
      data: [
        {
          id: 1,
          timestamp: '2024-01-01T00:00:00Z',
          content: 'Test event',
          parsed: {
            where: ['रायगढ़'],
            what: ['education'],
            confidence: 0.9,
          },
        },
      ],
    });
  });

  it('renders without crashing', () => {
    expect(() => render(<AnalyticsDashboard />)).not.toThrow();
  });

  it('uses glass-section-card for filter section', async () => {
    render(<AnalyticsDashboard />);

    await waitFor(() => {
      const filterSection = screen.getByText(/फ़िल्टर सेक्शन/).closest('.glass-section-card');
      expect(filterSection).toHaveClass('glass-section-card');
    });
  });

  it('all analytics modules use glass-section-card', async () => {
    render(<AnalyticsDashboard />);

    await waitFor(() => {
      // Check specific module containers
      const moduleContainers = [
        screen.getByTestId('ai-assistant-card'),
        screen.getByTestId('dynamic-learning-card'),
        screen.getByTestId('faiss-search-card'),
        screen.getByTestId('mapbox-card'),
        screen.getByTestId('d3-mindmap-card'),
      ];

      moduleContainers.forEach(container => {
        expect(container).toHaveClass('glass-section-card');
      });
    });
  });

  it('export CTA uses glass-section-card', async () => {
    render(<AnalyticsDashboard />);

    await waitFor(() => {
      const exportSection = screen.getByText(/Export/).closest('.glass-section-card');
      expect(exportSection).toHaveClass('glass-section-card');
    });
  });

  it('has no legacy glassmorphic-card classes', async () => {
    render(<AnalyticsDashboard />);

    await waitFor(() => {
      const legacyElements = document.querySelectorAll('.glassmorphic-card');
      expect(legacyElements.length).toBe(0);
    });
  });

  it('maintains consistent card spacing and layout', async () => {
    render(<AnalyticsDashboard />);

    await waitFor(() => {
      const glassCards = document.querySelectorAll('.glass-section-card');

      glassCards.forEach(card => {
        const computedStyle = window.getComputedStyle(card);
        // Should have consistent padding
        expect(computedStyle.padding).toMatch(/\d+px/);
        // Should have border radius
        expect(computedStyle.borderRadius).not.toBe('0px');
      });
    });
  });

  it('filter section maintains glass styling during interactions', async () => {
    const user = userEvent.setup();
    render(<AnalyticsDashboard />);

    await waitFor(() => {
      const locationInput = screen.getByPlaceholderText(/रायगढ़/);
      expect(locationInput).toBeInTheDocument();
    });

    const locationInput = screen.getByPlaceholderText(/रायगढ़/);
    const glassContainer = locationInput.closest('.glass-section-card');

    // Container should maintain glass styling
    expect(glassContainer).toHaveClass('glass-section-card');

    // Input should have glass-appropriate styling
    expect(locationInput).toHaveClass('bg-white/5');
    expect(locationInput).toHaveClass('backdrop-blur-sm');
  });

  it('cards maintain white text on glass backgrounds', async () => {
    render(<AnalyticsDashboard />);

    await waitFor(() => {
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
    });

    const headings = screen.getAllByRole('heading');
    headings.forEach(heading => {
      const computedStyle = window.getComputedStyle(heading);
      // Should be white or inherit white from parent
      expect(['rgb(255, 255, 255)', 'rgba(255, 255, 255, 1)']).toContain(computedStyle.color);
    });
  });

  it('responsive grid layout works within glass containers', async () => {
    render(<AnalyticsDashboard />);

    await waitFor(() => {
      const filterSection = screen.getByText(/फ़िल्टर सेक्शन/).closest('.glass-section-card');
      expect(filterSection).toHaveClass('grid');
      expect(filterSection?.className).toMatch(/md:|lg:/);
    });
  });
});