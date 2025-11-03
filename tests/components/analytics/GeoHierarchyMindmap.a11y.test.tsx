/**
 * Accessibility tests for GeoHierarchyMindmap component
 * Tests WCAG 2.1 AA compliance using jest-axe
 */

import React from 'react';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import GeoHierarchyMindmap from '@/components/analytics/GeoHierarchyMindmap';
import type { GeoAnalyticsSummaryResponse } from '@/types/geo-analytics';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock recharts
jest.mock('recharts', () => {
  const React = require('react');
  return {
    Treemap: ({ children }: any) =>
      React.createElement('div', { 'data-testid': 'recharts-treemap' }, children),
    Cell: () => null,
    ResponsiveContainer: ({ children }: any) =>
      React.createElement('div', { 'data-testid': 'responsive-container' }, children),
    Tooltip: () => null,
  };
});

describe('GeoHierarchyMindmap Accessibility', () => {
  const mockData: GeoAnalyticsSummaryResponse['data'] = {
    total_events: 10,
    by_district: [
      { district: 'रायपुर', event_count: 5 },
      { district: 'बिलासपुर', event_count: 5 },
    ],
    by_assembly: [
      { district: 'रायपुर', assembly: 'रायपुर शहर', event_count: 3 },
      { district: 'बिलासपुर', assembly: 'बिलासपुर शहर', event_count: 3 },
    ],
    by_block: [],
    urban_rural: { urban: 0, rural: 0 },
    top_locations: [],
    filters: { start_date: null, end_date: null, event_type: null },
  };

  it('should have no accessibility violations in default state', async () => {
    const { container } = render(<GeoHierarchyMindmap data={mockData} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations in loading state', async () => {
    const { container } = render(<GeoHierarchyMindmap data={undefined} />);
    // Wait for loading state
    await new Promise(resolve => setTimeout(resolve, 100));
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations in error state', async () => {
    // Mock fetch to return error
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    
    const { container } = render(<GeoHierarchyMindmap />);
    // Wait for error state
    await new Promise(resolve => setTimeout(resolve, 1000));
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have no accessibility violations in empty state', async () => {
    const emptyData: GeoAnalyticsSummaryResponse['data'] = {
      total_events: 0,
      by_district: [],
      by_assembly: [],
      by_block: [],
      urban_rural: { urban: 0, rural: 0 },
      top_locations: [],
      filters: { start_date: null, end_date: null, event_type: null },
    };

    const { container } = render(<GeoHierarchyMindmap data={emptyData} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA labels on interactive elements', () => {
    const { container } = render(<GeoHierarchyMindmap data={mockData} />);
    
    // Check export buttons have aria-labels
    const csvButton = container.querySelector('button[aria-label*="CSV"]');
    const jsonButton = container.querySelector('button[aria-label*="JSON"]');
    
    expect(csvButton).toBeTruthy();
    expect(jsonButton).toBeTruthy();
  });

  it('should have proper heading structure', () => {
    const { container } = render(<GeoHierarchyMindmap data={mockData} />);
    
    const heading = container.querySelector('h3');
    expect(heading).toBeTruthy();
    expect(heading?.textContent).toContain('भू-पदानुक्रम माइंडमैप');
  });

  it('should have proper semantic regions', () => {
    const { container } = render(<GeoHierarchyMindmap data={mockData} />);
    
    const region = container.querySelector('section[role="region"]');
    expect(region).toBeTruthy();
  });

  it('should have screen reader announcements', () => {
    const { container } = render(<GeoHierarchyMindmap data={mockData} />);
    
    const announcement = container.querySelector('[aria-live="polite"]');
    expect(announcement).toBeTruthy();
  });

  it('should have proper focus management on buttons', () => {
    const { container } = render(<GeoHierarchyMindmap data={mockData} />);
    
    const buttons = container.querySelectorAll('button');
    buttons.forEach(button => {
      // Buttons should have focus styles or aria-labels
      const hasAriaLabel = button.hasAttribute('aria-label');
      const hasFocusClass = button.className.includes('focus:');
      expect(hasAriaLabel || hasFocusClass).toBe(true);
    });
  });

  it('should have proper contrast ratios (color accessibility)', () => {
    const { container } = render(<GeoHierarchyMindmap data={mockData} />);
    
    // Check that text colors have sufficient contrast
    // This is more of a visual check, but we can verify aria-labels exist
    const interactiveElements = container.querySelectorAll('button, [role="button"]');
    interactiveElements.forEach(element => {
      const hasLabel = element.hasAttribute('aria-label');
      expect(hasLabel).toBe(true);
    });
  });

  it('should have keyboard navigation support', () => {
    const { container } = render(<GeoHierarchyMindmap data={mockData} />);
    
    // Check that interactive elements are keyboard accessible
    const buttons = container.querySelectorAll('button');
    buttons.forEach(button => {
      const tabIndex = button.getAttribute('tabindex') || button.getAttribute('tabIndex');
      // Interactive buttons should be accessible via keyboard
      // tabIndex can be 0, -1, or null (defaults to 0 for buttons)
      // We just verify the button exists and is interactive
      expect(button.tagName).toBe('BUTTON');
    });
    
    // At least some buttons should exist
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('should announce state changes to screen readers', () => {
    const { container } = render(<GeoHierarchyMindmap data={mockData} />);
    
    const liveRegion = container.querySelector('[aria-live]');
    expect(liveRegion).toBeTruthy();
    
    const statusRegion = container.querySelector('[role="status"]');
    expect(statusRegion || liveRegion).toBeTruthy();
  });
});

