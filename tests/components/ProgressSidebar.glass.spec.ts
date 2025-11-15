/**
 * ProgressSidebar Component Glass Migration Tests
 *
 * Validates that ProgressSidebar component properly uses glass-section-card
 * for all panels and maintains proper sidebar styling.
 */

import { render, screen, waitFor } from '@testing-library/react';
import ProgressSidebar from '@/components/review/ProgressSidebar';

// Mock dependencies
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
  },
}));

describe('ProgressSidebar glass-section-card usage', () => {
  const mockStats = {
    total: 100,
    pending: 25,
    approved: 60,
    rejected: 15,
    needsReview: 10,
  };

  beforeEach(() => {
    const mockApi = require('@/lib/api').api;
    mockApi.get.mockResolvedValue({ data: mockStats });
  });

  it('renders without crashing', () => {
    expect(() => render(<ProgressSidebar />)).not.toThrow();
  });

  it('main sidebar container uses glass-section-card', async () => {
    render(<ProgressSidebar />);

    await waitFor(() => {
      const sidebar = screen.getByTestId('progress-sidebar') || screen.getByText(/Progress/).closest('.glass-section-card');
      expect(sidebar).toHaveClass('glass-section-card');
    });
  });

  it('all progress panels use glass-section-card', async () => {
    render(<ProgressSidebar />);

    await waitFor(() => {
      // Look for all panel containers
      const panels = document.querySelectorAll('.glass-section-card');
      expect(panels.length).toBeGreaterThan(3); // At least total, pending, approved, rejected
    });
  });

  it('statistics display panels use glass-section-card', async () => {
    render(<ProgressSidebar />);

    await waitFor(() => {
      const statLabels = ['Total', 'Pending', 'Approved', 'Rejected', 'Needs Review'];
      let foundPanels = 0;

      statLabels.forEach(label => {
        const element = screen.queryByText(label);
        if (element) {
          const panel = element.closest('.glass-section-card');
          if (panel) {
            expect(panel).toHaveClass('glass-section-card');
            foundPanels++;
          }
        }
      });

      expect(foundPanels).toBeGreaterThan(0);
    });
  });

  it('progress bars are contained within glass-section-card', async () => {
    render(<ProgressSidebar />);

    await waitFor(() => {
      const progressBars = document.querySelectorAll('progress, [role="progressbar"], .progress-bar');
      if (progressBars.length > 0) {
        progressBars.forEach(bar => {
          const container = bar.closest('.glass-section-card');
          expect(container).toHaveClass('glass-section-card');
        });
      }
    });
  });

  it('error/warning states use glass-section-card', async () => {
    // Mock error state
    const mockApi = require('@/lib/api').api;
    mockApi.get.mockRejectedValue(new Error('API Error'));

    render(<ProgressSidebar />);

    await waitFor(() => {
      const errorElements = screen.queryAllByText(/Error|Failed|Warning/i);
      if (errorElements.length > 0) {
        errorElements.forEach(element => {
          const container = element.closest('.glass-section-card');
          expect(container).toHaveClass('glass-section-card');
        });
      }
    });
  });

  it('has no legacy glassmorphic-card classes', async () => {
    render(<ProgressSidebar />);

    await waitFor(() => {
      const legacyElements = document.querySelectorAll('.glassmorphic-card');
      expect(legacyElements.length).toBe(0);
    });
  });

  it('maintains white text on glass backgrounds', async () => {
    render(<ProgressSidebar />);

    await waitFor(() => {
      const textElements = screen.getAllByText(/\d+/); // Numbers/statistics

      textElements.forEach(element => {
        const computedStyle = window.getComputedStyle(element);
        expect(computedStyle.color).toBe('rgb(255, 255, 255)');
      });
    });
  });

  it('sidebar maintains proper sticky positioning', async () => {
    render(<ProgressSidebar />);

    await waitFor(() => {
      const sidebar = document.querySelector('.glass-section-card');
      const computedStyle = window.getComputedStyle(sidebar!);

      // Should be sticky positioned
      expect(computedStyle.position).toBe('sticky');
    });
  });

  it('panels have consistent spacing and padding', async () => {
    render(<ProgressSidebar />);

    await waitFor(() => {
      const panels = document.querySelectorAll('.glass-section-card');

      panels.forEach(panel => {
        const computedStyle = window.getComputedStyle(panel);
        // Should have padding
        expect(computedStyle.padding).not.toBe('0px');
        // Should have gap/spacing
        expect(panel.className).toMatch(/space-y-|gap-/);
      });
    });
  });

  it('status indicators use appropriate glass styling', async () => {
    render(<ProgressSidebar />);

    await waitFor(() => {
      // Look for colored status indicators
      const statusIndicators = document.querySelectorAll('[class*="border-red"], [class*="border-green"], [class*="bg-red"], [class*="bg-green"]');

      statusIndicators.forEach(indicator => {
        // Should be within glass container
        const glassContainer = indicator.closest('.glass-section-card');
        expect(glassContainer).toHaveClass('glass-section-card');
      });
    });
  });

  it('responsive behavior maintained within glass containers', async () => {
    render(<ProgressSidebar />);

    await waitFor(() => {
      const sidebar = document.querySelector('.glass-section-card');

      // Should have responsive width classes
      expect(sidebar?.className).toMatch(/w-64|md:w-80/);
    });
  });
});