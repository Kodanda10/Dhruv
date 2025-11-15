/**
 * Dashboard Component Glass Migration Tests
 *
 * Validates that Dashboard component properly uses glass-section-card
 * and doesn't leak legacy glassmorphic-card classes.
 */

import { render, screen } from '@testing-library/react';
import Dashboard from '@/components/Dashboard';

// Mock the API and other dependencies
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
  },
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn() }),
}));

// Mock parse utilities
jest.mock('@/utils/parse', () => ({
  parsePost: jest.fn(),
  formatHindiDate: jest.fn(),
}));

jest.mock('../../config/flags', () => ({
  isParseEnabled: true,
}));

jest.mock('@/utils/tag-search', () => ({
  matchTagFlexible: jest.fn(),
  matchTextFlexible: jest.fn(),
}));

jest.mock('@/lib/i18n/event-types-hi', () => ({
  getEventTypeInHindi: jest.fn((type) => type),
}));

describe('Dashboard glass-section-card usage', () => {
  const mockServerRows = [
    {
      id: 1,
      timestamp: '2024-01-01T00:00:00Z',
      content: 'Test content',
      parsed: {
        where: ['रायगढ़'],
        what: ['education'],
        confidence: 0.9,
      },
    },
  ];

  beforeEach(() => {
    // Mock the API response
    const mockApi = require('@/lib/api').api;
    mockApi.get.mockResolvedValue({ data: mockServerRows });
  });

  it('renders without crashing', () => {
    expect(() => render(<Dashboard />)).not.toThrow();
  });

  it('uses glass-section-card for summary chips', async () => {
    render(<Dashboard />);

    // Wait for data to load
    await screen.findByText(/स्थान सारांश/);

    // Find the summary chips containers
    const summaryContainers = screen.getAllByText(/सारांश/).map(el => el.closest('.glass-section-card'));

    // Should have at least 2 summary chips (location and activity)
    expect(summaryContainers.length).toBeGreaterThanOrEqual(2);

    // Each should have glass-section-card class
    summaryContainers.forEach(container => {
      expect(container).toHaveClass('glass-section-card');
    });
  });

  it('uses glass-section-card for filter toolbar', async () => {
    render(<Dashboard />);

    // Wait for component to render
    await screen.findByText(/स्थान फ़िल्टर/);

    // Find filter toolbar container
    const filterLabel = screen.getByText(/स्थान फ़िल्टर/);
    const filterContainer = filterLabel.closest('.glass-section-card');

    expect(filterContainer).toHaveClass('glass-section-card');
  });

  it('has no legacy glassmorphic-card classes anywhere', async () => {
    render(<Dashboard />);

    // Wait for component to render
    await screen.findByText(/स्थान सारांश/);

    // Check that no element has the legacy class
    const legacyElements = document.querySelectorAll('.glassmorphic-card');
    expect(legacyElements.length).toBe(0);
  });

  it('summary chips display correct text styling', async () => {
    render(<Dashboard />);

    await screen.findByText(/स्थान सारांश/);

    // Check that summary chips have white text
    const summaryChips = screen.getAllByText(/सारांश/).map(el => el.closest('.glass-section-card'));

    summaryChips.forEach(chip => {
      const computedStyle = window.getComputedStyle(chip!);
      expect(computedStyle.color).toBe('rgb(255, 255, 255)');
    });
  });

  it('filter inputs maintain glass styling context', async () => {
    render(<Dashboard />);

    await screen.findByText(/स्थान फ़िल्टर/);

    // Find input within glass-section-card
    const filterInput = screen.getByPlaceholderText(/जैसे: रायगढ़/);
    const glassContainer = filterInput.closest('.glass-section-card');

    expect(glassContainer).toHaveClass('glass-section-card');

    // Input should have appropriate styling for glass background
    expect(filterInput).toHaveClass('bg-white/5');
    expect(filterInput).toHaveClass('backdrop-blur-sm');
  });

  it('maintains responsive layout within glass containers', async () => {
    render(<Dashboard />);

    await screen.findByText(/स्थान सारांश/);

    // Check that containers have responsive classes
    const glassContainers = document.querySelectorAll('.glass-section-card');

    glassContainers.forEach(container => {
      // Should have responsive grid or flex classes
      const classList = container.className;
      expect(classList).toMatch(/grid|flex/);
      expect(classList).toMatch(/md:|lg:/);
    });
  });

  it('applies consistent spacing within glass containers', async () => {
    render(<Dashboard />);

    await screen.findByText(/स्थान सारांश/);

    const glassContainers = document.querySelectorAll('.glass-section-card');

    glassContainers.forEach(container => {
      const computedStyle = window.getComputedStyle(container);
      // Should have padding
      expect(computedStyle.padding).not.toBe('0px');
    });
  });
});