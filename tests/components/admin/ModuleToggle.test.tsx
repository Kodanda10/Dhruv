/**
 * Module Toggle Component Tests
 * Phase 7.3: Tests for Analytics Module Toggle System
 */

import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import ModuleToggle from '@/components/admin/ModuleToggle';

// Mock the hook
jest.mock('@/hooks/useAnalyticsModules', () => ({
  useAnalyticsModules: () => ({
    modules: [
      {
        id: 1,
        module_key: 'event_type',
        module_name_hi: 'इवेंट प्रकार विश्लेषण',
        module_name_en: 'Event Type Analysis',
        enabled: true,
        display_order: 1,
        updated_at: '2024-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 2,
        module_key: 'geo_mapping',
        module_name_hi: 'भौगोलिक मैपिंग',
        module_name_en: 'Geo-Mapping',
        enabled: false,
        display_order: 2,
        updated_at: '2024-01-01T00:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
      },
    ],
    loading: false,
    error: null,
    toggleModule: jest.fn().mockResolvedValue(true),
    refreshModules: jest.fn(),
  }),
}));

describe('ModuleToggle Component', () => {
  it('should render module toggle', () => {
    render(<ModuleToggle />);
    expect(screen.getByText('एनालिटिक्स मॉड्यूल टॉगल')).toBeInTheDocument();
  });

  it('should display module count', () => {
    render(<ModuleToggle />);
    expect(screen.getByText(/1 \/ 2 मॉड्यूल सक्रिय/)).toBeInTheDocument();
  });

  it('should display all modules', () => {
    render(<ModuleToggle />);
    expect(screen.getByText('इवेंट प्रकार विश्लेषण')).toBeInTheDocument();
    expect(screen.getByText('भौगोलिक मैपिंग')).toBeInTheDocument();
  });

  it('should show toggle switches for each module', () => {
    render(<ModuleToggle />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(2);
  });

  it('should show enabled state correctly', () => {
    render(<ModuleToggle />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
  });
});


